/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ pdv_loginsRoutes.js — Rotas dos usuários do PDV                     ║
   ║ CONSART ERP                                                          ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Router } from 'express';
import {
  listPdvLogins,
  getPdvLoginById,
  createPdvLogin,
  updatePdvLogin,
  changePdvLoginStatus,
  deletePdvLogin,
  authenticatePdvLogin,
} from '../controllers/pdv_loginsController.js';

const router = Router();

// POST /api/pdv-logins/authenticate
router.post('/authenticate', authenticatePdvLogin);

// GET /api/pdv-logins?search=&role=&active=&page=1&limit=50
router.get('/', listPdvLogins);

// GET /api/pdv-logins/:id
router.get('/:id', getPdvLoginById);

// POST /api/pdv-logins
router.post('/', createPdvLogin);

// PUT /api/pdv-logins/:id
router.put('/:id', updatePdvLogin);

// PATCH /api/pdv-logins/:id/status
router.patch('/:id/status', changePdvLoginStatus);

// DELETE /api/pdv-logins/:id
router.delete('/:id', deletePdvLogin);

export default router;
