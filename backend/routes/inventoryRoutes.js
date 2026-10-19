// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: inventoryRoutes.js                                            ║
// ║ MODULE: Inventory                                                   ║
// ║ DESCRIPTION: Rotas REST do módulo de inventário                     ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Mount no server.js: app.use('/api/inventories', inventoryRoutes)    ║
// ║                                                                      ║
// ║ ✅ CRUD de inventários                                               ║
// ║ ✅ CRUD de itens do inventário                                       ║
// ║ ✅ Finalização / reabertura                                          ║
// ║ ✅ Logs / auditoria                                                  ║
// ║ ✅ Importação XLS/XLSX com multer                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

import {
  listInventories,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
  listInventoryItems,
  upsertInventoryItem,
  deleteInventoryItem,
  finalizeInventory,
  listLogs,
  reopenInventory,
  importInventoryXls,
  downloadInventoryReportPdf,
} from '../controllers/inventoryController.js';

const router = Router();

/* ========================================================================== */
/* Upload config                                                              */
/* ========================================================================== */

const uploadsDir = path.resolve('uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path
      .basename(file.originalname || 'inventory-import', ext)
      .replace(/[^\w\-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    cb(null, `${Date.now()}-${base || 'inventory-import'}${ext}`);
  },
});

const allowedMimeTypes = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

const allowedExtensions = new Set(['.xls', '.xlsx']);

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();

    const extOk = allowedExtensions.has(ext);
    const mimeOk = allowedMimeTypes.has(mime);

    if (extOk || mimeOk) {
      return cb(null, true);
    }

    return cb(new Error('Apenas arquivos .xls ou .xlsx são permitidos.'));
  },
});

/* ========================================================================== */
/* Inventories                                                                */
/* ========================================================================== */

// Lista inventários
router.get('/', listInventories);

// Cria inventário
router.post('/', createInventory);

router.get('/:id/report-pdf', downloadInventoryReportPdf);

// Busca inventário por ID
router.get('/:id', getInventoryById);

// Atualiza inventário
router.put('/:id', updateInventory);

// Exclui inventário
router.delete('/:id', deleteInventory);

/* ========================================================================== */
/* Importação XLS/XLSX                                                        */
/* ========================================================================== */

// Importa planilha para inventário existente ou cria novo inventário
router.post('/import-xls', upload.single('file'), importInventoryXls);

/* ========================================================================== */
/* Items                                                                      */
/* ========================================================================== */

// Lista itens de um inventário
router.get('/:id/items', listInventoryItems);

// Adiciona / atualiza item no inventário
router.post('/:id/items', upsertInventoryItem);

// Remove item do inventário
router.delete('/:id/items/:itemId', deleteInventoryItem);

/* ========================================================================== */
/* Workflow                                                                   */
/* ========================================================================== */

// Reabre inventário
router.post('/:id/reopen', reopenInventory);

// Finaliza inventário
router.post('/:id/finalize', finalizeInventory);

// Lista logs/auditoria do inventário
router.get('/:id/logs', listLogs);

export default router;