// ╔════════════════════════════════════════════════════════════════════╗
// ║ cnpjPublic.sanitizers.js — Normalização / validação de CNPJ        ║
// ╚════════════════════════════════════════════════════════════════════╝

/**
 * Normaliza CNPJ: remove tudo que não for dígito.
 */
export function sanitizeCnpj(cnpj) {
  if (!cnpj) return '';
  return String(cnpj).replace(/\D/g, '');
}

/**
 * Valida formato básico do CNPJ (apenas tamanho 14).
 * Se quiser, depois você coloca uma validação mais rígida.
 */
export function isValidCnpj(cnpjDigits) {
  return cnpjDigits.length === 14;
}
