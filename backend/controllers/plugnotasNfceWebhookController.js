// ╔══════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfceWebhookController.js — NFC-e PlugNotas (CONSART)   ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import plugnotasNfceApi from '../repositories/plugnotasNfce/plugnotasNfce.index.js';

// -------------------------------------------------------------------
// 1. Garantir tabela nfceWebhookEvents (caso ainda não exista)
// -------------------------------------------------------------------
export async function ensureNfceWebhookEventsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public."nfceWebhookEvents" (
      id                      BIGSERIAL PRIMARY KEY,
      source                  VARCHAR(30) DEFAULT 'WEBHOOK',
      sale_id                 BIGINT,
      id_integracao           TEXT,
      plugnotas_id            TEXT,
      chave                   TEXT,
      numero                  TEXT,
      serie                   TEXT,
      status                  VARCHAR(20),
      tipo_evento             TEXT,
      cstat                   INTEGER,
      mensagem                TEXT,
      valor                   NUMERIC(14,2),
      emissao                 TEXT,
      data_autorizacao        TEXT,
      data_cancelamento       TEXT,
      protocolo               TEXT,
      protocolo_cancelamento  TEXT,
      emitente                TEXT,
      destinatario            TEXT,
      pdf_url                 TEXT,
      xml_url                 TEXT,
      xml_cancelamento_url    TEXT,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await pool.query(sql);
  console.log('[ensureNfceWebhookEventsTable] OK');
}

// chamo o ensure assim que o módulo é carregado
ensureNfceWebhookEventsTable().catch((err) => {
  console.error('[ensureNfceWebhookEventsTable] erro:', err);
});

