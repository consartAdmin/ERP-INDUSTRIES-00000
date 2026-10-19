// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeClient.repository.js — Cliente HTTP PlugNotas           ║
// ║ ✔ ENV (dotenv) + BASE_URL/API KEY dinâmicos                          ║
// ║ ✔ Instância axios compartilhada + config efetiva                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Mantém a ordem de avaliação do módulo original: estas dependências
// eram carregadas antes do dotenv.config() abaixo.
import '../../config/db.js';
import '../paymentMethods/paymentMethods.index.js';
import '../customers/customers.index.js';
import '../../services/stockFromOrdersService.js';
import '../cancelarNfe/cancelarNfe.index.js';
import '../appFeatures/appFeatures.index.js';

import axios from 'axios';
import {
  sanitizeCpfCnpj,
} from '../nfe/nfe.sanitizers.js';

/* =========================================================================
 * 🔧 Carregamento de variáveis de ambiente ANTES de tudo (força backend/.env)
 * ========================================================================= */
import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_PATH || 'backend/.env' });

/* =========================================================================
 * 🔧 Helpers de ENV e Config
 * ========================================================================= */
export function getAmbiente() {
  return (process.env.NFE_AMBIENTE || 'producao').toLowerCase();
}

export function getBaseUrl() {
  if (process.env.PLUGNOTAS_BASE_URL) {
    return process.env.PLUGNOTAS_BASE_URL.trim();
  }

  return getAmbiente() === 'sandbox'
    ? 'https://api.sandbox.plugnotas.com.br'
    : 'https://api.plugnotas.com.br';
}

export function getApiKey() {
  const ambiente = getAmbiente();

  let apiKey;

  if (ambiente === 'producao') {
    apiKey =
      process.env.PLUGNOTAS_API_KEY_REAL ||
      process.env.PLUGNOTAS_API_KEY;
  } else if (ambiente === 'homologacao') {
    apiKey =
      process.env.PLUGNOTAS_API_KEY_HOMOLOG ||
      process.env.PLUGNOTAS_API_KEY;
  } else if (ambiente === 'sandbox') {
    apiKey =
      process.env.PLUGNOTAS_API_KEY_SANDBOX ||
      process.env.PLUGNOTAS_API_KEY_HOMOLOG ||
      process.env.PLUGNOTAS_API_KEY;
  } else {
    throw new Error(
      `[PlugNotasNFe] NFE_AMBIENTE inválido: "${ambiente}".`
    );
  }

  if (!apiKey) {
    throw new Error(
      `[PlugNotasNFe] API Key ausente para o ambiente "${ambiente}".`
    );
  }

  return String(apiKey).trim();
}

export const PLUGNOTAS_TIMEOUT = Number(process.env.PLUGNOTAS_TIMEOUT || 20000);
export const PLUGNOTAS_MOCK =
  process.env.PLUGNOTAS_MOCK === '1' || process.env.TECNOSPEED_MOCK === '1';

export const NFE_DEBUG =
  process.env.NFE_DEBUG === '1' || process.env.NFE_DEBUG === 'true';

/* =========================================================================
 * 🔐 Cliente Axios
 * ========================================================================= */
export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: PLUGNOTAS_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

export function ensureAuthHeader() {
  const key = getApiKey();
  api.defaults.headers['X-API-KEY'] = key;
  api.defaults.headers['x-api-key'] = key;
}

export function refreshApiConfig() {
  const base = getBaseUrl();
  if (api.defaults.baseURL !== base) {
    console.log('[PlugNotasNFe] baseURL atualizado para:', base);
    api.defaults.baseURL = base;
  }
  ensureAuthHeader();
}

console.log('[PlugNotasNFe] Base URL (boot):', api.defaults.baseURL);

export const configuredApiKey =
  getAmbiente() === 'sandbox'
    ? (
      process.env.PLUGNOTAS_API_KEY_SANDBOX ||
      process.env.PLUGNOTAS_API_KEY
    )
    : (
      process.env.PLUGNOTAS_API_KEY_REAL ||
      process.env.PLUGNOTAS_API_KEY
    );

if (!configuredApiKey) {
  console.warn(
    `[PlugNotasNFe] API Key ausente para o ambiente "${getAmbiente()}".`
  );
}

/* =========================================================================
 * 🔎 Config efetiva
 * ========================================================================= */
export function getEffectiveConfig() {
  refreshApiConfig();

  const key = getApiKey() || '';
  const masked = key
    ? `${key.slice(0, 4)}…${key.slice(-4)}`
    : null;

  const ambienteConfigurado = getAmbiente();

  return {
    baseURL: api.defaults.baseURL,
    ambiente:
      ambienteConfigurado === 'producao'
        ? 'PRODUCAO'
        : 'HOMOLOGACAO',
    producao: ambienteConfigurado === 'producao',
    empresaCnpj: sanitizeCpfCnpj(process.env.EMPRESA_CNPJ),
    hasApiKey: Boolean(key),
    apiKeyMasked: masked,
  };
}
