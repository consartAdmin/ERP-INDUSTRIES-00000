// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeController.js — Controlador NF-e (Sandbox / Homolog / Produção)  ║
// ║ CONSART ERP — Emissão, consulta, cancelamento, DANFE/XML            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ordersApi from '../../services/apis/ordersApi.js';
import tecnospeedNfeApi from '../../services/apis/tecnospeedNfeApi.js';
// ✅ NOVO: Inutilização de numeração
import tecnospeedNfeInutilizacaoApi from '../../services/apis/tecnoSpeedNfeInutilizacaoApi.js';

import pool from '../../config/db.js';
import axios from 'axios';

// ────────────────────────────────────────────────────────────────────────
// Helpers ambiente / token
// ────────────────────────────────────────────────────────────────────────
function is44Digits(str) {
  return /^[0-9]{44}$/.test(String(str || ''));
}

function getNfeAmbiente() {
  const raw = (process.env.NFE_AMBIENTE || 'producao').toLowerCase().trim();
  if (raw.startsWith('sandbox') || raw === 'teste') return 'sandbox';
  if (raw.startsWith('homolog')) return 'homologacao';
  return 'producao';
}

function hasNfeCreds() {
  const base =
    process.env.PLUGNOTAS_BASE_URL ||
    null;

  const key =
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    null;

  return !!base && !!key;
}

async function upsertNfeToOrder(
  orderId,
  {
    nfeId = null,
    idIntegracao = null,
    status = null,
    protocol = null,
    emittedAtNow = false,
  } = {},
) {
  const fields = [];
  const params = [];
  let idx = 1;

  if (nfeId !== null) {
    fields.push(`nfe_id = $${idx++}`);
    params.push(nfeId);
  }
  if (idIntegracao !== null) {
    fields.push(`nfe_id_integracao = $${idx++}`);
    params.push(idIntegracao);
  }
  if (status !== null) {
    fields.push(`nfe_status = $${idx++}`);
    params.push(status);
  }
  if (protocol !== null) {
    fields.push(`nfe_protocol = $${idx++}`);
    params.push(protocol);
  }
  if (emittedAtNow) {
    fields.push('nfe_emitted_at = NOW()');
  }

  if (!fields.length) return;

  params.push(orderId);
  const sql = `
    UPDATE public.orders
       SET ${fields.join(', ')}
     WHERE order_id = $${idx}
  `;
  await pool.query(sql, params);
}

/** Resolve o ID da NF-e no provedor a partir de:
 *  - id direto
 *  - chave 44 dígitos
 *  - idIntegracao
 */
