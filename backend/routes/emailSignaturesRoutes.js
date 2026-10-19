  // ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesRoutes.js — Rotas HTTP de Assinaturas de E-mail      ║
// ║ Base: /api/email/signatures                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listSignatures,
  getSignatureById,
  getDefaultSignature,
  createSignature,
  updateSignature,
  setDefaultSignature,
  deleteSignature
} from '../controllers/emailSignaturesController.js';

const router = Router();

// GET /api/email/signatures?ownerUserId=1 | null | all
router.get('/', listSignatures);

// GET /api/email/signatures/default?ownerUserId=1 | null
router.get('/default', getDefaultSignature);

// GET /api/email/signatures/:id
router.get('/:id', getSignatureById);

// POST /api/email/signatures
router.post('/', createSignature);

// PUT /api/email/signatures/:id
router.put('/:id', updateSignature);

// POST /api/email/signatures/:id/default
router.post('/:id/default', setDefaultSignature);

// DELETE /api/email/signatures/:id
router.delete('/:id', deleteSignature);

export default router;
