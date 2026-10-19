// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersDanfeController.js — Gerar DANFE (PDF) a partir do XML         ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Rota: GET /api/orders/:id/nfe/danfe                                  ║
// ║                                                                      ║
// ║ - Busca pedido no DB                                                 ║
// ║ - Resolve XML (nfe_xml_url → PlugNotas via nfe_plugnotas_id → chave) ║
// ║ - Baixa XML com X-API-KEY                                             ║
// ║ - Gera PDF com generateDanfeFromXml (danfeConsartService.js)         ║
// ║                                                                      ║
// ║ ✅ FIX "CANCELADO" no DANFE:                                         ║
// ║ - Passa prot/status do DB para o service (prot.status)               ║
// ║ - Fallbacks fortes para campos de status/protocolo/data              ║
// ║ - Mantém compat com seu generateDanfeFromXml                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

import ordersApi from '../repositories/orders/orders.index.js';
import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';

// ✅ IMPORT CERTO (bate com o seu arquivo)
import { generateDanfeFromXml } from '../services/danfeConsartService.js';
import { nfeApiAuthHeaders } from '../repositories/nfeApi/nfeApiClient.repository.js';

// ----------------------------------------------------------------------
// Helpers ENV
// ----------------------------------------------------------------------
function getPlugNotasBaseUrl() {
  return (process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br')
    .toString()
    .replace(/\/+$/, '');
}

function getPlugNotasApiKey() {
  return (
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    ''
  )
    .toString()
    .trim();
}

function is44Digits(str) {
  return /^[0-9]{44}$/.test(String(str || '').trim());
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

function normalizeXmlText(xmlData) {
  if (!xmlData) return '';
  if (Buffer.isBuffer(xmlData)) return xmlData.toString('utf8');
  return String(xmlData);
}

/**
 * Normaliza status textual para facilitar comparações.
 */
function normStatus(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Decide se um status do DB deve marcar como "cancelada".
 * Aceita variações comuns.
 */
function isCanceledStatus(statusRaw) {
  const s = normStatus(statusRaw);
  if (!s) return false;

  // comuns em ERPs / integrações
  if (s.includes('cancel')) return true; // cancelada / cancelado / cancelamento
  if (s === 'canceled') return true;

  // alguns providers retornam códigos/labels
  if (s.includes('evento cancelamento')) return true;

  return false;
}

/**
 * Monta o "prot" (protocolo/status) para o DANFE a partir do header do pedido.
 * O seu danfeConsartService.js usa isso para decidir a marca d'água CANCELADO.
 */
function buildProtFromHeader(header = {}) {
  const statusRaw = pickFirst(header, [
    // padrões possíveis
    'nfe_status',
    'status_nfe',
    'statusNfe',
    'nfeStatus',
    'situacao',
    'situacao_nfe',
    'situacaoNfe',
    'status',
    // às vezes vem assim
    'nfe_situacao',
    'nfeSituacao',
  ]);

  const nProtRaw = pickFirst(header, [
    'nfe_protocol',
    'nfe_protocolo',
    'protocolo',
    'nProt',
    'prot',
    'protocolo_autorizacao',
    'nfe_nprot',
  ]);

  const dhRecbtoRaw = pickFirst(header, [
    'nfe_dhRecbto',
    'dhRecbto',
    'data_autorizacao',
    'dhAutorizacao',
    'nfe_dhAutorizacao',
    'authorized_at',
    'autorizada_em',
  ]);

  // Se o DB tiver um boolean de cancelamento forçado, respeita também
  const canceladaForcada = Boolean(
    header?.cancelada_forcada ||
    header?.canceladaForcada ||
    header?.nfe_cancelada_forcada ||
    header?.nfeCanceladaForcada
  );

  const statusFinal = canceladaForcada
    ? 'cancelada'
    : (statusRaw ? String(statusRaw) : '');

  return {
    status: statusFinal,
    nProt: nProtRaw ? String(nProtRaw) : '',
    dhRecbto: dhRecbtoRaw ? String(dhRecbtoRaw) : '',
    __canceladaForcada: canceladaForcada,
  };
}

// ----------------------------------------------------------------------
// Resolve XML URL (se estiver faltando no pedido)
// ----------------------------------------------------------------------
async function resolveXmlUrlFromProvider({ header }) {
  // 1) Já tem no header
  const direct = pickFirst(header, ['nfe_xml_url', 'nfeXmlUrl', 'xml_url', 'xmlUrl']);
  if (direct) return direct;

  // 2) Tenta consultar via PlugNotas ID
  const plugId = pickFirst(header, ['nfe_plugnotas_id', 'nfePlugnotasId', 'plugnotas_id']);
  if (plugId) {
    const resp = await tecnospeedNfeApi.consultarNFe(plugId);
    if (resp?.ok) {
      const data = Array.isArray(resp.data) ? (resp.data[0] || {}) : (resp.data || {});
      const xmlUrl = pickFirst(data, ['xml', 'xmlUrl', 'xml_url']);
      if (xmlUrl) return xmlUrl;
    }
  }

  // 3) Tenta consultar via chave (44 dígitos)
  const key = pickFirst(header, ['nfe_key', 'nfeKey', 'chave', 'accessKey']);
  if (key && is44Digits(key)) {
    const resp = await tecnospeedNfeApi.consultarNFe(key);
    if (resp?.ok) {
      const data = Array.isArray(resp.data) ? (resp.data[0] || {}) : (resp.data || {});
      const xmlUrl = pickFirst(data, ['xml', 'xmlUrl', 'xml_url']);
      if (xmlUrl) return xmlUrl;
    }
  }

  return null;
}

// ----------------------------------------------------------------------
// Download XML (PlugNotas exige X-API-KEY)
// ----------------------------------------------------------------------
async function downloadXmlAsText(xmlUrl) {
  // XML de NF-e emitida pela NF-e API própria: autentica com NFE_API_KEY
  const nfeApiHeaders = nfeApiAuthHeaders(xmlUrl);
  if (nfeApiHeaders) {
    const resp = await axios.get(xmlUrl, {
      headers: nfeApiHeaders,
      responseType: 'text',
      timeout: 30000,
      transformResponse: [(d) => d],
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return normalizeXmlText(resp.data);
  }

  const apiKey = getPlugNotasApiKey();

  const isPlugNotas = String(xmlUrl || '').includes('api.plugnotas.com.br');
  if (isPlugNotas && !apiKey) {
    throw new Error(
      'PLUGNOTAS_API_KEY não configurada. Configure PLUGNOTAS_API_KEY/REAL/SANDBOX para baixar XML da PlugNotas.'
    );
  }

  const resp = await axios.get(xmlUrl, {
    headers: apiKey ? { 'X-API-KEY': apiKey } : undefined,
    responseType: 'text',
    timeout: 30000,
    transformResponse: [(d) => d],
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return normalizeXmlText(resp.data);
}

// ======================================================================
// GET /api/orders/:id/nfe/danfe
// ======================================================================
export async function getOrderDanfe(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Parâmetro :id inválido.' });
    }

    // 1) Carrega pedido
    const out = await ordersApi.getById(id);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json({ ok: false, error: out?.error || 'PEDIDO_NAO_ENCONTRADO' });
    }

    const header = out.header || {};

    // 1.1) Monta "prot" com status/protocolo/data do DB
    const prot = buildProtFromHeader(header);

    // (LOG útil para você enxergar o que está indo pro DANFE)
    try {
      const statusDb = String(prot?.status || '');
      const canceladaForcadaDb = Boolean(prot?.__canceladaForcada);
      console.log('[DANFE][CTRL] statusDb=', statusDb);
      console.log('[DANFE][CTRL] canceladaForcadaDb=', canceladaForcadaDb);
      console.log('[DANFE][CTRL] isCanceledStatus(statusDb)=', isCanceledStatus(statusDb));
    } catch (_) { }

    // 2) Resolve XML URL (DB → provider)
    let xmlUrl = pickFirst(header, ['nfe_xml_url', 'nfeXmlUrl', 'xml_url', 'xmlUrl']);
    if (!xmlUrl) {
      xmlUrl = await resolveXmlUrlFromProvider({ header });

      // Se achou agora, persiste para não sofrer depois
      if (xmlUrl) {
        try {
          await ordersApi.update(id, { nfe_xml_url: xmlUrl });
        } catch (e) {
          console.warn('[ordersDanfeController] WARN: não conseguiu persistir nfe_xml_url:', e?.message || e);
        }
      }
    }

    if (!xmlUrl) {
      return res.status(400).json({
        ok: false,
        error:
          'Pedido não possui nfe_xml_url e não foi possível resolver via PlugNotas. ' +
          'Verifique se o pedido tem nfe_plugnotas_id ou nfe_key (44 dígitos).',
      });
    }

    // 3) Baixa o XML
    const xmlText = await downloadXmlAsText(xmlUrl);
    if (!xmlText || xmlText.length < 50) {
      return res.status(400).json({
        ok: false,
        error: 'Conteúdo XML inválido/curto. Verifique a URL do XML e permissões PlugNotas.',
        meta: { xmlUrl },
      });
    }

    // ----------------------------------------------------------------------
    // 4) Gera DANFE
    // ----------------------------------------------------------------------

    const orderItems =
      Array.isArray(out.items) ? out.items : [];

    const orderPayments =
      Array.isArray(out.payments) ? out.payments : [];

    const orderInstallments =
      Array.isArray(out.installments) ? out.installments : [];

    const orderDuplicatas =
      Array.isArray(out.duplicatas) ? out.duplicatas : [];

    const orderShipping =
      out.shipping ||
      out.header?.shipping ||
      header.shipping ||
      null;

    console.log('================================================');
    console.log('[DANFE][CTRL] orderShipping:', orderShipping);
    console.log('[DANFE][CTRL] orderItems:', orderItems.length);
    console.log('[DANFE][CTRL] orderPayments:', orderPayments.length);
    console.log('[DANFE][CTRL] orderInstallments:', orderInstallments.length);
    console.log('[DANFE][CTRL] orderDuplicatas:', orderDuplicatas.length);
    console.log('================================================');

    const result = await generateDanfeFromXml({
      xmlContent: xmlText,
      prot,

      paymentText:
        header.payment_text ||
        null,

      complementaryInfo:
        header.complementary_info ||
        header.notes ||
        null,

      orderItems,
      orderPayments,
      orderInstallments,
      orderDuplicatas,
      orderShipping,

      numero:
        header.nfe_number ||
        header.nfe_numero ||
        null,

      serie:
        header.nfe_serie ||
        header.serie ||
        '1',

      chave:
        header.nfe_key ||
        header.nfe_chave ||
        '',
    });

    const pdfBuffer =
      Buffer.isBuffer(result) ? result :
        Buffer.isBuffer(result?.buffer) ? result.buffer :
          Buffer.isBuffer(result?.pdfBuffer) ? result.pdfBuffer :
            null;

    if (!pdfBuffer) {
      return res.status(500).json({
        ok: false,
        error: 'Falha ao gerar DANFE: retorno do generateDanfeFromXml não trouxe Buffer.',
      });
    }

    const filename = result?.filename || `danfe-order-${id}.pdf`;

    // 5) Responde PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('[getOrderDanfe] EXC:', err);

    const status = err?.response?.status || 500;
    const data = err?.response?.data;

    const msg =
      (typeof data === 'string' && data) ||
      data?.error?.message ||
      err?.message ||
      String(err);

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      ok: false,
      error: msg,
    });
  }
}