async function resolveProviderNfeId(idOrChaveOrIdIntegracao) {
  const token = String(idOrChaveOrIdIntegracao || '').trim();
  if (!token) return null;

  if (!is44Digits(token)) {
    const tryDirect = await tecnospeedNfeApi.consultarNFe(token);
    if (
      tryDirect?.ok &&
      (tryDirect.data?.id ||
        (Array.isArray(tryDirect.data) && tryDirect.data[0]?.id))
    ) {
      const data = Array.isArray(tryDirect.data)
        ? tryDirect.data[0]
        : tryDirect.data;
      return data.id || null;
    }

    const byInt = await tecnospeedNfeApi.listarNFe({ q: token });
    if (byInt?.ok && Array.isArray(byInt.data) && byInt.data[0]?.id) {
      return byInt.data[0].id;
    }
    return null;
  }

  const resumo = await tecnospeedNfeApi.consultarNFe(token);
  if (resumo?.ok) {
    const data = Array.isArray(resumo.data)
      ? resumo.data[0]
      : resumo.data;
    return data?.id || null;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────
// 🚀 Emitir NF-e a partir de Pedido  (POST /api/nfe/issue/:id)
// ────────────────────────────────────────────────────────────────────────
export async function emitir(req, res) {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const ambiente = getNfeAmbiente();

    if (!hasNfeCreds()) {
      return res.status(400).json({
        ok: false,
        error:
          'Configuração de NF-e incompleta: verifique PLUGNOTAS_BASE_URL / API_KEY.',
        meta: {
          ambiente,
          baseURL: process.env.PLUGNOTAS_BASE_URL || null,
          hasKey:
            !!process.env.PLUGNOTAS_API_KEY ||
            !!process.env.PLUGNOTAS_API_KEY_REAL ||
            !!process.env.PLUGNOTAS_API_KEY_SANDBOX,
          mock: process.env.PLUGNOTAS_MOCK || '0',
        },
      });
    }

    // 1) Busca o pedido
    const pedidoResult = await ordersApi.getById(orderId);
    if (!pedidoResult?.ok) {
      const msg = pedidoResult?.error || 'Pedido não encontrado';
      const status = pedidoResult?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ ok: false, error: msg });
    }

    // 2) Monta JSON NF-e
    let nfePayload;
    try {
      nfePayload = await tecnospeedNfeApi.buildNFeFromOrder(pedidoResult);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error:
          String(err.message || err) || 'Falha ao montar JSON da NF-e',
      });
    }

    const idIntegracao = nfePayload.idIntegracao;

    // 3) Emite
    const result = await tecnospeedNfeApi.emitirNFe(nfePayload);
    if (!result.ok) {
      return res.status(result.status || 502).json({
        ok: false,
        error:
          result?.error?.message?.message ||
          result?.error?.message ||
          result?.error ||
          'Falha ao emitir NF-e',
        detail: result.error,
        meta: { idIntegracao, ambiente },
      });
    }

    // 4) Extrai ID e protocolo + fallbacks
    let nfeId = null;
    let protocol = null;

    const doc = result.data?.documents?.[0];
    if (doc?.id) nfeId = doc.id;
    if (!protocol && result.data?.protocol) protocol = result.data.protocol;
    if (!nfeId && result.data?.id) nfeId = result.data.id;
    if (!nfeId && result.data?.resumo?.id) nfeId = result.data.resumo.id;

    if (!nfeId && idIntegracao) {
      const lookup = await tecnospeedNfeApi.listarNFe({ q: idIntegracao });
      if (lookup?.ok && Array.isArray(lookup.data) && lookup.data[0]?.id) {
        nfeId = lookup.data[0].id;
      }
    }

    await upsertNfeToOrder(orderId, {
      nfeId: nfeId || null,
      idIntegracao,
      status: 'PROCESSANDO',
      protocol: protocol || null,
      emittedAtNow: true,
    });

    return res.status(200).json({
      ok: true,
      message:
        result.data?.message || 'NF-e enviada para processamento',
      ambiente,
      nfe: {
        id: nfeId,
        idIntegracao,
        protocol: protocol || null,
        status: 'PROCESSANDO',
      },
    });
  } catch (err) {
    console.error('Erro em nfeController.emitir:', err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────
// 🔍 Consultar NF-e (GET /api/nfe/consulta/:chave)
// ────────────────────────────────────────────────────────────────────────
export async function consultar(req, res) {
  try {
    const token = (req.params.chave || '').trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Token não informado' });
    }

    let idParaConsulta = token;
    if (!is44Digits(token)) {
      const resolved = await resolveProviderNfeId(token);
      if (resolved) idParaConsulta = resolved;
    }

    const result = await tecnospeedNfeApi.consultarNFe(idParaConsulta);
    const statusCode = result.ok ? 200 : 502;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('Erro ao consultar NF-e:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────
// 🚫 Cancelar NF-e (POST /api/nfe/cancelar/:chave)
// ────────────────────────────────────────────────────────────────────────
export async function cancelar(req, res) {
  try {
    const token = (req.params.chave || '').trim();
    const { justificativa } = req.body || {};

    if (!token) {
      return res.status(400).json({ ok: false, error: 'Token não informado' });
    }

    const providerId = await resolveProviderNfeId(token);
    if (!providerId) {
      return res.status(404).json({
        ok: false,
        error:
          'NF-e não localizada no provedor para este identificador.',
      });
    }

    const result = await tecnospeedNfeApi.cancelarNFe(
      providerId,
      justificativa || 'Cancelamento solicitado pelo emissor',
    );

    const statusCode = result.ok ? 200 : 502;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('Erro ao cancelar NF-e:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────
// 🧾 DANFE (PDF) — GET /api/nfe/danfe/:chave
// ────────────────────────────────────────────────────────────────────────
export async function danfe(req, res) {
  try {
    const token = (req.params.chave || '').trim();
    if (!token)
      return res
        .status(400)
        .json({ ok: false, error: 'Token não informado' });

    const providerId = await resolveProviderNfeId(token);
    if (!providerId) {
      return res
        .status(404)
        .json({ ok: false, error: 'NF-e não localizada para baixar DANFE.' });
    }

    const baseURL =
      process.env.PLUGNOTAS_BASE_URL ||
      'https://api.plugnotas.com.br';
    const apiKey =
      process.env.PLUGNOTAS_API_KEY ||
      process.env.PLUGNOTAS_API_KEY_REAL ||
      process.env.PLUGNOTAS_API_KEY_SANDBOX;

    const pdfUrl = `${baseURL}/nfe/${encodeURIComponent(providerId)}/danfe`;
    const pdfResp = await axios.get(pdfUrl, {
      headers: { 'X-API-KEY': apiKey },
      responseType: 'arraybuffer',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="nfe-${providerId}.pdf"`,
    );
    return res.send(pdfResp.data);
  } catch (err) {
    console.error('Erro ao baixar DANFE:', err.message || err);
    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message || String(err),
    });
  }
}

// ────────────────────────────────────────────────────────────────────────
// 📦 XML — GET /api/nfe/xml/:chave
// ────────────────────────────────────────────────────────────────────────
export async function xml(req, res) {
  try {
    const token = (req.params.chave || '').trim();
    if (!token)
      return res
        .status(400)
        .json({ ok: false, error: 'Token não informado' });

    const providerId = await resolveProviderNfeId(token);
    if (!providerId) {
      return res
        .status(404)
        .json({ ok: false, error: 'NF-e não localizada para baixar XML.' });
    }

    const baseURL =
      process.env.PLUGNOTAS_BASE_URL ||
      'https://api.plugnotas.com.br';
    const apiKey =
      process.env.PLUGNOTAS_API_KEY ||
      process.env.PLUGNOTAS_API_KEY_REAL ||
      process.env.PLUGNOTAS_API_KEY_SANDBOX;

    const xmlUrl = `${baseURL}/nfe/${encodeURIComponent(providerId)}/xml`;
    const xmlResp = await axios.get(xmlUrl, {
      headers: { 'X-API-KEY': apiKey },
      responseType: 'arraybuffer',
    });

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfe-${providerId}.xml"`,
    );
    return res.send(xmlResp.data);
  } catch (err) {
    console.error('Erro ao baixar XML:', err.message || err);
    return res.status(500).json({
      ok: false,
      error: err.response?.data || err.message || String(err),
    });
  }
}

/* =========================================================================
 * ✅ NOVO: Inutilização de Numeração NF-e
 *  - POST /api/nfe/inutilizacao
 *  - GET  /api/nfe/inutilizacao/:id
 * ========================================================================= */

export async function inutilizar(req, res) {
  try {
    const ambiente = getNfeAmbiente();

    if (!hasNfeCreds()) {
      return res.status(400).json({
        ok: false,
        error:
          'Configuração de NF-e incompleta: verifique PLUGNOTAS_BASE_URL / API_KEY.',
        meta: {
          ambiente,
          baseURL: process.env.PLUGNOTAS_BASE_URL || null,
          hasKey:
            !!process.env.PLUGNOTAS_API_KEY ||
            !!process.env.PLUGNOTAS_API_KEY_REAL ||
            !!process.env.PLUGNOTAS_API_KEY_SANDBOX,
          mock: process.env.PLUGNOTAS_MOCK || '0',
        },
      });
    }

    // body esperado (flexível):
    // { modelo, serie, numeroInicial, numeroFinal, justificativa, ano, cpfCnpj, uf, cuf, ambienteProducao }
    const body = req.body || {};

    const resp = await tecnospeedNfeInutilizacaoApi.inutilizarFaixaNFe({
      modelo: body.modelo ?? body.mod ?? 55,
      serie: body.serie ?? 1,
      numeroInicial: body.numeroInicial ?? body.nInicial ?? body.inicio,
      numeroFinal: body.numeroFinal ?? body.nFinal ?? body.fim,
      justificativa: body.justificativa ?? body.motivo ?? body.reason,
      ano: body.ano ?? body.aa,
      cpfCnpj: body.cpfCnpj ?? body.cnpj ?? null,
      uf: body.uf ?? null,
      cuf: body.cuf ?? body.cUF ?? null,
      ambienteProducao:
        typeof body.ambienteProducao === 'boolean'
          ? body.ambienteProducao
          : ambiente === 'producao',
    });

    const statusCode = resp.ok ? 200 : (resp.status || 502);
    return res.status(statusCode).json(resp);
  } catch (err) {
    console.error('Erro em nfeController.inutilizar:', err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
}

export async function consultarInutilizacao(req, res) {
  try {
    const id = (req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID/Protocolo não informado' });
    }

    const resp = await tecnospeedNfeInutilizacaoApi.consultarInutilizacao(id);
    const statusCode = resp.ok ? 200 : (resp.status || 502);
    return res.status(statusCode).json(resp);
  } catch (err) {
    console.error('Erro em nfeController.consultarInutilizacao:', err);
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
}
