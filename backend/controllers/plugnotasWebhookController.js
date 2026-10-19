// ╔══════════════════════════════════════════════════════════════════╗
// ║ plugnotasWebhookController.js — Webhook/API Callback PlugNotas  ║
// ║ - POST /webhooks/plugnotas  (callback público PlugNotas)        ║
// ║ - GET  /api/integrations/plugnotas/webhook       (config)       ║
// ║ - PUT  /api/integrations/plugnotas/webhook       (salvar cfg)   ║
// ║ - POST /api/integrations/plugnotas/webhook/test  (teste saída)  ║
// ║ - GET  /api/integrations/plugnotas/webhook/logs  (logs)         ║
// ║                                                                  ║
// ║ - Grava log bruto em integrations_plugnotas_webhook_logs        ║
// ║ - Atualiza public."orders" com dados da NF-e/NFC-e/NFCom        ║
// ║ - Grava evento em public."nfeWebhookEvents"                     ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import axios from 'axios';

// 🔹 NOVO: API de nfeWebhookEvents
import nfeWebhookEventsApi from '../repositories/nfeWebhookEvents/nfeWebhookEvents.index.js';

const TB_LOGS   = 'public.integrations_plugnotas_webhook_logs';
const TB_ORDERS = 'public."orders"';
const TB_CONFIG = 'public.integrations_plugnotas_webhook_config';

// Ambiente da NF-e (homologacao / producao), vindo do .env
const NFE_ENVIRONMENT = process.env.NFE_AMBIENTE || null;

// Base do sistema para montar URL padrão do webhook
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

// ====================================================================
// Helper: normaliza payload do PlugNotas
// ====================================================================
function normalizePlugnotasPayload(payload = {}) {
  const docType = payload.documento || 'desconhecido';

  // NFS-e usa "situacao", NF-e/NFC-e/NFCom usa "status"
  const status = payload.situacao || payload.status || null;

  // Emitente / prestador
  const emitente =
    payload.prestador || // NFS-e
    payload.emitente  || // NFe / NFC-e / NFCom
    null;

  const tomadorDest =
    payload.tomador      || // NFS-e
    payload.destinatario || // NFe / NFC-e / NFCom
    null;

  // Protocolo (aparece em alguns exemplos de NFe/NFCe/NFCom)
  const protocolo = payload.protocolo || null;

  // Valor (NFS-e: valorServico | NFe/NFCe/NFCom: valor)
  const valor = payload.valorServico ?? payload.valor ?? null;

  // Número da nota (NFS-e: numeroNfse / numero; NFe/NFCe/NFCom: numero)
  const numero = payload.numero ?? payload.numeroNfse ?? null;

  // Links de XML / PDF
  const xmlUrl = payload.xml || payload.xmlCancelamento || null;
  const pdfUrl = payload.pdf || null;

  return {
    docType,
    status,
    idPlugnotas:  payload.id || null,
    idIntegracao: payload.idIntegracao || null,
    emitente,
    tomadorDest,
    chave:        payload.chave || null,
    numero,
    serie:        payload.serie || null,
    valor,
    mensagem:     payload.mensagem || null,
    xmlUrl,
    pdfUrl,
    protocolo,
  };
}

// ====================================================================
// Helper: grava log no banco (tabela integrations_plugnotas_webhook_logs)
// ====================================================================
async function insertPlugnotasLog(payload) {
  const norm = normalizePlugnotasPayload(payload);

  const query = `
    INSERT INTO ${TB_LOGS} (
      doc_type,
      status,
      id_plugnotas,
      id_integracao,
      emitente,
      tomador_dest,
      chave,
      numero,
      serie,
      valor,
      mensagem,
      xml_url,
      pdf_url,
      raw_payload
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  `;

  const values = [
    norm.docType,
    norm.status,
    norm.idPlugnotas,
    norm.idIntegracao,
    norm.emitente,
    norm.tomadorDest,
    norm.chave,
    norm.numero,
    norm.serie,
    norm.valor,
    norm.mensagem,
    norm.xmlUrl,
    norm.pdfUrl,
    payload,
  ];

  await pool.query(query, values);
}

