// ╔════════════════════════════════════════════════════════════════════╗
// ║ cnpjPublic.constants.js — Base da API pública de CNPJ              ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Base da API pública de CNPJ.
 * Deixe em .env para poder trocar se precisar:
 *   CNPJ_PUBLIC_API_BASE=https://publica.cnpj.ws/cnpj
 */
export const CNPJ_PUBLIC_API_BASE =
  process.env.CNPJ_PUBLIC_API_BASE || 'https://publica.cnpj.ws/cnpj';
