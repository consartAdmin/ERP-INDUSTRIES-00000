// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCceClient.repository.js — Config + cliente axios PlugNotas (CC-e) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

/* =========================================================================
 * 🔧 CONFIG
 * ========================================================================= */

export function getAmbiente() {
  return (process.env.NFE_AMBIENTE || 'producao').toLowerCase();
}

export function getBaseUrl() {
  if (process.env.PLUGNOTAS_BASE_URL) {
    return process.env.PLUGNOTAS_BASE_URL;
  }

  return getAmbiente() === 'sandbox'
    ? 'https://api.sandbox.plugnotas.com.br'
    : 'https://api.plugnotas.com.br';
}

export function getApiKey() {
  return (
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    process.env.TECNOSPEED_TOKEN ||
    process.env.TECNOSPEED_TOKEN_SH
  );
}

export const TIMEOUT = Number(process.env.PLUGNOTAS_TIMEOUT || 20000);

/* =========================================================================
 * 🔐 AXIOS
 * ========================================================================= */

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function refreshApiConfig() {
  api.defaults.baseURL = getBaseUrl();

  const key = getApiKey();
  api.defaults.headers['X-API-KEY'] = key;
  api.defaults.headers['x-api-key'] = key;
}
