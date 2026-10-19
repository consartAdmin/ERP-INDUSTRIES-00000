// ╔════════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacaoClient.repository.js — cliente HTTP PlugNotas ║
// ║ baseURL, API key, modo MOCK e instância axios                          ║
// ╚════════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

export function getBaseURL() {
  return (process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br').replace(/\/+$/, '');
}

export function getApiKey() {
  return (
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    process.env.PLUGNOTAS_API_KEY_HOMOLOG ||
    null
  );
}

export function isMock() {
  return String(process.env.PLUGNOTAS_MOCK || '0') === '1';
}

export function client() {
  const baseURL = getBaseURL();
  const apiKey = getApiKey();

  const headers = {};
  // Em MOCK, você pode optar por não exigir a key no seu fluxo,
  // mas se tiver, enviamos igual.
  if (apiKey) headers['X-API-KEY'] = apiKey;

  return axios.create({
    baseURL,
    headers,
    timeout: Number(process.env.PLUGNOTAS_TIMEOUT_MS || 45000),
  });
}
