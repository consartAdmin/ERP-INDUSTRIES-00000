// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transportersRoutes.js                                               ║
// ║ Routes — Transporters                                               ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import multer from 'multer';
import controller from '../controllers/transportersController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

router.get('/', controller.list);

router.get('/:id/attachments', controller.listAttachments);
router.post('/:id/attachments', upload.single('file'), controller.uploadAttachment);
router.delete('/:id/attachments/:attachmentId', controller.deleteAttachment);

router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;