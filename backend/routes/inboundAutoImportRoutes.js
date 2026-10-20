/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ inboundAutoImportRoutes.js — NF-e Inbox → Inbound (auto-import) ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import { ensureInboundRawSupport } from '../repositories/pcp/pcpInbound.repository.js';
import { autoImportFromDfe } from '../controllers/inboundAutoImportController.js';

const router = Router();

// Prodnex PCP: garante (uma vez) a coluna raw_material_id dos itens e as tabelas de
// matérias-primas antes de qualquer transação das notas de entrada.
async function ensureRawSupport(_req, _res, next) {
  try {
    await ensureInboundRawSupport();
  } catch (err) {
    console.error('[PCP][INBOUND] ensureInboundRawSupport:', err?.message);
  }
  next();
}

// POST /api/inbound/auto-from-dfe?accessKey=...
router.post('/api/inbound/auto-from-dfe', ensureRawSupport, autoImportFromDfe);

export default router;