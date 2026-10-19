// ╔══════════════════════════════════════════════════════════════╗
// ║ productMovements.sanitizers.js — Validação de entrada       ║
// ╚══════════════════════════════════════════════════════════════╝

export function normalizeProductCode(value) {
  const code = String(value ?? '').trim();
  if (!code) {
    const error = new Error('productCode is required');
    error.status = 400;
    error.statusCode = 400;
    error.code = 'PRODUCT_CODE_REQUIRED';
    throw error;
  }
  return code;
}
