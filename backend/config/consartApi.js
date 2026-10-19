// ╔══════════════════════════════════════════════════════════════════════╗
// ║ consartApi.js — Config da CONSART NF-e API (Cliente do ERP)          ║
// ║ Path: backend/config/consartApi.js                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function getConsartApiConfig() {
  const baseUrl = String(process.env.CONSART_API_BASE_URL || '').trim().replace(/\/$/, '');
  const apiKey  = String(process.env.CONSART_API_KEY || '').trim();

  if (!baseUrl) throw new Error('CONSART_API_BASE_URL não definido no .env');
  if (!apiKey)  throw new Error('CONSART_API_KEY não definido no .env');

  return { baseUrl, apiKey };
}
