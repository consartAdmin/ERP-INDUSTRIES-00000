// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccountsRoutes.js — Routes userEmailAccounts               ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listUserEmailAccounts,
  getUserEmailAccountById,
  getUserEmailAccountsByUser,
  getUserEmailAccountsByEmailAccount,
  createUserEmailAccount,
  updateUserEmailAccount,
  deleteUserEmailAccount,
} from '../controllers/userEmailAccountsController.js';

const router = Router();

// Listagem geral com filtros
router.get('/', listUserEmailAccounts);

// Buscar por usuário
router.get('/user/:userId', getUserEmailAccountsByUser);

// Buscar por conta de email
router.get('/email-account/:emailAccountId', getUserEmailAccountsByEmailAccount);

// Buscar por ID
router.get('/:id', getUserEmailAccountById);

// Criar vínculo
router.post('/', createUserEmailAccount);

// Atualizar vínculo
router.put('/:id', updateUserEmailAccount);

// Excluir vínculo
router.delete('/:id', deleteUserEmailAccount);

export default router;