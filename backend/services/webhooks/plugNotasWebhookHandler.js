// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugNotasWebhookHandler.js — Webhook Receiver (PlugNotas NF-e)      ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ - Recebe POST do PlugNotas                                          ║
// ║ - Extrai chave, status e infos SEFAZ                                ║
// ║ - Salva / atualiza em public."nfeWebhookEvents"                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as nfeWebhookEventsApi from '../../repositories/nfeWebhookEvents/nfeWebhookEvents.index.js';

/* --------------------------------------------------------------------- */
/* Helpers para extrair dados do payload PlugNotas                       */
/* (Estrutura tolerante, pois o layout pode variar por tipo)            */
/* --------------------------------------------------------------------- */

function safeGet(obj, path, defaultValue = null) {
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ??
    defaultValue;
}

function extractFromPlugNotasPayload(payload = {}) {
  // Possíveis campos de referência/integrationId
  const integrationId =
    payload.referencia ||
    payload.reference ||
    payload.orderId ||
    payload.order_id ||
    safeGet(payload, 'metadata.integration_id') ||
    safeGet(payload, 'metadata.order_id') ||
    null;

  // Possíveis campos de chave
  const chave =
    payload.chaveNFe ||
    payload.chNFe ||
    payload.chave ||
    safeGet(payload, 'nfe.chave') ||
    safeGet(payload, 'document.chaveAcesso') ||
    null;

  // Status (PlugNotas costuma mandar status ou situacao)
  const status =
    payload.status ||
    payload.situacao ||
    safeGet(payload, 'nfe.status') ||
    safeGet(payload, 'document.status') ||
    null;

  // Código / mensagem da SEFAZ
  const sefazCode =
    safeGet(payload, 'retorno.codigo') ||
    safeGet(payload, 'retorno.sefaz.codigo') ||
    safeGet(payload, 'retorno.status.codigo') ||
    null;

  const sefazMessage =
    safeGet(payload, 'retorno.mensagem') ||
    safeGet(payload, 'retorno.sefaz.mensagem') ||
    safeGet(payload, 'retorno.status.mensagem') ||
    safeGet(payload, 'mensagem') ||
    null;

  return {
    integrationId,
    chave,
    status,
    sefazCode,
    sefazMessage,
  };
}

/* --------------------------------------------------------------------- */
/* Handler principal do webhook                                          */
/* --------------------------------------------------------------------- */

export async function handlePlugNotasWebhook(req, res) {
  try {
    const payload = req.body || {};
    const meta = extractFromPlugNotasPayload(payload);

    const saved = await upsertWebhookEventFromPlugNotas({
      provider: 'PLUGNOTAS',
      integrationId: meta.integrationId,
      chave: meta.chave,
      status: meta.status,
      sefazCode: meta.sefazCode,
      sefazMessage: meta.sefazMessage,
      rawPayload: payload,
    });

    // Retorno no padrão que o PlugNotas aceita (200 OK)
    return res.status(200).json({
      ok: true,
      message: 'Webhook recebido e armazenado com sucesso.',
      id: saved.id,
    });
  } catch (error) {
    console.error('[PlugNotas Webhook] Error handling webhook:', error);
    // Importante: mesmo em erro, idealmente não devemos "derrubar" o fluxo do PlugNotas
    return res.status(200).json({
      ok: false,
      message: 'Erro ao processar webhook internamente. Verifique logs do ERP.',
    });
  }
}