// ====================================================================
// Helper: atualiza a tabela public."orders" com base no payload
// Apenas para documentos fiscais de produtos (nfe / nfce / nfcom)
// ====================================================================
async function updateOrderFromPlugnotas(payload) {
  const norm = normalizePlugnotasPayload(payload);

  // Só vamos mexer em PEDIDOS para documentos tipo NF-e/NFC-e/NFCom
  if (!['nfe', 'nfce', 'nfcom'].includes((norm.docType || '').toLowerCase())) {
    return; // NFS-e, por exemplo, só registra log
  }

  const nfeStatus       = norm.status || null;
  const nfeKey          = norm.chave || null;
  const nfeNumber       = norm.numero ? Number(norm.numero) : null;
  const nfeProtocol     = norm.protocolo || null;
  const nfeXmlUrl       = norm.xmlUrl || null;
  const nfeDanfeUrl     = norm.pdfUrl || null;
  const nfePlugnotasId  = norm.idPlugnotas || null;
  const nfeEnvironment  = NFE_ENVIRONMENT; // homologacao / producao

  // Se não temos nem idPlugnotas nem chave, não dá pra relacionar com o pedido
  if (!nfePlugnotasId && !nfeKey) {
    console.warn('[PlugNotas][Webhook] Payload sem id/chave para relacionar pedido:', payload);
    return;
  }

  const query = `
    UPDATE ${TB_ORDERS}
       SET nfe_status       = $1,
           nfe_key          = COALESCE(nfe_key, $2),
           nfe_number       = COALESCE(nfe_number, $3),
           nfe_protocol     = COALESCE(nfe_protocol, $4),
           nfe_xml_url      = COALESCE(nfe_xml_url, $5),
           nfe_danfe_url    = COALESCE(nfe_danfe_url, $6),
           nfe_environment  = COALESCE(nfe_environment, $7),
           nfe_plugnotas_id = COALESCE(nfe_plugnotas_id, $8),
           updated_at       = NOW()
     WHERE (nfe_plugnotas_id = $8)
        OR (nfe_key          = $2)
  `;

  const values = [
    nfeStatus,
    nfeKey,
    nfeNumber,
    nfeProtocol,
    nfeXmlUrl,
    nfeDanfeUrl,
    nfeEnvironment,
    nfePlugnotasId,
  ];

  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    console.warn('[PlugNotas][Webhook] Nenhum pedido (orders) encontrado para atualizar com payload:', {
      nfePlugnotasId,
      nfeKey,
      nfeNumber,
    });
  } else {
    console.log(
      `[PlugNotas][Webhook] Pedido(s) atualizado(s) a partir de webhook: linhas afetadas = ${result.rowCount}`,
    );
  }
}

// ====================================================================
// Helpers: CONFIG do webhook (integrações internas)
// Tabela: public.integrations_plugnotas_webhook_config
// ====================================================================
async function ensureConfigRow() {
  // Tenta buscar primeira linha
  const { rows } = await pool.query(`SELECT * FROM ${TB_CONFIG} ORDER BY id ASC LIMIT 1`);
  if (rows.length > 0) return rows[0];

  // Se não existir, cria com defaults
  const defaultUrl = `${APP_BASE_URL}/webhooks/plugnotas`;
  const insert = `
    INSERT INTO ${TB_CONFIG} (enabled, url, secret, last_delivery_at, last_http_status, updated_at)
    VALUES (TRUE, $1, NULL, NULL, NULL, NOW())
    RETURNING *;
  `;
  const { rows: inserted } = await pool.query(insert, [defaultUrl]);
  return inserted[0];
}

