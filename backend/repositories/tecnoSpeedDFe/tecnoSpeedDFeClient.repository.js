// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFeClient.repository.js — cliente HTTP PlugNotas       ║
// ║ axios com keepAlive + x-api-key, retry/backoff (429/5xx/rede)    ║
// ╚══════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import https from 'https';
import { PLUGNOTAS_BASE_URL, PLUGNOTAS_API_KEY } from './tecnoSpeedDFe.constants.js';

// ======================================================================
// Helpers internos (retry/backoff)
// ======================================================================

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isRetryableNetworkCode(code) {
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNABORTED'
  );
}

export function axiosErrInfo(err) {
  return {
    message: err?.message,
    code: err?.code,
    status: err?.response?.status,
    statusText: err?.response?.statusText,
    url: err?.config?.baseURL
      ? `${err.config.baseURL}${err.config.url || ''}`
      : err?.config?.url,
  };
}

export async function requestWithRetry(config, { retries = 5, baseDelayMs = 650 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await http.request(config);
    } catch (err) {
      lastErr = err;

      const status = err?.response?.status;
      const code = err?.code;

      const retryable =
        (typeof status === 'number' && isRetryableStatus(status)) ||
        isRetryableNetworkCode(code);

      if (!retryable || attempt === retries) break;

      // backoff exponencial + jitter
      const jitter = Math.floor(Math.random() * 250);
      const waitMs = baseDelayMs * Math.pow(2, attempt) + jitter;

      console.warn('[PlugNotas][DF-e] retry', {
        attempt: attempt + 1,
        retries,
        waitMs,
        ...axiosErrInfo(err),
      });

      await sleep(waitMs);
    }
  }

  throw lastErr;
}

// ======================================================================
// Instância Axios (com keepAlive + interceptors)
// ======================================================================

// KeepAlive melhora estabilidade (muito comum evitar “conexão reaproveitada ruim”)
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

export const http = axios.create({
  baseURL: PLUGNOTAS_BASE_URL,
  timeout: 60000,
  httpsAgent,
});

// Header x-api-key da PlugNotas
http.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  if (PLUGNOTAS_API_KEY) {
    config.headers['x-api-key'] = PLUGNOTAS_API_KEY;
  }

  // garante accept
  if (!config.headers.Accept) {
    config.headers.Accept = 'application/json, text/plain, */*';
  }

  return config;
});
