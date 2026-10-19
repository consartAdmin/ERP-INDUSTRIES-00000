// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsKeyCreate.repository.js — create / upsert                  ║
// ║ Tabela: public."productsKey"                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsKey.constants.js';
import { normalizeKeyText } from './productsKey.sanitizers.js';

export async function create({
  product_code,
  word_keys,
  word_keys_norm,
} = {}) {
  if (!product_code) throw new Error('product_code é obrigatório.');
  if (!word_keys) throw new Error('word_keys é obrigatório.');

  const norm = (word_keys_norm && String(word_keys_norm).trim())
    ? String(word_keys_norm).trim()
    : normalizeKeyText(word_keys);

  if (!norm) throw new Error('word_keys_norm ficou vazio após normalização.');

  const { rows } = await pool.query(
    `
      INSERT INTO ${TB} (product_code, word_keys, word_keys_norm)
      VALUES ($1, $2, $3)
      RETURNING products_key_id, product_code, word_keys, word_keys_norm, created_at, updated_at
    `,
    [String(product_code).trim(), String(word_keys).trim(), norm]
  );

  return rows[0];
}

/**
 * Upsert lógico: mesma combinação (product_code + word_keys_norm) não duplica.
 * Se existir, atualiza word_keys e updated_at.
 */
export async function upsert({
  product_code,
  word_keys,
  word_keys_norm,
} = {}) {
  if (!product_code) throw new Error('product_code é obrigatório.');
  if (!word_keys) throw new Error('word_keys é obrigatório.');

  const norm = (word_keys_norm && String(word_keys_norm).trim())
    ? String(word_keys_norm).trim()
    : normalizeKeyText(word_keys);

  if (!norm) throw new Error('word_keys_norm ficou vazio após normalização.');

  const { rows } = await pool.query(
    `
      INSERT INTO ${TB} (product_code, word_keys, word_keys_norm)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_code, word_keys_norm)
      DO UPDATE SET
        word_keys = EXCLUDED.word_keys,
        updated_at = NOW()
      RETURNING products_key_id, product_code, word_keys, word_keys_norm, created_at, updated_at
    `,
    [String(product_code).trim(), String(word_keys).trim(), norm]
  );

  return rows[0];
}
