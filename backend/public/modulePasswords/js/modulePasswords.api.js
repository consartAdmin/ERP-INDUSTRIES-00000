// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.api.js                                        ║
// ║ MODULE: Senhas dos Módulos — API                                    ║
// ║ 🔐 apiFetch envia o JWT (rotas exigem perfil administrador)          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { API } from './modulePasswords.config.js';

async function send(url, method, body) {
  const json = await apiFetch(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (json?.ok === false) throw new Error(json.message || 'Erro na API.');
  return json?.data;
}

export function fetchModulePasswords() {
  return send(API, 'GET');
}

export function createModulePassword(payload) {
  return send(API, 'POST', payload);
}

export function updateModulePassword(id, payload) {
  return send(`${API}/${encodeURIComponent(id)}`, 'PUT', payload);
}

export function clearModulePassword(id) {
  return send(`${API}/${encodeURIComponent(id)}/password`, 'DELETE');
}

export function deleteModulePassword(id) {
  return send(`${API}/${encodeURIComponent(id)}`, 'DELETE');
}
