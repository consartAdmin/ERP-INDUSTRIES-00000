// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ mobilizedRoutes.js — Routes (Express • ESM)                                ║
// ║ Path: backend/routes/mobilizedRoutes.js                                    ║
// ║ Base: /api/mobilized                                                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import * as c from '../controllers/mobilizedController.js';

const router = Router();

/* Mobilized */
router.get('/', c.list);
router.post('/', c.create);

/* PDF ALL — keep before parameterized routes */
router.get('/pdf/all', c.downloadAllPdf);

/* Items */
router.get('/:id/items', c.listItems);
router.post('/:id/items', c.addItem);
router.put('/items/:itemId', c.updateItem);
router.delete('/items/:itemId', c.removeItem);

/* Attachments */
router.get('/:id/attachments', c.listAttachments);
router.post('/:id/attachments', c.uploadAttachmentMiddleware, c.uploadAttachment);
router.post(
    '/:id/items/:itemId/attachments',
    c.uploadAttachmentMiddleware,
    c.uploadItemAttachment
);
router.patch('/:id/attachments/:attachmentId/primary', c.setPrimaryAttachment);
router.delete('/:id/attachments/:attachmentId', c.removeAttachment);

/* PDF */
router.post('/:id/pdf/upload', c.uploadPdfMiddleware, c.uploadPdf);
router.get('/:id/pdf', c.downloadPdf);
router.post('/:id/pdf/generate-upload', c.generateAndUploadPdf);

/* Mobilized CRUD */
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

export default router;