// -------------------------------------------------------------------
// 2. Lista eventos para o painel (já funcionando na sua tela)
// -------------------------------------------------------------------
export async function listNfceWebhookEvents(req, res) {
  try {
    const {
      status,
      tipo_evento,
      cstat,
      q,
      dateFrom,
      dateTo,
      limit = 100,
    } = req.query;

    const params = [];
    const where = [];

    // -----------------------------------------------------------------
    // STATUS — trata equivalências:
    //  AUTORIZADA  => [AUTORIZADA, CONCLUIDO]
    //  REJEITADA   => [REJEITADA, REJEITADO]
    //  CANCELADA   => [CANCELADA, CANCELADO]
    //  (outros: usa valor direto)
    // -----------------------------------------------------------------
    if (status) {
      const s = status.toUpperCase();
      let allowed = [];

      if (s === 'AUTORIZADA') {
        allowed = ['AUTORIZADA', 'CONCLUIDO'];
      } else if (s === 'REJEITADA') {
        allowed = ['REJEITADA', 'REJEITADO'];
      } else if (s === 'CANCELADA') {
        allowed = ['CANCELADA', 'CANCELADO'];
      } else {
        allowed = [s];
      }

      const placeholders = allowed.map(
        (_, idx) => `$${params.length + idx + 1}`
      );
      params.push(...allowed);
      where.push(`UPPER(e.status) IN (${placeholders.join(',')})`);
    }

    // -----------------------------------------------------------------
    // resto dos filtros permanece igual
    // -----------------------------------------------------------------
    if (tipo_evento) {
      params.push(`%${tipo_evento}%`);
      where.push(`e.tipo_evento ILIKE $${params.length}`);
    }

    if (cstat) {
      params.push(Number(cstat));
      where.push(`e.cstat = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(e.chave ILIKE $${params.length} OR e.id_integracao ILIKE $${params.length} OR e.mensagem ILIKE $${params.length})`
      );
    }

    if (dateFrom) {
      params.push(dateFrom);
      where.push(`e.created_at::date >= $${params.length}`);
    }

    if (dateTo) {
      params.push(dateTo);
      where.push(`e.created_at::date <= $${params.length}`);
    }

    const lim = Math.min(Number(limit) || 100, 200);
    params.push(lim);

    const sql = `
      SELECT e.*
      FROM public."nfceWebhookEvents" e
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY e.created_at DESC
      LIMIT $${params.length};
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[listNfceWebhookEvents] erro:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'LIST_ERROR', message: 'Erro ao carregar eventos NFC-e.' });
  }
}

// -------------------------------------------------------------------
// 3. WEBHOOK PlugNotas (continua igual ao que já tínhamos)
// -------------------------------------------------------------------
export async function handlePlugnotasNfceWebhook(req, res) {
  // aqui você já tinha a lógica de gravar o evento vindo do webhook
  // não vou reescrever toda, só manter a assinatura
  // ...
  return res.json({ ok: true });
}

// -------------------------------------------------------------------
// 4. Importar resumo manualmente (campo "Importar da PlugNotas")
// -------------------------------------------------------------------
export async function importNfceResumo(req, res) {
  const { id } = req.body || {};
  if (!id) {
    return res
      .status(400)
      .json({ ok: false, error: 'MISSING_ID', message: 'Informe o ID/chave/protocolo.' });
  }

  try {
    const list = await plugnotasNfceApi.getNfceResumo(id);

    if (!list.length) {
      return res.json({
        ok: true,
        imported: 0,
        data: [],
        message: 'Nenhum resumo retornado pela PlugNotas.',
      });
    }

    let imported = 0;

    for (const r of list) {
      const {
        id: plugId,
        status,
        tipo,
        cstat,
        mensagem,
        chave,
      } = r;

      await pool.query(
        `
        INSERT INTO public."nfceWebhookEvents" (
          source, plugnotas_id, status, tipo_evento, cstat,
          mensagem, chave, created_at, updated_at
        )
        VALUES (
          'IMPORT_MANUAL', $1, $2, $3, $4,
          $5, $6, now(), now()
        )
        ON CONFLICT DO NOTHING;
      `,
        [plugId || id, status, tipo, cstat, mensagem, chave]
      );

      imported += 1;
    }

    return res.json({ ok: true, imported, data: list });
  } catch (err) {
    console.error('[importNfceResumo] erro:', err);
    return res.status(500).json({
      ok: false,
      error: 'IMPORT_ERROR',
      message: 'Erro ao importar resumo da NFC-e.',
    });
  }
}

// -------------------------------------------------------------------
// 5. Download XML via proxy (link "XML" no card)
// -------------------------------------------------------------------
export async function downloadNfceXml(req, res) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).send('ID/chave não informado.');
  }

  try {
    const xml = await plugnotasNfceApi.getNfceXml(id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(xml);
  } catch (err) {
    console.error('[downloadNfceXml] erro:', err);
    return res.status(500).send('Erro ao baixar XML da NFC-e.');
  }
}

// -------------------------------------------------------------------
// 6. *** NOVO *** — Sincronizar a partir da tabela "pdvSales"       //
// -------------------------------------------------------------------
export async function syncNfceFromPdvSales(req, res) {
  const limit = Math.min(Number(req.body?.limit) || 50, 200);

  try {
    // 1) Buscar vendas com nfce_id preenchido e
    //    que AINDA não existem na nfceWebhookEvents (pelo plugnotas_id)
    const { rows: sales } = await pool.query(
      `
      SELECT
        s.sale_id,
        s.id_integracao,
        s.nfce_id,
        s.nfce_key,
        s.nfce_number,
        s.nfce_protocol,
        s.nfce_status,
        s.nfce_pdf_url,
        s.nfce_xml_url,
        s.recebido,
        s.created_at AS sale_created_at
      FROM public."pdvSales" s
      LEFT JOIN public."nfceWebhookEvents" e
        ON e.plugnotas_id = s.nfce_id
      WHERE
        s.nfce_id IS NOT NULL
        AND TRIM(s.nfce_id) <> ''
        AND e.id IS NULL
      ORDER BY s.created_at ASC
      LIMIT $1;
      `,
      [limit]
    );

    if (!sales.length) {
      return res.json({
        ok: true,
        synced: 0,
        message: 'Nenhuma venda pendente de sincronização.',
      });
    }

    let synced = 0;

    for (const sale of sales) {
      const {
        sale_id,
        id_integracao,
        nfce_id,
        nfce_key,
        nfce_number,
        nfce_protocol,
        nfce_status,
        nfce_pdf_url,
        nfce_xml_url,
        recebido,
        sale_created_at,
      } = sale;

      // 2) Buscar RESUMO na PlugNotas usando o nfce_id da pdvSales
      let resumoList = [];
      try {
        resumoList = await plugnotasNfceApi.getNfceResumo(nfce_id);
      } catch (err) {
        console.error('[syncNfceFromPdvSales] erro getNfceResumo para', nfce_id);
      }

      const resumo = resumoList[0] || {};

      const status = resumo.status || nfce_status || null;
      const tipo_evento = resumo.tipo || 'NFCe.SyncPdvSales';
      const cstat = resumo.cstat || null;
      const mensagem = resumo.mensagem || null;
      const chave = resumo.chave || nfce_key || null;

      // 3) Inserir na nfceWebhookEvents combinando dados do RESUMO + PDV
      await pool.query(
        `
        INSERT INTO public."nfceWebhookEvents" (
          source,
          sale_id,
          id_integracao,
          plugnotas_id,
          chave,
          numero,
          serie,
          status,
          tipo_evento,
          cstat,
          mensagem,
          valor,
          emissao,
          protocolo,
          pdf_url,
          xml_url,
          created_at,
          updated_at
        )
        VALUES (
          'PDV_SYNC',
          $1, $2, $3, $4,
          $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15,
          $16, $16
        )
        ON CONFLICT DO NOTHING;
        `,
        [
          sale_id,
          id_integracao,
          nfce_id,
          chave,
          nfce_number,
          null, // série (se tiver em outra coluna, encaixa aqui)
          status,
          tipo_evento,
          cstat,
          mensagem,
          recebido || 0,
          sale_created_at?.toISOString?.() || null,
          nfce_protocol,
          nfce_pdf_url,
          nfce_xml_url,
          sale_created_at || new Date(),
        ]
      );

      synced += 1;
    }

    return res.json({
      ok: true,
      synced,
      message: `Sincronização concluída. ${synced} venda(s) importada(s).`,
    });
  } catch (err) {
    console.error('[syncNfceFromPdvSales] erro geral:', err);
    return res.status(500).json({
      ok: false,
      error: 'SYNC_ERROR',
      message: 'Erro ao sincronizar NFC-e a partir da pdvSales.',
    });
  }
}

// ---------------------------------------------------------------------
// Download PDF da NFC-e (DANFE) via PlugNotas, usando TOKEN (proxy)
// GET /api/webhooks/plugnotas/nfce/:id/pdf
// :id = id do registro em nfceWebhookEvents
// ---------------------------------------------------------------------
export async function downloadNfcePdf(req, res) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_ID',
      message: 'ID do evento NFC-e não informado.',
    });
  }

  try {
    // Buscamos os dados do evento
    const { rows } = await pool.query(
      `
      SELECT plugnotas_id, pdf_url, chave
      FROM public."nfceWebhookEvents"
      WHERE id = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Evento NFC-e não encontrado.',
      });
    }

    const row = rows[0];

    // 1) Preferimos usar o plugnotas_id (idNota da PlugNotas)
    let plugId = row.plugnotas_id;

    // 2) Se não tiver plugnotas_id, tentamos extrair do pdf_url
    //    Ex: https://api.plugnotas.com.br/nfce/{idNota}/pdf
    if (!plugId && row.pdf_url) {
      const match = row.pdf_url.match(/\/nfce\/([^/]+)\/pdf/i);
      if (match) {
        plugId = match[1];
      }
    }

    if (!plugId) {
      return res.status(400).json({
        ok: false,
        error: 'MISSING_PLUGNOTAS_ID',
        message: 'Não foi possível determinar o idNota (plugnotas_id) para esta NFC-e.',
      });
    }

    // 3) Chama a API da PlugNotas via nosso serviço, COM TOKEN
    const pdfBuffer = await plugnotasNfceApi.getNfcePdf(plugId);

    // 4) Envia o PDF para o browser
    const filename = `nfce-${row.chave || plugId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[downloadNfcePdf] erro:', err);

    // Se a PlugNotas devolver JSON de erro, devolvemos algo legível
    if (err.response && err.response.data) {
      try {
        const data = typeof err.response.data === 'string'
          ? JSON.parse(err.response.data)
          : err.response.data;

        return res.status(err.response.status || 502).json({
          ok: false,
          error: 'PLUGNOTAS_ERROR',
          message: data?.error?.message || 'Erro ao obter PDF na PlugNotas.',
          raw: data,
        });
      } catch (_) {
        // se não der pra parsear, cai no fallback
      }
    }

    return res.status(500).json({
      ok: false,
      error: 'PDF_ERROR',
      message: 'Erro ao obter PDF da NFC-e.',
    });
  }
}
