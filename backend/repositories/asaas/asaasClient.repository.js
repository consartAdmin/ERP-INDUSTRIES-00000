// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasClient.repository.js — Configuração e cliente HTTP do Asaas   ║
// ║ Lê ASAAS_BASE_URL / ASAAS_API_KEY no carregamento (loga status)    ║
// ╚════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import { sanitizeBaseUrl } from './asaas.utils.js';

/* ---------------------------------------------------------------------- */
/* Configuração Asaas                                                     */
/* ---------------------------------------------------------------------- */
export const ASAAS_BASE_URL = sanitizeBaseUrl(process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3');
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  console.warn('[AsaasAPI] ⚠️ ASAAS_API_KEY não definido no .env — verifique as credenciais.');
} else {
  console.log('[AsaasAPI] ✅ ASAAS_API_KEY carregado. Base URL:', ASAAS_BASE_URL);
}

export const asaasClient = axios.create({
  baseURL: ASAAS_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    access_token: ASAAS_API_KEY,
  },
});
