// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerRoutes.js — Express Routes (SellerForCustomer)     ║
// ║ CONSART ERP · Mounts /api/seller-for-customer endpoints             ║
// ║ - ✅ Rotas fixas antes do "/:id" (evita conflito com "bulk")         ║
// ║ - ✅ /ping também antes do "/:id"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import sellerForCustomerController from '../controllers/sellerForCustomerController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

/* =========================================================================
   FIXED ROUTES (must come BEFORE "/:id")
   ========================================================================= */

// Health
router.get('/seller-for-customer/ping', sellerForCustomerController.ping);



/* =========================================================================
   BASE LIST + HELPERS
   ========================================================================= */

// List with filters/pagination
router.get('/seller-for-customer', sellerForCustomerController.list);

// Helpers
router.get(
  '/seller-for-customer/by-seller/:sellerId',
  sellerForCustomerController.listCustomersBySeller
);

router.get(
  '/seller-for-customer/by-customer/:customerId',
  sellerForCustomerController.listSellersByCustomer
);

/* =========================================================================
   CRUD
   ========================================================================= */

// Create
router.post('/seller-for-customer', sellerForCustomerController.create);

// Get by id (must come AFTER fixed routes)
router.get('/seller-for-customer/:id', sellerForCustomerController.getById);

// Update / Delete
router.put('/seller-for-customer/:id', sellerForCustomerController.update);
router.delete('/seller-for-customer/:id', sellerForCustomerController.remove);

export default router;
