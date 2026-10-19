// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailInboxRoutes.js — Rotas Inbox/Sent (E-mail)                      ║
// ║ CONSART ERP — Protegido por JWT (requireAuth)                        ║
// ║ Endpoints:                                                           ║
// ║   GET  /api/email/inbox                                              ║
// ║   GET  /api/email/sent                                               ║
// ║   GET  /api/email/:folder/:id                                        ║
// ║   POST /api/email/send                                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  listInbox,
  listSent,
  getMessageById,
  sendEmail,
} from '../controllers/emailInboxController.js';

const router = Router();

/* ╔══════════════════════════════════════════════════════════╗
   ║ 📥 Inbox (Recebidos)                                    ║
   ╚══════════════════════════════════════════════════════════╝ */
router.get('/inbox', requireAuth, listInbox);

/* ╔══════════════════════════════════════════════════════════╗
   ║ 📤 Sent (Enviados)                                      ║
   ╚══════════════════════════════════════════════════════════╝ */
router.get('/sent', requireAuth, listSent);

/* ╔══════════════════════════════════════════════════════════╗
   ║ 📄 Detalhes do e-mail (Inbox ou Sent)                    ║
   ╚══════════════════════════════════════════════════════════╝ */
router.get('/:folder/:id', requireAuth, getMessageById);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ✉️ Enviar e-mail                                        ║
   ╚══════════════════════════════════════════════════════════╝ */
router.post('/send', requireAuth, sendEmail);

export default router;