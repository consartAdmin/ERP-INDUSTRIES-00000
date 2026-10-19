// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanPendingsUpsert.repository.js — add/editar/concluir     ║
// ║ Tabela: public."ordersKanbanPendingItems"                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PENDINGS } from './ordersKanban.constants.js';
import { IS_DONE_PENDING } from './ordersKanban.sql.js';
import { badRequest, normalizePendingItem } from './ordersKanban.sanitizers.js';

// ✅ Marcar como concluído (padroniza para 'concluido')
export async function completePending(pendingId) {
  const id = Number(pendingId);
  if (!id || Number.isNaN(id)) throw new Error('pendingId inválido');

  const sql = `
    UPDATE ${TB_PENDINGS}
       SET status = 'concluido',
           updated_at = NOW()
     WHERE pending_id = $1
     RETURNING *;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

// ✅ Reabrir pendência concluída (volta para 'aberto')
export async function reopenPending(pendingId) {
  const id = Number(pendingId);
  if (!id || Number.isNaN(id)) throw new Error('pendingId inválido');

  const sql = `
    UPDATE ${TB_PENDINGS}
       SET status = 'aberto',
           updated_at = NOW()
     WHERE pending_id = $1
     RETURNING *;
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

// ✅ Editar pendência (somente abertas)
export async function updatePending(pendingId, { productCode, barcodeId, quantity, note } = {}) {
  const id = Number(pendingId);
  if (!id || Number.isNaN(id)) throw badRequest('pendingId inválido');

  const item = await normalizePendingItem({ productCode, barcodeId, quantity, note });

  const sql = `
    UPDATE ${TB_PENDINGS} p
       SET product_code = $2,
           barcode_id   = $3,
           quantity     = $4,
           note         = $5,
           updated_at   = NOW()
     WHERE p.pending_id = $1
       AND NOT (${IS_DONE_PENDING})
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [id, item.code, item.bId, item.q, item.note]);
  return rows[0] || null;
}

// ✅ Adicionar pendência (padroniza default para 'aberto')
export async function addPending({ cardId, productCode, barcodeId, quantity, note, status } = {}) {
  const c = Number(cardId);
  if (!c || Number.isNaN(c)) throw badRequest('cardId obrigatório');

  const { code, bId, q, note: cleanNote } = await normalizePendingItem({ productCode, barcodeId, quantity, note });

  // normaliza status de entrada
  const raw = String(status || 'aberto').toLowerCase();
  const st = (raw.includes('concl') || raw.includes('final') || raw.includes('done') || raw.includes('comp'))
    ? 'concluido'
    : 'aberto';

  const sql = `
    INSERT INTO ${TB_PENDINGS} (
      card_id,
      product_code,
      barcode_id,
      quantity,
      note,
      status,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [
    c,
    code,
    bId,
    q,
    cleanNote,
    st
  ]);

  return rows[0];
}
