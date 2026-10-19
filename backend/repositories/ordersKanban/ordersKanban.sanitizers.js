// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanban.sanitizers.js — Validação de pendências (entrada)     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BARCODES } from './ordersKanban.constants.js';

export function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// Valida produto / unidade / quantidade (usado no adicionar e no editar)
export async function normalizePendingItem({ productCode, barcodeId, quantity, note }) {
  const code = String(productCode ?? '').trim();
  const q = Number(quantity);
  const bId = barcodeId == null || barcodeId === '' ? null : Number(barcodeId);

  if (!code) throw badRequest('product_code obrigatório');
  if (!Number.isInteger(q) || q <= 0) throw badRequest('quantity deve ser um inteiro maior que zero');
  if (bId !== null && (!Number.isInteger(bId) || bId <= 0)) throw badRequest('barcode_id inválido');

  // a unidade precisa pertencer ao produto escolhido
  if (bId !== null) {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM ${TB_BARCODES} WHERE barcode_id = $1 AND product_code = $2`,
      [bId, code]
    );
    if (!rowCount) throw badRequest('barcode_id não pertence ao produto informado');
  }

  return { code, bId, q, note: String(note ?? '').trim() || null };
}
