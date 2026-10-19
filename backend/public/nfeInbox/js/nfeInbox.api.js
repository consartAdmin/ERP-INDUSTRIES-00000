/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.api.js — Comunicação com API | PRODNEX ERP (ESM)       ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { ROUTES } from './nfeInbox.config.js';

async function readJsonSafe(response) {
  try { return await response.json(); } catch { return {}; }
}

async function requestJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  const json = await readJsonSafe(response);
  if (!response.ok || json.success === false) {
    throw new Error(json.message || `${fallbackMessage} (HTTP ${response.status}).`);
  }
  return json;
}

export function getInboxList(params) {
  return requestJson(`${ROUTES.inboxList()}?${params}`, undefined, 'Erro ao carregar a lista');
}

export function getInboxById(id) {
  return requestJson(ROUTES.inboxById(id), undefined, 'Erro ao carregar os detalhes');
}

export async function getXmlById(id) {
  const response = await fetch(ROUTES.inboxXmlById(id));
  if (!response.ok) {
    const json = await readJsonSafe(response);
    const fallback = response.status === 404 ? 'XML não disponível.' : `Erro HTTP ${response.status}.`;
    throw new Error(json.message || fallback);
  }
  return response.text();
}

export async function getPdfById(id) {
  const response = await fetch(ROUTES.inboxPdfById(id));
  if (!response.ok) {
    const json = await readJsonSafe(response);
    const fallback = response.status === 404 ? 'PDF indisponível.' : `Erro HTTP ${response.status}.`;
    throw new Error(json.message || fallback);
  }
  return { response, blob: await response.blob() };
}

export function postManifest(id, operation) {
  return requestJson(ROUTES.manifestById(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operacao: operation }),
  }, 'Erro ao enviar a manifestação');
}

export function getSyncStatus() {
  return requestJson(
    ROUTES.syncStatus(),
    undefined,
    'Erro ao consultar o status da sincronização'
  );
}

export function postSyncDfe(payload) {
  return requestJson(ROUTES.syncDfe(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  }, 'Erro ao sincronizar DF-e');
}

export function postImportXml(formData) {
  return requestJson(ROUTES.importXml(), {
    method: 'POST',
    body: formData,
  }, 'Erro ao importar XML');
}

export function postInboundAutoFromDfe(accessKey, payload) {
  return requestJson(ROUTES.inboundAutoFromDfe(accessKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, 'Erro ao iniciar a entrada');
}

export async function downloadXmlBatch(params) {
  const route = ROUTES.inboxXmlLote();
  let response = await fetch(`${route}?${params}`, { method: 'GET' });

  if (!response.ok) {
    response = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries())),
    });
  }

  if (!response.ok) {
    const json = await readJsonSafe(response);
    throw new Error(json.message || `Erro HTTP ${response.status} ao baixar o lote de XML.`);
  }
  return { response, blob: await response.blob() };
}
