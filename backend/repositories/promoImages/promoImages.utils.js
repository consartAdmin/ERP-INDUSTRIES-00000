// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImages.utils.js — Diretórios, moeda e caminho de imagens      ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { PUBLIC_DIR } from './promoImages.constants.js';
import { safeText } from './promoImages.sanitizers.js';

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function moneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function normalizeImageUrl(row = {}) {
  return (
    row.image_url ||
    row.url ||
    row.path ||
    row.file_path ||
    row.image_path ||
    row.imagem ||
    row.foto ||
    row.src ||
    ''
  );
}

export function resolvePublicImagePath(imageUrl) {
  const raw = safeText(imageUrl);
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  const cleaned = raw.replace(/^\/+/, '');

  const candidates = [
    path.resolve(process.cwd(), raw),
    path.resolve(process.cwd(), cleaned),
    path.join(PUBLIC_DIR, cleaned.replace(/^public[\\/]/, '')),
    path.join(PUBLIC_DIR, cleaned.replace(/^backend[\\/]public[\\/]/, '')),
  ];

  return candidates.find((p) => fs.existsSync(p)) || null;
}
