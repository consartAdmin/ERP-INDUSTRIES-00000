// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesRoutes.js — Routes — CONSART ERP                         ║
// ║ Path: backend/routes/expenseEntriesRoutes.js                           ║
// ║ Base: /api/expense-entries                                            ║
// ║ + POST /import-xml (multipart)                                        ║
// ║ + POST /:id/post  (gera accountsPayable)                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import multer from 'multer';
import { expenseEntriesController } from '../controllers/expenseEntriesController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

/**
 * IMPORT XML (NF-e)
 * POST /api/expense-entries/import-xml
 * multipart/form-data: field "xml" (file)
 */
router.post('/import-xml', upload.single('xml'), expenseEntriesController.importXml);

/**
 * POSTAR / FINALIZAR
 * POST /api/expense-entries/:id/post
 * body: { dueDate?: 'YYYY-MM-DD' }
 */
router.post('/:id/post', expenseEntriesController.post);

/**
 * LIST
 * GET /api/expense-entries?page=1&pageSize=20&q=...&status=OPEN&dateFrom=2026-01-01&dateTo=2026-01-31
 */
router.get('/', expenseEntriesController.list);

/**
 * GET BY ID
 * GET /api/expense-entries/:id
 */
router.get('/:id', expenseEntriesController.getById);

/**
 * CREATE
 * POST /api/expense-entries
 */
router.post('/', expenseEntriesController.create);

/**
 * UPDATE
 * PUT /api/expense-entries/:id
 */
router.put('/:id', expenseEntriesController.update);

/**
 * CANCEL (soft)
 * PATCH /api/expense-entries/:id/cancel
 */
router.patch('/:id/cancel', expenseEntriesController.cancel);

/**
 * DELETE (hard)
 * DELETE /api/expense-entries/:id
 */
router.delete('/:id', expenseEntriesController.remove);

export default router;
