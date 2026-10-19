// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailAccountsRoutes.js — Routes Email Accounts (ESM)                  ║
// ║ Base: /api/email/accounts                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listEmailAccountsHandler,
  getEmailAccountByIdHandler,
  createEmailAccountHandler,
  updateEmailAccountHandler,
  deactivateEmailAccountHandler,

    // ✅ NOVO
  listEmailAccountsWithUnreadHandler,
} from '../controllers/emailAccountsController.js';

const router = Router();

router.get('/with-unread', listEmailAccountsWithUnreadHandler);
router.get('/', listEmailAccountsHandler);
router.get('/:id', getEmailAccountByIdHandler);
router.post('/', createEmailAccountHandler);
router.put('/:id', updateEmailAccountHandler);
router.delete('/:id', deactivateEmailAccountHandler);

export default router;
