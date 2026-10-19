// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfeClient.repository.js — Cliente HTTP PlugNotas (axios)     ║
// ║ Helpers de ambiente / config e header de autenticação                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_PATH || 'backend/.env' });

import axios from 'axios';

/* =========================================================================
 * 🔧 Helpers de ambiente / config
 * ========================================================================= */
export function getAmbiente() {
  return (process.env.NFE_AMBIENTE || 'producao').toLowerCase();
}

export function getBaseUrl() {
  const amb = getAmbiente();

  if (process.env.PLUGNOTAS_BASE_URL) {
    return process.env.PLUGNOTAS_BASE_URL;
  }

  if (amb === 'sandbox') {
    return 'https://api.sandbox.plugnotas.com.br';
  }

  return 'https://api.plugnotas.com.br';
}

export function getApiKey() {
  const amb = getAmbiente();

  if (amb === 'sandbox') {
    return (
      process.env.PLUGNOTAS_API_KEY_SANDBOX ||
      process.env.PLUGNOTAS_API_KEY ||
      process.env.TECNOSPEED_TOKEN_SH ||
      process.env.TECNOSPEED_TOKEN ||
      ''
    );
  }

  return (
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY ||
    process.env.TECNOSPEED_TOKEN_SH ||
    process.env.TECNOSPEED_TOKEN ||
    ''
  );
}

const PLUGNOTAS_TIMEOUT = Number(process.env.PLUGNOTAS_TIMEOUT || 20000);

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: PLUGNOTAS_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function ensureAuthHeader() {
  const key = getApiKey();
  api.defaults.headers['X-API-KEY'] = key;
  api.defaults.headers['x-api-key'] = key;
}

export function refreshApiConfig() {
  api.defaults.baseURL = getBaseUrl();
  ensureAuthHeader();
}
