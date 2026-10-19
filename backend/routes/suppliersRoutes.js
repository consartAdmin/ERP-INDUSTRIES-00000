// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersRoutes.js                                                 ║
// ║ HTTP Routes — Suppliers                                            ║
// ║ CONSART ERP | Express | ESM                                        ║
// ║                                                                    ║
// ║ Endpoints:                                                         ║
// ║   GET    /suppliers                                                ║
// ║   GET    /suppliers/search                                         ║
// ║   GET    /suppliers/export/excel                                   ║
// ║   GET    /suppliers/export/pdf                                     ║
// ║   GET    /suppliers/:id                                            ║
// ║   POST   /suppliers                                                ║
// ║   PUT    /suppliers/:id                                            ║
// ║   DELETE /suppliers/:id                                            ║
// ║                                                                    ║
// ║ Attachments:                                                       ║
// ║   GET    /suppliers/:id/attachments                                ║
// ║   POST   /suppliers/:id/attachments                                ║
// ║   DELETE /suppliers/:id/attachments/:attachmentId                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import multer from 'multer';
import suppliersController from '../controllers/suppliersController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/suppliers', suppliersController.list);
router.get('/suppliers/search', suppliersController.search);
router.get('/suppliers/export/excel', suppliersController.exportExcel);
router.get('/suppliers/export/pdf', suppliersController.exportPdf);
router.get('/suppliers/:id/attachments', suppliersController.listAttachments);
router.post('/suppliers/:id/attachments', upload.single('file'), suppliersController.uploadAttachment);
router.delete('/suppliers/:id/attachments/:attachmentId', suppliersController.deleteAttachment);
router.get('/suppliers/:id', suppliersController.getById);
router.post('/suppliers', suppliersController.create);
router.put('/suppliers/:id', suppliersController.update);
router.delete('/suppliers/:id', suppliersController.remove);

export default router;
