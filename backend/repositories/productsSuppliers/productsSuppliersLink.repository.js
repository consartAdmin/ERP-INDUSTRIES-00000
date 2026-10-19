// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliersLink.repository.js — addLink / setPrimary         ║
// ║ Tabela: public."productsSuppliers" (transacional)                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsSuppliers.constants.js';
import { ok, fail } from './productsSuppliers.utils.js';
import { normalizeRow } from './productsSuppliers.mappers.js';

/* ──────────────────────────────────────────────────────────────
   addLink — adiciona (ou garante) vínculo produto x fornecedor
────────────────────────────────────────────────────────────── */
export async function addLink({
  product_id,
  supplier_id,
  is_primary = false,
} = {}) {
  const pid = String(product_id ?? '').trim();
  const sid = Number(supplier_id);

  if (!pid) return fail('product_id é obrigatório.', 400);
  if (!Number.isInteger(sid) || sid <= 0) return fail('supplier_id inválido.', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (is_primary) {
      // Se esse fornecedor for o principal, zera os outros do mesmo produto
      await client.query(
        `
        UPDATE ${TB}
        SET is_primary = false
        WHERE product_id = $1
        `,
        [pid]
      );
    }

    const { rows } = await client.query(
      `
      INSERT INTO ${TB} (product_id, supplier_id, is_primary)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_id, supplier_id)
      DO UPDATE SET
        is_primary = EXCLUDED.is_primary
      RETURNING
        product_supplier_id,
        product_id,
        supplier_id,
        is_primary,
        created_at
      `,
      [pid, sid, !!is_primary]
    );

    await client.query('COMMIT');
    return ok(normalizeRow(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[productsSuppliersApi:addLink] error:', err);
    return fail('Erro ao vincular fornecedor ao produto.', 500);
  } finally {
    client.release();
  }
}

/* ──────────────────────────────────────────────────────────────
   setPrimary — marca um vínculo como principal
────────────────────────────────────────────────────────────── */
export async function setPrimary(product_supplier_id) {
  const id = Number(product_supplier_id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail('product_supplier_id inválido.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Descobre qual é o product_id desse vínculo
    const { rows: curRows } = await client.query(
      `
      SELECT product_id
      FROM ${TB}
      WHERE product_supplier_id = $1
      `,
      [id]
    );

    if (!curRows.length) {
      await client.query('ROLLBACK');
      return fail('Vínculo não encontrado.', 404);
    }

    const pid = String(curRows[0].product_id);

    // Zera todos como não principais
    await client.query(
      `
      UPDATE ${TB}
      SET is_primary = false
      WHERE product_id = $1
      `,
      [pid]
    );

    // Marca o solicitado como principal
    const { rows } = await client.query(
      `
      UPDATE ${TB}
      SET is_primary = true
      WHERE product_supplier_id = $1
      RETURNING
        product_supplier_id,
        product_id,
        supplier_id,
        is_primary,
        created_at
      `,
      [id]
    );

    await client.query('COMMIT');

    if (!rows.length) {
      return fail('Vínculo não encontrado após atualização.', 404);
    }

    return ok(normalizeRow(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[productsSuppliersApi:setPrimary] error:', err);
    return fail('Erro ao definir fornecedor principal.', 500);
  } finally {
    client.release();
  }
}
