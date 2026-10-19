// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsUpdate.repository.js — update / deactivate          ║
// ║ Tabela: public."productsLocations"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_PRODUCTS } from './productsLocations.constants.js';
import { toBool } from './productsLocations.sanitizers.js';
import { getById } from './productsLocationsQuery.repository.js';
import { clearPrimaryIfMatches } from './productsLocationsRemove.repository.js';

export async function update(id, patch = {}) {
  const fields = [];
  const params = [];
  let idx = 1;

  if (patch.product_code != null) {
    fields.push(`product_code = $${idx++}`);
    params.push(patch.product_code);
  }
  if (patch.store_id !== undefined) {
    fields.push(`store_id = $${idx++}`);
    params.push(
      patch.store_id === null || patch.store_id === ''
        ? null
        : Number(patch.store_id)
    );
  }
  if (patch.corredor !== undefined) {
    fields.push(`corredor = $${idx++}`);
    params.push(patch.corredor);
  }
  if (patch.prateleira !== undefined) {
    fields.push(`prateleira = $${idx++}`);
    params.push(patch.prateleira);
  }
  if (patch.bandeja !== undefined) {
    fields.push(`bandeja = $${idx++}`);
    params.push(patch.bandeja);
  }
  if (patch.box !== undefined) {
    fields.push(`box = $${idx++}`);
    params.push(patch.box);
  }
  if (patch.observacao !== undefined) {
    fields.push(`observacao = $${idx++}`);
    params.push(patch.observacao);
  }
  if (patch.is_active != null) {
    fields.push(`is_active = $${idx++}`);
    params.push(toBool(patch.is_active));
  }

  if (!fields.length) return getById(id);

  params.push(id);

  const { rows } = await pool.query(
    `UPDATE ${TB}
        SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING id;`,
    params
  );

  // ✅ retorna já com descrição/barcode (via getById com join)
  return rows[0]?.id ? getById(rows[0].id) : null;
}

export async function deactivate(id) {
  const { rows } = await pool.query(
    `UPDATE ${TB}
        SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING id;`,
    [id]
  );
  if (rows[0]?.id) await clearPrimaryIfMatches(rows[0].id); // inativa não pode seguir como principal
  return rows[0]?.id ? getById(rows[0].id) : null;
}

/**
 * Define esta localização como a PRINCIPAL do produto
 * (products.product_location_id — exibida na Edição de Produtos).
 * Só aceita localização ativa; retorna a localização atualizada ou null se não existir.
 */
export async function setPrimary(id) {
  const loc = await getById(id);
  if (!loc) return null;
  if (!loc.is_active) {
    const err = new Error('Localização inativa não pode ser a principal.');
    err.status = 400;
    throw err;
  }

  await pool.query(
    `UPDATE ${TB_PRODUCTS} SET product_location_id = $1 WHERE product_code = $2;`,
    [loc.id, loc.product_code]
  );

  return getById(id);
}
