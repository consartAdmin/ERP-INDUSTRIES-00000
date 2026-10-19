// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImages.constants.js — Diretórios públicos e logo              ║
// ╚════════════════════════════════════════════════════════════════════╝

import path from 'path';
import { fileURLToPath } from 'url';

// backend/public (servida em /public), relativo a este arquivo — não ao cwd
export const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
export const PROMO_DIR = path.join(PUBLIC_DIR, 'promocoes');
export const LOGO_PATH = path.join(PUBLIC_DIR, 'imagens', 'logo-bh3.png');
