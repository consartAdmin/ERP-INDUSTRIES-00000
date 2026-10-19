/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCceController.js                                           ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                  ║
   ║ DESCRIPTION: Controller da CC-e integrado à TecnoSpeed/PlugNotas    ║
   ║ CONSART ERP · Node.js · Express · PostgreSQL · ESM                  ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import pool from '../config/db.js';
import tecnoSpeedNfeApi from '../repositories/nfe/nfe.index.js';
import nfeCceApi from '../repositories/nfeCce/nfeCce.index.js';

/* =========================================================================
 * 🧱 Bootstrap da tabela de eventos CC-e
 * ========================================================================= */

let __nfeCceTableReady = false;

async function ensureNfeCceTable() {
  if (__nfeCceTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.nfe_cce_events (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NULL,
      nfe_key VARCHAR(44) NOT NULL,
      nfe_plugnotas_id VARCHAR(120) NULL,
      protocolo VARCHAR(120) NULL,
      numero_sequencia INTEGER NULL,
      correcao TEXT NOT NULL,
      status VARCHAR(60) NULL,
      cstat VARCHAR(20) NULL,
      resposta_sefaz TEXT NULL,
      pdf_url TEXT NULL,
      xml_url TEXT NULL,
      raw_response JSONB NULL,
      created_by VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nfe_cce_events_nfe_key
    ON public.nfe_cce_events (nfe_key);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nfe_cce_events_order_id
    ON public.nfe_cce_events (order_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nfe_cce_events_protocolo
    ON public.nfe_cce_events (protocolo);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nfe_cce_events_plugnotas_id
    ON public.nfe_cce_events (nfe_plugnotas_id);
  `);

  __nfeCceTableReady = true;
}

/* =========================================================================
 * 🧩 Helpers
 * ========================================================================= */

function onlyDigits(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

function normalizeText(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function toUpperSafe(v) {
  return String(v ?? '').trim().toUpperCase();
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return v;
    }
  }

  return null;
}

function isValidNfeKey(v) {
  return /^\d{44}$/.test(onlyDigits(v));
}

function parseBoolean(v) {
  if (typeof v === 'boolean') return v;

  const s = String(v ?? '').trim().toLowerCase();

  return (
    s === '1' ||
    s === 'true' ||
    s === 'sim' ||
    s === 'yes'
  );
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

/**
 * Extrai o objeto efetivo de uma resposta da PlugNotas.
 *
 * A API pode devolver:
 * - { data: {...} }
 * - { data: [{...}] }
 * - [{...}]
 * - {...}
 *
 * Para consultas individuais de protocolo, o primeiro item é suficiente.
 */
function unwrapStatusRoot(payload) {
  if (Array.isArray(payload)) {
    return payload[0] || {};
  }

  if (Array.isArray(payload?.data)) {
    return payload.data[0] || {};
  }

  return payload?.data ?? payload ?? {};
}

function extractStatusPayload(payload) {
  const outer = payload ?? {};
  const root = unwrapStatusRoot(outer);

  const numeroSequenciaRaw = pickFirst(
    root.numeroSequencia,
    root.sequencia,
    root.sequence,
    root.seqEvento
  );

  const numeroSequencia = Number(numeroSequenciaRaw);

  return {
    protocolo: pickFirst(
      root.protocolo,
      root.protocol,
      root.nProt,
      root.numeroProtocolo
    ),

    numeroSequencia:
      Number.isFinite(numeroSequencia)
        ? numeroSequencia
        : null,

    correcao: pickFirst(
      root.correcao,
      root.textoCorrecao
    ),

    status: pickFirst(
      root.status,
      root.situacao,
      root.descricaoSituacao,
      root.resposta,
      outer.status,
      outer.message
    ),

    cstat: pickFirst(
      root.cStat,
      root.cstat,
      root.codigo,
      root.statusCodigo
    ),

    respostaSefaz: pickFirst(
      root.respostaSefaz,
      root.xMotivo,
      root.motivo,
      root.message,
      root.mensagem,
      outer.message
    ),

    dataEvento: pickFirst(
      root.date,
      root.data,
      root.createdAt
    ),

    pdfUrl: pickFirst(
      root.pdf,
      root.pdfUrl,
      root.urlPdf
    ),

    xmlUrl: pickFirst(
      root.xml,
      root.xmlUrl,
      root.urlXml
    ),

    raw: payload ?? null,
  };
}

function getProtocolFromPayload(payload) {
  return normalizeText(
    pickFirst(
      payload?.data?.protocolo,
      payload?.protocolo,
      payload?.data?.protocol,
      payload?.protocol,
      payload?.data?.nProt,
      payload?.nProt
    )
  );
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

/* =========================================================================
 * 🔎 Resolução da NF-e / Pedido
 * ========================================================================= */

async function resolveOrderInfo(orderId) {
  const id = Number(orderId);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const { rows } = await pool.query(
    `
    SELECT
      order_id,
      nfe_key,
      nfe_plugnotas_id,
      nfe_number,
      nfe_status
    FROM public."orders"
    WHERE order_id = $1
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function resolveNfeIdentifier({
  idOuChave,
  nfeKey,
  nfePlugnotasId,
  orderId,
}) {
  const direct = normalizeText(
    pickFirst(
      idOuChave,
      nfePlugnotasId,
      nfeKey
    )
  );

  if (direct) {
    return {
      idConsulta: direct,

      nfeKey:
        isValidNfeKey(direct)
          ? onlyDigits(direct)
          : normalizeText(nfeKey),

      nfePlugnotasId:
        !isValidNfeKey(direct)
          ? direct
          : normalizeText(nfePlugnotasId),

      orderId:
        Number(orderId) || null,
    };
  }

  if (orderId) {
    const order = await resolveOrderInfo(orderId);

    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado.`);
    }

    const resolvedId = normalizeText(
      order.nfe_plugnotas_id ||
      order.nfe_key
    );

    if (!resolvedId) {
      throw new Error(
        `Pedido ${orderId} não possui identificador de NF-e.`
      );
    }

    return {
      idConsulta: resolvedId,
      nfeKey: normalizeText(order.nfe_key),
      nfePlugnotasId: normalizeText(order.nfe_plugnotas_id),
      orderId: Number(order.order_id) || null,
    };
  }

  throw new Error(
    'Informe idOuChave, nfeKey, nfePlugnotasId ou orderId.'
  );
}

/* =========================================================================
 * 💾 Persistência local
 * ========================================================================= */

async function persistCceEvent({
  orderId = null,
  nfeKey,
  nfePlugnotasId = null,
  correcao,
  protocolo = null,
  numeroSequencia = null,
  status = null,
  cstat = null,
  respostaSefaz = null,
  pdfUrl = null,
  xmlUrl = null,
  rawResponse = null,
  createdBy = null,
}) {
  await ensureNfeCceTable();

  const sql = `
    INSERT INTO public.nfe_cce_events (
      order_id,
      nfe_key,
      nfe_plugnotas_id,
      protocolo,
      numero_sequencia,
      correcao,
      status,
      cstat,
      resposta_sefaz,
      pdf_url,
      xml_url,
      raw_response,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12::jsonb,
      $13,
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  const args = [
    Number(orderId) || null,
    normalizeText(nfeKey),
    normalizeText(nfePlugnotasId),
    normalizeText(protocolo),

    Number.isFinite(Number(numeroSequencia))
      ? Number(numeroSequencia)
      : null,

    normalizeText(correcao),
    normalizeText(status),
    normalizeText(cstat),
    normalizeText(respostaSefaz),
    normalizeText(pdfUrl),
    normalizeText(xmlUrl),
    safeJson(rawResponse),
    normalizeText(createdBy),
  ];

  const { rows } = await pool.query(sql, args);

  return rows[0] || null;
}

/**
 * Atualiza o registro local com a situação mais recente retornada
 * pela PlugNotas/SEFAZ.
 *
 * Quando o retorno possui protocolo, ele é priorizado para evitar
 * atualizar vários eventos da mesma NF-e.
 */
async function updateCceEventStatus({
  identifier,
  payload,
}) {
  await ensureNfeCceTable();

  const normalizedIdentifier = normalizeText(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  const extracted = extractStatusPayload(payload);

  const extractedProtocol = normalizeText(extracted.protocolo);

  const lookupIdentifier =
    extractedProtocol ||
    normalizedIdentifier;

  const { rows } = await pool.query(
    `
    UPDATE public.nfe_cce_events
    SET
      protocolo = COALESCE(
        NULLIF($2, ''),
        protocolo
      ),

      numero_sequencia = COALESCE(
        $3,
        numero_sequencia
      ),

      status = COALESCE(
        NULLIF($4, ''),
        status
      ),

      cstat = COALESCE(
        NULLIF($5, ''),
        cstat
      ),

      resposta_sefaz = COALESCE(
        NULLIF($6, ''),
        resposta_sefaz
      ),

      pdf_url = COALESCE(
        NULLIF($7, ''),
        pdf_url
      ),

      xml_url = COALESCE(
        NULLIF($8, ''),
        xml_url
      ),

      raw_response =
        COALESCE(raw_response, '{}'::jsonb)
        ||
        jsonb_build_object(
          'status',
          $9::jsonb
        ),

      updated_at = NOW()

    WHERE
      protocolo = $1

      OR (
        NULLIF($2, '') IS NULL
        AND (
             nfe_plugnotas_id = $1
          OR nfe_key = $1
        )
      )

    RETURNING *
    `,
    [
      lookupIdentifier,
      extractedProtocol,

      Number.isFinite(Number(extracted.numeroSequencia))
        ? Number(extracted.numeroSequencia)
        : null,

      normalizeText(extracted.status),
      normalizeText(extracted.cstat),
      normalizeText(extracted.respostaSefaz),
      normalizeText(extracted.pdfUrl),
      normalizeText(extracted.xmlUrl),
      safeJson(payload),
    ]
  );

  return rows[0] || null;
}

async function listSavedCceEvents({
  nfeKey = null,
  orderId = null,
  nfeNumber = null,
}) {
  await ensureNfeCceTable();

  const where = [];
  const args = [];

  if (nfeKey) {
    args.push(normalizeText(nfeKey));
    where.push(`e.nfe_key = $${args.length}`);
  }

  if (orderId) {
    args.push(Number(orderId));
    where.push(`e.order_id = $${args.length}`);
  }

  if (nfeNumber) {
    args.push(normalizeText(nfeNumber));
    where.push(`o.nfe_number::text = $${args.length}`);
  }

  const sql = `
    SELECT
      e.*,
      o.nfe_number,

      COALESCE(
        NULLIF(c.trade_name, ''),
        'Cliente não identificado'
      ) AS customer_name

    FROM public.nfe_cce_events e

    LEFT JOIN public."orders" o
      ON o.order_id = e.order_id

    LEFT JOIN public.customers c
      ON c.customer_id = o.customer_id

    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}

    ORDER BY
      e.numero_sequencia DESC NULLS LAST,
      e.id DESC
  `;

  const { rows } = await pool.query(sql, args);

  return rows;
}

/**
 * Sincroniza cada evento local usando o protocolo individual da CC-e.
 *
 * Isto evita o problema de consultar a NF-e com listaCce=true e depois
 * aplicar um único status em todos os eventos gravados.
 */
async function syncSavedCceEvents({
  nfeKey = null,
  orderId = null,
  nfeNumber = null,
}) {
  const savedEvents = await listSavedCceEvents({
    nfeKey,
    orderId,
    nfeNumber,
  });

  for (const event of savedEvents) {
    const identifier = normalizeText(
      event.protocolo ||
      event.nfe_plugnotas_id ||
      event.nfe_key
    );

    if (!identifier) {
      continue;
    }

    try {
      const result = await nfeCceApi.consultarStatusCCe(
        identifier,
        false
      );

      if (!result?.ok) {
        continue;
      }

      await updateCceEventStatus({
        identifier,
        payload: result.data,
      });
    } catch (error) {
      console.warn(
        `[nfeCceController.syncSavedCceEvents] Falha ao sincronizar CC-e ${event.id}:`,
        error?.message || error
      );
    }
  }

  return listSavedCceEvents({
    nfeKey,
    orderId,
    nfeNumber,
  });
}

/* =========================================================================
 * 📤 POST /api/nfe/cce
 * ========================================================================= */

export async function emitirCce(req, res) {
  try {
    await ensureNfeCceTable();

    const body = req.body || {};

    const correcao = normalizeText(
      pickFirst(
        body.correcao,
        body.textoCorrecao,
        body.correctionText,
        body.texto
      )
    );

    const createdBy = normalizeText(
      pickFirst(
        body.createdBy,
        body.criadoPor,
        body.usuario,
        req.user?.name,
        req.user?.email
      )
    );

    if (!correcao) {
      return sendError(
        res,
        400,
        'Texto da carta de correção não informado.'
      );
    }

    if (correcao.length < 15) {
      return sendError(
        res,
        400,
        'O texto da CC-e deve ter no mínimo 15 caracteres.'
      );
    }

    if (correcao.length > 1000) {
      return sendError(
        res,
        400,
        'O texto da CC-e deve ter no máximo 1000 caracteres.'
      );
    }

    const resolved = await resolveNfeIdentifier({
      idOuChave: body.idOuChave,
      nfeKey:
        body.nfeKey ||
        body.chaveAcesso,

      nfePlugnotasId:
        body.nfePlugnotasId ||
        body.idPlugnotas,

      orderId:
        body.orderId ||
        body.order_id,
    });

    /* ---------------------------------------------------------------------
     * Consulta e valida NF-e antes da CC-e
     * ------------------------------------------------------------------ */

    const consultaNfe = await tecnoSpeedNfeApi.consultarNFe(
      resolved.idConsulta
    );

    if (!consultaNfe?.ok) {
      return sendError(
        res,
        400,
        'Não foi possível consultar a NF-e antes de emitir a CC-e.',
        {
          error:
            consultaNfe?.error ||
            null,
        }
      );
    }

    const resumoNfe =
      Array.isArray(consultaNfe.data)
        ? consultaNfe.data[0]
        : consultaNfe.data || {};

    const statusNfe = toUpperSafe(
      pickFirst(
        resumoNfe.status,
        resumoNfe.situacao,
        resumoNfe.statusNfe,
        resumoNfe.situacaoNfe,
        resumoNfe.descricaoSituacao
      )
    );

    const chaveAcesso = normalizeText(
      pickFirst(
        resolved.nfeKey,
        resumoNfe.chaveAcesso,
        resumoNfe.chave_acesso,
        resumoNfe.chave,

        isValidNfeKey(resolved.idConsulta)
          ? onlyDigits(resolved.idConsulta)
          : null
      )
    );

    if (
      !chaveAcesso ||
      !isValidNfeKey(chaveAcesso)
    ) {
      return sendError(
        res,
        400,
        'Chave de acesso da NF-e não localizada.'
      );
    }

    const statusPermitidoCce =
      statusNfe.includes('AUTORIZ') ||
      statusNfe.includes('CONCLUID');

    if (
      statusNfe &&
      !statusPermitidoCce
    ) {
      return sendError(
        res,
        400,
        `A NF-e precisa estar AUTORIZADA/CONCLUÍDA para emitir CC-e. Situação atual: ${statusNfe}.`
      );
    }

    /* ---------------------------------------------------------------------
     * Envia CC-e
     * ------------------------------------------------------------------ */

    const envio = await nfeCceApi.emitirCCe(
      resolved.idConsulta,
      correcao
    );

    if (!envio?.ok) {
      return sendError(
        res,
        Number(envio?.status) || 400,
        'Falha ao enviar CC-e para a TecnoSpeed.',
        {
          error:
            envio?.error ||
            null,
        }
      );
    }

    /*
     * O POST normalmente devolve um protocolo do evento.
     * Esse protocolo identifica a CC-e específica e é preferível
     * para a consulta de status.
     */
    const protocoloEnvio = getProtocolFromPayload(
      envio?.data
    );

    const statusIdentifier =
      protocoloEnvio ||
      resolved.idConsulta;

    /* ---------------------------------------------------------------------
     * Consulta inicial do status
     *
     * É normal a resposta inicial ainda estar PROCESSANDO.
     * A sincronização final ocorrerá nas consultas/histórico.
     * ------------------------------------------------------------------ */

    const status = await nfeCceApi.consultarStatusCCe(
      statusIdentifier,
      false
    );

    const effectiveStatusPayload =
      status?.ok
        ? status.data
        : envio?.data || {};

    const extracted = extractStatusPayload(
      effectiveStatusPayload
    );

    /*
     * Garante que o protocolo do POST não seja perdido caso a primeira
     * consulta ainda não o devolva no payload.
     */
    const protocoloFinal = normalizeText(
      extracted.protocolo ||
      protocoloEnvio
    );

    /* ---------------------------------------------------------------------
     * Persiste evento inicial
     * ------------------------------------------------------------------ */

    const saved = await persistCceEvent({
      orderId:
        resolved.orderId,

      nfeKey:
        chaveAcesso,

      nfePlugnotasId:
        resolved.nfePlugnotasId ||
        (
          !isValidNfeKey(resolved.idConsulta)
            ? resolved.idConsulta
            : null
        ),

      correcao,

      protocolo:
        protocoloFinal,

      numeroSequencia:
        extracted.numeroSequencia,

      status:
        extracted.status ||
        'PROCESSANDO',

      cstat:
        extracted.cstat,

      respostaSefaz:
        extracted.respostaSefaz,

      pdfUrl:
        extracted.pdfUrl,

      xmlUrl:
        extracted.xmlUrl,

      rawResponse: {
        envio:
          envio?.data ||
          null,

        status:
          status?.ok
            ? status.data
            : null,
      },

      createdBy,
    });

    return res.status(200).json({
      ok: true,
      message: 'CC-e enviada com sucesso.',
      data: {
        envio:
          envio?.data ||
          null,

        status:
          status?.ok
            ? status.data
            : null,

        saved,
      },
    });
  } catch (err) {
    console.error(
      '[nfeCceController.emitirCce] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao emitir CC-e.'
    );
  }
}

/* =========================================================================
 * 🔍 GET /api/nfe/cce/status/:idOuChaveOuProtocolo
 * ========================================================================= */

export async function consultarStatusCce(req, res) {
  try {
    const idOuChaveOuProtocolo = normalizeText(
      req.params.idOuChaveOuProtocolo ||
      req.query.idOuChaveOuProtocolo
    );

    if (!idOuChaveOuProtocolo) {
      return sendError(
        res,
        400,
        'Identificador da CC-e/NF-e não informado.'
      );
    }

    const listaCce = parseBoolean(
      req.query.listaCce
    );

    const result = await nfeCceApi.consultarStatusCCe(
      idOuChaveOuProtocolo,
      listaCce
    );

    if (!result?.ok) {
      return sendError(
        res,
        Number(result?.status) || 400,
        'Falha ao consultar status da CC-e.',
        {
          error:
            result?.error ||
            null,
        }
      );
    }

    /*
     * Para consulta individual, atualiza diretamente o evento.
     *
     * Para listaCce=true, não aplicamos um único payload sobre todos
     * os eventos da NF-e; cada protocolo é sincronizado separadamente
     * pelo histórico.
     */
    if (!listaCce) {
      await updateCceEventStatus({
        identifier:
          idOuChaveOuProtocolo,

        payload:
          result.data,
      });
    }

    return res.status(200).json({
      ok: true,
      data: result.data,
    });
  } catch (err) {
    console.error(
      '[nfeCceController.consultarStatusCce] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao consultar status da CC-e.'
    );
  }
}

/* =========================================================================
 * 🧾 GET /api/nfe/cce/pdf/:idOuChave
 * ========================================================================= */

export async function obterPdfCce(req, res) {
  try {
    const idOuChave = normalizeText(
      req.params.idOuChave ||
      req.query.idOuChave
    );

    if (!idOuChave) {
      return sendError(
        res,
        400,
        'Id ou chave da NF-e não informado.'
      );
    }

    const result = await nfeCceApi.obterPdfCCe(
      idOuChave
    );

    if (!result?.ok) {
      if (
        result?.processing ||
        Number(result?.status) === 202
      ) {
        return res.status(202).json({
          ok: false,
          processing: true,
          message: 'CC-e ainda em processamento.',
        });
      }

      console.error(
        '[obterPdfCce] PDF inválido:',
        result?.error
      );

      return sendError(
        res,
        Number(result?.status) || 502,
        'A TecnoSpeed não retornou um PDF válido da CC-e.',
        {
          error: result?.error || null,
        }
      );
    }

    const buffer = Buffer.from(
      result.buffer
    );

    if (
      buffer.subarray(0, 4).toString() !== '%PDF'
    ) {
      return sendError(
        res,
        400,
        'Arquivo retornado não é um PDF válido.'
      );
    }

    const fileName =
      `cce-${onlyDigits(idOuChave) || Date.now()}.pdf`;

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    res.setHeader(
      'Content-Length',
      buffer.length
    );

    return res.end(buffer);
  } catch (err) {
    console.error(
      '[nfeCceController.obterPdfCce] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao obter PDF da CC-e.'
    );
  }
}

/* =========================================================================
 * 🧾 GET /api/nfe/cce/xml/:idOuChaveOuProtocolo
 * ========================================================================= */

export async function obterXmlCce(req, res) {
  try {
    const idOuChaveOuProtocolo = normalizeText(
      req.params.idOuChaveOuProtocolo ||
      req.query.idOuChaveOuProtocolo
    );

    if (!idOuChaveOuProtocolo) {
      return sendError(
        res,
        400,
        'Id, chave ou protocolo não informado.'
      );
    }

    const result = await nfeCceApi.obterXmlCCe(
      idOuChaveOuProtocolo
    );

    if (!result?.ok) {
      return sendError(
        res,
        Number(result?.status) || 400,
        'Falha ao obter XML da CC-e.',
        {
          error:
            result?.error ||
            null,
        }
      );
    }

    const fileName =
      `cce-${onlyDigits(idOuChaveOuProtocolo) || Date.now()}.xml`;

    res.setHeader(
      'Content-Type',
      'application/xml; charset=utf-8'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName}"`
    );

    return res.send(
      result.xml
    );
  } catch (err) {
    console.error(
      '[nfeCceController.obterXmlCce] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao obter XML da CC-e.'
    );
  }
}

/* =========================================================================
 * 📋 GET /api/nfe/:idOuChave/eventos-cce
 * 📋 GET /api/nfe/cce/eventos
 * ========================================================================= */

export async function listarEventosCce(req, res) {
  try {
    await ensureNfeCceTable();

    const routeId = normalizeText(
      req.params.idOuChave
    );

    const nfeKey = normalizeText(
      pickFirst(
        req.query.nfeKey,
        req.query.chaveAcesso,
        isValidNfeKey(routeId)
          ? routeId
          : null
      )
    );

    const orderId = Number(
      pickFirst(
        req.query.orderId,
        req.query.order_id
      ) || NaN
    );

    const nfeNumber = normalizeText(
      pickFirst(
        req.query.nfeNumber,
        req.query.nfe_number
      )
    );

    let resolvedOrderId =
      Number.isFinite(orderId) &&
        orderId > 0
        ? orderId
        : null;

    let resolvedKey =
      nfeKey ||
      null;

    let resolvedIdConsulta =
      routeId ||
      null;

    /* ---------------------------------------------------------------------
     * Resolve por pedido
     * ------------------------------------------------------------------ */

    if (
      !resolvedKey &&
      resolvedOrderId
    ) {
      const order = await resolveOrderInfo(
        resolvedOrderId
      );

      resolvedKey = normalizeText(
        order?.nfe_key
      );

      resolvedIdConsulta = normalizeText(
        order?.nfe_plugnotas_id ||
        order?.nfe_key
      );
    }

    /* ---------------------------------------------------------------------
     * Resolve chave quando a rota recebeu um ID da PlugNotas
     * ------------------------------------------------------------------ */

    if (
      !resolvedKey &&
      routeId &&
      !isValidNfeKey(routeId)
    ) {
      const consulta = await tecnoSpeedNfeApi.consultarNFe(
        routeId
      );

      if (consulta?.ok) {
        const resumo =
          Array.isArray(consulta.data)
            ? consulta.data[0]
            : consulta.data || {};

        resolvedKey = normalizeText(
          pickFirst(
            resumo.chaveAcesso,
            resumo.chave_acesso,
            resumo.chave
          )
        );
      }
    }

    /* ---------------------------------------------------------------------
     * Consulta remota completa para exibição
     * ------------------------------------------------------------------ */

    let remoto = null;

    if (
      resolvedIdConsulta ||
      resolvedKey
    ) {
      const remoteId =
        resolvedIdConsulta ||
        resolvedKey;

      const remoteStatus =
        await nfeCceApi.consultarStatusCCe(
          remoteId,
          true
        );

      if (remoteStatus?.ok) {
        remoto = remoteStatus.data;
      }
    }

    /* ---------------------------------------------------------------------
     * Sincroniza CADA evento local pelo seu protocolo individual.
     *
     * Depois da sincronização, lê novamente o banco para que a resposta
     * ao frontend já contenha CONCLUIDO / REJEITADO / etc.
     * ------------------------------------------------------------------ */

    const salvos = await syncSavedCceEvents({
      nfeKey:
        resolvedKey ||
        null,

      orderId:
        resolvedOrderId ||
        null,

      nfeNumber:
        nfeNumber ||
        null,
    });

    return res.status(200).json({
      ok: true,

      data: {
        filtros: {
          nfeKey:
            resolvedKey ||
            null,

          orderId:
            resolvedOrderId ||
            null,

          nfeNumber:
            nfeNumber ||
            null,

          idConsulta:
            resolvedIdConsulta ||
            null,
        },

        salvos,
        remoto,
      },
    });
  } catch (err) {
    console.error(
      '[nfeCceController.listarEventosCce] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao listar eventos de CC-e.'
    );
  }
}

/* =========================================================================
 * 🔎 GET /api/nfe/cce/order/:orderId
 * ========================================================================= */

export async function listarEventosCcePorOrder(req, res) {
  try {
    await ensureNfeCceTable();

    const orderId = Number(
      req.params.orderId
    );

    if (
      !Number.isFinite(orderId) ||
      orderId <= 0
    ) {
      return sendError(
        res,
        400,
        'orderId inválido.'
      );
    }

    const order = await resolveOrderInfo(
      orderId
    );

    if (!order) {
      return sendError(
        res,
        404,
        'Pedido não encontrado.'
      );
    }

    const remoteId = normalizeText(
      order.nfe_plugnotas_id ||
      order.nfe_key
    );

    /* ---------------------------------------------------------------------
     * Consulta remota completa para exibição
     * ------------------------------------------------------------------ */

    let remoto = null;

    if (remoteId) {
      const remoteStatus =
        await nfeCceApi.consultarStatusCCe(
          remoteId,
          true
        );

      if (remoteStatus?.ok) {
        remoto = remoteStatus.data;
      }
    }

    /* ---------------------------------------------------------------------
     * Sincroniza registros locais individualmente por protocolo.
     * ------------------------------------------------------------------ */

    const salvos = await syncSavedCceEvents({
      nfeKey:
        order.nfe_key ||
        null,

      orderId,
    });

    return res.status(200).json({
      ok: true,

      data: {
        order,
        salvos,
        remoto,
      },
    });
  } catch (err) {
    console.error(
      '[nfeCceController.listarEventosCcePorOrder] erro:',
      err
    );

    return sendError(
      res,
      500,
      err.message ||
      'Erro interno ao listar CC-e do pedido.'
    );
  }
}

/* =========================================================================
 * 📦 EXPORT
 * ========================================================================= */

const nfeCceController = {
  emitirCce,
  consultarStatusCce,
  obterPdfCce,
  obterXmlCce,
  listarEventosCce,
  listarEventosCcePorOrder,
};

export default nfeCceController;
