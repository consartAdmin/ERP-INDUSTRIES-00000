// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ sellerByUserRoutes.js — Routes (Usuário x Vendedor) | CONSART ERP           ║
// ║ Base: /api/seller-by-user                                                   ║
// ║ ESM • Express Router                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  init,
  listSellerByUser,
  getSellerByUserById,
  listSellerByUserByUser,
  createSellerByUser,
  updateSellerByUser,
  removeSellerByUser,
  toggleSellerByUserActive,
  setSellerByUserPrimary,
} from '../controllers/sellerByUserController.js';

const router = Router();

/* --------------------------------------------------------------------- */
/* Infra / health                                                         */
/* --------------------------------------------------------------------- */
router.get('/init', init);

/* --------------------------------------------------------------------- */
/* Listagens                                                              */
/* --------------------------------------------------------------------- */
router.get('/', listSellerByUser);
router.get('/user/:userId', listSellerByUserByUser);

/* --------------------------------------------------------------------- */
/* CRUD                                                                   */
/* --------------------------------------------------------------------- */
router.get('/:id', getSellerByUserById);
router.post('/', createSellerByUser);
router.put('/:id', updateSellerByUser);
router.delete('/:id', removeSellerByUser);

/* --------------------------------------------------------------------- */
/* Helpers                                                                */
/* --------------------------------------------------------------------- */
router.patch('/:id/active', toggleSellerByUserActive);
router.patch('/user/:userId/:id/primary', setSellerByUserPrimary);

export default router;
