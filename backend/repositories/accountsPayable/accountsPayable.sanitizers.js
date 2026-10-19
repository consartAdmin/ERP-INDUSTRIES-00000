// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.sanitizers.js — Normalização de texto / arquivos   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeAttachmentType(value) {
  return String(value || 'OUTRO').trim().toUpperCase();
}

export function toStrOrNull(value) {
  if (value === '' || value == null) return null;
  return String(value).trim() || null;
}

export function safeFileName(value) {
  const original = String(value || 'arquivo').trim();
  const base = original.split('/').pop().split('\\').pop();

  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._() -]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'arquivo';
}

export function safeSlug(value) {
  return String(value || 'DOCUMENTO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'DOCUMENTO';
}
