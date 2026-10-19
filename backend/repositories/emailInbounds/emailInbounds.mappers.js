// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInbounds.mappers.js — Linha do banco → objeto (attachments_meta)║
// ╚════════════════════════════════════════════════════════════════════╝

import { safeJsonArrayParse } from './emailInbounds.utils.js';

export function normalizeRow(row) {
  if (!row) return null;

  if (row.attachments_meta == null) {
    row.attachments_meta = [];
  }

  if (typeof row.attachments_meta === 'string') {
    row.attachments_meta = safeJsonArrayParse(row.attachments_meta) || [];
  }

  if (!Array.isArray(row.attachments_meta)) {
    row.attachments_meta = [];
  }

  return row;
}
