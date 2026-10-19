// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscais.constants.js — Diretórios públicos XML/PDF + log  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ───────────────────────────────────────────────────────────────────────────
// Setup ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// /backend/repositories/painelNotasFiscais -> sobe 2 níveis até /backend
// (mesma profundidade do antigo /backend/services/apis)
export const BACKEND_DIR = path.resolve(__dirname, '..', '..');
export const PUBLIC_DIR = path.join(BACKEND_DIR, 'public');

export const XML_SUBDIR = 'painelNotasFiscais/xmlAntigasBh3';
export const PDF_SUBDIR = 'painelNotasFiscais/pdf';

export const XML_DIR = path.join(PUBLIC_DIR, XML_SUBDIR);
export const PDF_DIR = path.join(PUBLIC_DIR, PDF_SUBDIR);

export const LOG_ON = String(process.env.NFE_PAINEL_LOG || '0') === '1';
