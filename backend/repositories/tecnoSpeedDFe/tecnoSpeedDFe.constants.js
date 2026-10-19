// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFe.constants.js — configuração PlugNotas DF-e         ║
// ║ ambiente, base URL, API key, debug e CNPJ padrão (via .env)      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ======================================================================
// Configuração PlugNotas DF-e
// ======================================================================

// Ambiente (só para escolher qual API key usar)
export const NFE_AMBIENTE = process.env.NFE_AMBIENTE || 'homologacao';

// Base URL: você já deixou no .env
//   PLUGNOTAS_BASE_URL=https://api.plugnotas.com.br
export const PLUGNOTAS_BASE_URL =
  process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br';

// Token / x-api-key:
// - Em homolog você pode usar PLUGNOTAS_API_KEY_HOMOLOG
// - Em produção PLUGNOTAS_API_KEY
export let PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || '';

if (
  NFE_AMBIENTE === 'homologacao' &&
  process.env.PLUGNOTAS_API_KEY_HOMOLOG
) {
  PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY_HOMOLOG;
}

export const NFE_LIST_DEBUG =
  String(process.env.NFE_LIST_DEBUG || '0').trim() === '1';

// CNPJ padrão da empresa (caso você não envie cpfCnpj no params)
export const EMPRESA_CNPJ =
  (process.env.EMPRESA_CNPJ || '').replace(/\D/g, '') || '';