// ====================================================================
// Controller: GET /api/integrations/plugnotas/webhook
// ====================================================================
export async function getPlugnotasWebhookConfig(req, res) {
  try {
    const cfg = await ensureConfigRow();

    return res.status(200).json({
      enabled:        !!cfg.enabled,
      url:            cfg.url || `${APP_BASE_URL}/webhooks/plugnotas`,
      lastDeliveryAt: cfg.last_delivery_at || null,
      lastHttpStatus: cfg.last_http_status || null,
      provider:       'PlugNotas',
      environment:    NFE_ENVIRONMENT || 'desconhecido',
    });
  } catch (err) {
    console.error('[PlugNotas][Webhook] Erro ao carregar configuração:', err);
    return res.status(500).json({ message: 'Erro ao carregar configuração do webhook PlugNotas.' });
  }
}

// ====================================================================
// Controller: PUT /api/integrations/plugnotas/webhook
// ====================================================================
export async function updatePlugnotasWebhookConfig(req, res) {
  const { enabled, url, secret } = req.body || {};

  try {
    const cfg = await ensureConfigRow();

    const newEnabled = typeof enabled === 'boolean' ? enabled : !!cfg.enabled;
    const newUrl     = url && String(url).trim() ? String(url).trim() : cfg.url;
    const newSecret  = secret != null && String(secret).trim() !== ''
      ? String(secret).trim()
      : cfg.secret;

    const update = `
      UPDATE ${TB_CONFIG}
         SET enabled          = $1,
             url              = $2,
             secret           = $3,
             updated_at       = NOW()
       WHERE id = $4
       RETURNING *;
    `;
    const { rows } = await pool.query(update, [
      newEnabled,
      newUrl,
      newSecret,
      cfg.id,
    ]);

    const saved = rows[0];

    return res.status(200).json({
      enabled:        !!saved.enabled,
      url:            saved.url,
      lastDeliveryAt: saved.last_delivery_at || null,
      lastHttpStatus: saved.last_http_status || null,
      provider:       'PlugNotas',
      environment:    NFE_ENVIRONMENT || 'desconhecido',
    });
  } catch (err) {
    console.error('[PlugNotas][Webhook] Erro ao salvar configuração:', err);
    return res.status(500).json({ message: 'Erro ao salvar configuração do webhook PlugNotas.' });
  }
}

// ====================================================================
// Controller: POST /api/integrations/plugnotas/webhook/test
// Envia uma requisição de teste para o endpoint configurado
// ====================================================================
export async function testPlugnotasWebhook(req, res) {
  try {
    const cfg = await ensureConfigRow();

    if (!cfg.enabled) {
      return res.status(400).json({
        message: 'Webhook PlugNotas está desativado. Ative antes de testar.',
      });
    }

    if (!cfg.url || !String(cfg.url).trim()) {
      return res.status(400).json({
        message: 'URL do webhook PlugNotas não configurada.',
      });
    }

    const testPayload = {
      documento: 'nfe',
      id: 'TESTE-WEBHOOK-PLUGNOTAS',
      idIntegracao: 'teste-webhook-consart',
      emissao: new Date().toISOString(),
      status: 'CONCLUIDO',
      emitente: process.env.EMPRESA_CNPJ || '00000000000000',
      destinatario: '00000000000',
      valor: 1.23,
      numero: '999999',
      serie: '1',
      mensagem: 'Webhook de teste disparado pelo CONSART ERP.',
      cStat: 100,
    };

    let httpStatus = null;

    try {
      const resp = await axios.post(cfg.url, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CONSART-ERP-WebhookTest/1.0',
          ...(cfg.secret ? { 'X-Consart-Webhook-Secret': cfg.secret } : {}),
        },
        timeout: 5000,
      });

      httpStatus = resp.status;
    } catch (err) {
      httpStatus = err.response?.status || null;
      console.error('[PlugNotas][Webhook][Test] Erro ao chamar URL configurada:', err.message);
    }

    const update = `
      UPDATE ${TB_CONFIG}
         SET last_delivery_at = NOW(),
             last_http_status = $1,
             updated_at       = NOW()
       WHERE id = $2
       RETURNING *;
    `;
    const { rows } = await pool.query(update, [httpStatus, cfg.id]);
    const updated = rows[0];

    return res.status(200).json({
      message: httpStatus && httpStatus >= 200 && httpStatus < 300
        ? `Teste enviado com sucesso (HTTP ${httpStatus}).`
        : `Teste enviado, mas o endpoint retornou HTTP ${httpStatus ?? 'desconhecido'}.`,
      status: {
        enabled:        !!updated.enabled,
        lastDeliveryAt: updated.last_delivery_at || null,
        lastHttpStatus: updated.last_http_status || null,
      },
    });
  } catch (err) {
    console.error('[PlugNotas][Webhook] Erro no teste do webhook:', err);
    return res.status(500).json({
      message: 'Erro interno ao testar o webhook PlugNotas.',
    });
  }
}

