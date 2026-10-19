// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsRoutes.js — Routes (Inbounds via DB) — CONSART ERP      ║
// ║ Base mount: app.use('/api/email', emailInboundsRoutes)               ║
// ║ Endpoints finais:                                                    ║
// ║   GET    /api/email/inbounds                                         ║
// ║   GET    /api/email/inbounds/unread-count                            ║
// ║   PATCH  /api/email/inbounds/:id/read                                ║
// ║   GET    /api/email/inbounds/:id                                     ║
// ║   DELETE /api/email/inbounds                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listInboundsHandler,
  getInboundByIdHandler,
  clearInboundsHandler,

  // ✅ NOVOS
  unreadCountHandler,
  markInboundAsReadHandler,
} from '../controllers/emailInboundsHttpController.js';

const router = Router();

// ✅ LIST
router.get('/inbounds', listInboundsHandler);

// ✅ IMPORTANT: static routes MUST come before "/:id"
router.get('/inbounds/unread-count', unreadCountHandler);
router.patch('/inbounds/:id/read', markInboundAsReadHandler);

// ✅ GET BY ID (keep AFTER unread-count)
router.get('/inbounds/:id', getInboundByIdHandler);

// ✅ CLEAR
router.delete('/inbounds', clearInboundsHandler);

export default router;
