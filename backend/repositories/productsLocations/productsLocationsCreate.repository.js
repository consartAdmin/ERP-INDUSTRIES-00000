// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsCreate.repository.js — create                       ║
// ║ Tabela: public."productsLocations"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsLocations.constants.js';
import { toBool } from './productsLocations.sanitizers.js';
import { getById } from './productsLocationsQuery.repository.js';

export async function create({
  product_code,
  store_id = null,
  corredor = null,
  prateleira = null,
  bandeja = null,
  box = null,
  observacao = null,
  is_active = true,
} = {}) {
  if (!product_code) throw new Error('product_code é obrigatório');

  const { rows } = await pool.query(
    `INSERT INTO ${TB} (
       product_code,
       store_id,
       corredor,
       prateleira,
       bandeja,
       box,
       observacao,
       is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id;`,
    [
      product_code,
      store_id != null ? Number(store_id) : null,
      corredor,
      prateleira,
      bandeja,
      box,
      observacao,
      toBool(is_active, true),
    ]
  );

  // ✅ retorna já com descrição/barcode (via getById com join)
  return rows[0]?.id ? getById(rows[0].id) : null;
}
