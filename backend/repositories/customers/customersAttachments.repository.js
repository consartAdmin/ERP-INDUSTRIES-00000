// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersAttachments.repository.js                                 ║
// ║ Tabela: public."customersAttachments"                              ║
// ║ Só banco — o arquivo em si fica em uploadBucketsCustomers.js       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { toNumOrNull, trimOrNull } from './customers.utils.js';

const TB = 'public."customersAttachments"';

// toNumOrNull(null) devolve 0 — aqui precisamos de null de verdade.
const toIdOrNull = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export const ATTACHMENT_CATEGORIES = Object.freeze([
    'documento',
    'contrato',
    'comprovante',
    'outros',
]);

export function normalizeAttachmentCategory(value) {
    const v = String(value ?? '').trim().toLowerCase();
    return ATTACHMENT_CATEGORIES.includes(v) ? v : 'documento';
}

// Projeção pública (sem storage_path / bucket)
const mapAttachment = (r) => ({
    attachment_id: Number(r.attachment_id),
    customer_id: Number(r.customer_id),
    original_name: r.original_name,
    mime_type: r.mime_type ?? null,
    size_bytes: Number(r.size_bytes ?? 0),
    category: r.category,
    description: r.description ?? null,
    uploaded_by: r.uploaded_by ?? null,
    uploaded_by_name: r.uploaded_by_name ?? null,
    created_at: r.created_at,
});

export async function customerExists(customerId, db = pool) {
    const cid = toNumOrNull(customerId);
    if (!cid) return false;

    const { rowCount } = await db.query(
        'SELECT 1 FROM public.customers WHERE customer_id = $1',
        [cid]
    );

    return rowCount > 0;
}

/**
 * INSERT — chamado depois do upload no GCS ter dado certo.
 */
export async function insertAttachment({
    customer_id,
    original_name,
    storage_bucket,
    storage_path,
    mime_type,
    size_bytes,
    category,
    description,
    uploaded_by,
} = {}, db = pool) {
    const { rows } = await db.query(
        `INSERT INTO ${TB}
       (customer_id, original_name, storage_bucket, storage_path,
        mime_type, size_bytes, category, description, uploaded_by)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
        [
            toNumOrNull(customer_id),
            String(original_name || 'arquivo').slice(0, 255),
            storage_bucket,
            storage_path,
            mime_type ?? null,
            toNumOrNull(size_bytes) ?? 0,
            normalizeAttachmentCategory(category),
            trimOrNull(description),
            toIdOrNull(uploaded_by),
        ]
    );

    return mapAttachment(rows[0]);
}

/**
 * LIST — anexos ativos do cliente (mais recentes primeiro).
 */
export async function listByCustomer(customerId) {
    const cid = toNumOrNull(customerId);
    if (!cid) throw new Error('invalid customer_id');

    const { rows } = await pool.query(
        `SELECT *
       FROM ${TB}
      WHERE customer_id = $1
        AND is_active = TRUE
      ORDER BY created_at DESC, attachment_id DESC`,
        [cid]
    );

    return rows.map(mapAttachment);
}

/**
 * Linha interna (inclui storage_path) — uso exclusivo do backend
 * para download/exclusão. Nunca devolver direto ao front.
 */
export async function findActiveAttachment(customerId, attachmentId) {
    const cid = toNumOrNull(customerId);
    const aid = toNumOrNull(attachmentId);
    if (!cid || !aid) return null;

    const { rows } = await pool.query(
        `SELECT *
       FROM ${TB}
      WHERE customer_id = $1
        AND attachment_id = $2
        AND is_active = TRUE
      LIMIT 1`,
        [cid, aid]
    );

    return rows[0] ?? null;
}

/**
 * Exclusão lógica (mantém histórico de quem/quando).
 */
export async function softDeleteAttachment(customerId, attachmentId, { deleted_by = null } = {}) {
    const cid = toNumOrNull(customerId);
    const aid = toNumOrNull(attachmentId);
    if (!cid || !aid) return null;

    const { rows } = await pool.query(
        `UPDATE ${TB}
        SET is_active = FALSE,
            deleted_at = NOW(),
            deleted_by = $3,
            updated_at = NOW()
      WHERE customer_id = $1
        AND attachment_id = $2
        AND is_active = TRUE
      RETURNING *`,
        [cid, aid, toIdOrNull(deleted_by)]
    );

    return rows[0] ?? null;
}

export default {
    ATTACHMENT_CATEGORIES,
    normalizeAttachmentCategory,
    customerExists,
    insertAttachment,
    listByCustomer,
    findActiveAttachment,
    softDeleteAttachment,
};
