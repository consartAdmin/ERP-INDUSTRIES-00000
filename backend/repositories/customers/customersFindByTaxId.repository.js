// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersFindByTaxId.repository.js — busca cliente por CNPJ/CPF    ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB } from './customers.constants.js';

/**
 * Retorna { customer_id, trade_name, legal_name } do cliente com o
 * mesmo CNPJ/CPF (comparando só dígitos) ou null.
 */
export async function findByTaxId(taxId) {
  const digits = String(taxId ?? '').replace(/\D+/g, '');
  if (!digits) return null;

  const { rows } = await pool.query(
    `SELECT customer_id, trade_name, legal_name
       FROM ${tb()}
      WHERE regexp_replace(COALESCE(tax_id, ''), '\\D+', '', 'g') = $1
      ORDER BY customer_id
      LIMIT 1`,
    [digits]
  );
  return rows[0] || null;
}
