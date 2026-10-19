// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachments.constants.js — Tabelas e bucket GCS           ║
// ╚════════════════════════════════════════════════════════════════════╝

export const SUPPLIERS_TABLE = 'public."suppliers"';
export const ATTACHMENTS_TABLE = 'public."suppliersAttachments"';

export const BUCKET_NAME =
  process.env.GCS_BUCKET ||
  process.env.GOOGLE_CLOUD_BUCKET ||
  process.env.STORAGE_BUCKET ||
  'erp-infinity-00000';
