// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachments.sanitizers.js — slug, nome de arquivo e IDs   ║
// ╚════════════════════════════════════════════════════════════════════╝

import path from 'node:path';

export function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
    .toUpperCase();
}

export function sanitizeFileName(fileName = 'attachment') {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);

  const cleanBase = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  const cleanExt = ext
    .replace(/[^a-zA-Z0-9.]/g, '')
    .slice(0, 20);

  return `${cleanBase || 'attachment'}${cleanExt}`;
}

export function validateSupplierId(id) {
  const supplierId = Number(id);

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('Invalid supplier ID.');
  }

  return supplierId;
}

export function validateAttachmentId(id) {
  const attachmentId = Number(id);

  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new Error('Invalid attachment ID.');
  }

  return attachmentId;
}