// ====================================================================
// Controller principal: POST /webhooks/plugnotas
// (rota chamada pelo PlugNotas)
// ====================================================================
export async function handlePlugnotasWebhook(req, res) {
  const payload = req.body || {};

  try {
    // 1) Grava log bruto
    await insertPlugnotasLog(payload);

    // 🔹 1.1) Grava também na tabela nfeWebhookEvents
    try {
      const norm = normalizePlugnotasPayload(payload);

      await nfeWebhookEventsApi.insertWebhookEvent(pool, {
        emitter_cnpj:   norm.emitente || null,
        integration_id: norm.idIntegracao || null,
        plugnotas_uuid: norm.idPlugnotas || null,
        chave_acesso:   norm.chave || null,
        numero_nfe:     norm.numero || null,
        serie:          norm.serie || null,
        status:         norm.status || null,
        cstat:          payload.cStat != null ? String(payload.cStat) : null,
        motivo:         norm.mensagem || null,
        tipo_evento:    'emissao',
        raw_payload:    payload,
      });
    } catch (err) {
      console.error('[PlugNotas][Webhook] Erro ao salvar em nfeWebhookEvents (não bloqueante):', err);
    }

    // 2) Atualiza tabela de pedidos (orders) para NF-e/NFC-e/NFCom
    await updateOrderFromPlugnotas(payload);

    // 3) Responder 2xx para indicar sucesso ao PlugNotas
    return res.status(200).json({ message: 'Webhook PlugNotas recebido com sucesso.' });
  } catch (err) {
    console.error('[PlugNotas][Webhook] Erro ao processar webhook:', err);

    // Se der erro, devolve 500 para o PlugNotas tentar novamente
    return res.status(500).json({
      message: 'Erro interno ao processar webhook PlugNotas.',
    });
  }
}

// ====================================================================
// GET /api/integrations/plugnotas/webhook/logs
// Lista logs para monitoramento no ERP
// ====================================================================
export async function getPlugnotasWebhookLogs(req, res) {
  const limit = Number(req.query.limit) > 0 && Number(req.query.limit) <= 200
    ? Number(req.query.limit)
    : 50;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        doc_type       AS "docType",
        status,
        id_plugnotas   AS "idPlugnotas",
        id_integracao  AS "idIntegracao",
        emitente,
        tomador_dest   AS "tomadorDest",
        chave,
        numero,
        serie,
        valor,
        mensagem,
        xml_url        AS "xmlUrl",
        pdf_url        AS "pdfUrl",
        created_at     AS "createdAt"
      FROM ${TB_LOGS}
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return res.status(200).json(rows);
  } catch (err) {
    console.error('[PlugNotas][Webhook] Erro ao listar logs:', err);
    return res.status(500).json({ message: 'Erro ao carregar logs do webhook PlugNotas.' });
  }
}
