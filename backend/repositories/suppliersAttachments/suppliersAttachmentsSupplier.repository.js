// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachmentsSupplier.repository.js — Fornecedor: pasta,    ║
// ║ caminho no storage e existência                                    ║
// ║ Tabela: public."suppliers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SUPPLIERS_TABLE } from './suppliersAttachments.constants.js';
import { slugify, sanitizeFileName } from './suppliersAttachments.sanitizers.js';

export async function getSupplierFolderName(supplierId) {
  const { rows } = await pool.query(
    `
      SELECT
        supplier_id,
        name
      FROM ${SUPPLIERS_TABLE}
      WHERE supplier_id = $1
      LIMIT 1
    `,
    [supplierId]
  );

  const supplier = rows[0];

  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  return slugify(supplier.name || `SUPPLIER-${supplier.supplier_id}`);
}

export async function makeStoragePath(supplierId, originalName) {
  const folderName = await getSupplierFolderName(supplierId);
  const safeName = sanitizeFileName(originalName);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  return `suppliers/${folderName}/attachments/${stamp}_${safeName}`;
}

export async function ensureSupplierExists(supplierId) {
  const { rows } = await pool.query(
    `
      SELECT supplier_id
      FROM ${SUPPLIERS_TABLE}
      WHERE supplier_id = $1
      LIMIT 1
    `,
    [supplierId]
  );

  if (!rows[0]) {
    throw new Error('Supplier not found.');
  }
}
