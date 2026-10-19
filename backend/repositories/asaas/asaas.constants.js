// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaas.constants.js — Caminhos locais de boletos (public/boletos)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------------------------------------------------------------------- */
/* Paths (ESM)                                                            */
/* ---------------------------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Este arquivo está em: backend/repositories/asaas/...  -> ../../public = backend/public
export const PUBLIC_DIR = path.resolve(__dirname, '../../public');
export const BOLETOS_DIR = path.resolve(PUBLIC_DIR, 'boletos');
