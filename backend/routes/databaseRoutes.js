// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/routes/databaseRoutes.js                              ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ║ 🔐 Todas as rotas exigem login + perfil administrador                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

import {
  listDatabaseTables,
  getDatabaseTableColumns,
  getDatabaseTableRows,
  createDatabaseRow,
  updateDatabaseRow,
  deleteDatabaseRow,
  getDatabaseTableStructure,
  previewDatabaseStructureChange,
  applyDatabaseStructureChange,
} from '../controllers/databaseController.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/tables', listDatabaseTables);
router.get('/tables/:table/columns', getDatabaseTableColumns);
router.get('/tables/:table/rows', getDatabaseTableRows);

router.post('/tables/:table/rows', createDatabaseRow);
router.put('/tables/:table/rows', updateDatabaseRow);
router.delete('/tables/:table/rows', deleteDatabaseRow);

router.get('/tables/:table/structure', getDatabaseTableStructure);
router.post('/tables/:table/structure/preview', previewDatabaseStructureChange);
router.post('/tables/:table/structure/apply', applyDatabaseStructureChange);

export default router;
