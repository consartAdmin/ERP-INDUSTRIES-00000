// ╔════════════════════════════════════════════════════════════════════╗
// ║ sefazQuery.repository.js — Consulta “SEFAZ” (mock local)           ║
// ║ NÃO chama nenhum serviço externo                                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { onlyDigits, getMockCadastroByCnpj } from './sefaz.utils.js';

/**
 * 🔍 Consulta “SEFAZ” por CNPJ
 * Aqui NÃO existe chamada externa; apenas lookup local (mock).
 *
 * @param {Object} params
 * @param {string} params.cnpj - CNPJ informado (com ou sem máscara)
 * @param {string|null} params.uf - (ignorado por enquanto, mas mantido p/ futuro)
 */
export async function searchSefazByCnpj({ cnpj, uf = null }) {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) {
    throw new Error('CNPJ inválido (14 dígitos obrigatórios).');
  }

  const cadastro = getMockCadastroByCnpj(digits);
  if (!cadastro) {
    // Mantém padrão de “erro de consulta”
    throw new Error('Cadastro não encontrado na base local (mock).');
  }

  // Mantém formato compatível com o que o controller espera: objeto “data”
  return cadastro;
}

/**
 * 🔍 (Opcional) Consulta por IE + UF — por enquanto só mocka erro.
 * Mantemos a função para não quebrar nada, mas ainda não há base local.
 */
export async function searchSefazByIe({ uf, ie }) {
  throw new Error('Consulta por IE ainda não implementada na base local.');
}
