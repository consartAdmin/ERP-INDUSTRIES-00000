// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesEmail.constants.js — Tabela ponte Asaas e caminhos (ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// -------------------------------
// Constants / paths (ESM)
// -------------------------------
export const TB_AR_ASAAS = 'public."accountsReceivableAsaas"';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Este arquivo está em backend/repositories/nfesEmail/ (mesma profundidade
// do antigo backend/services/apis/). Então ../../public -> backend/public
export const PUBLIC_DIR = path.resolve(__dirname, '../../public');
