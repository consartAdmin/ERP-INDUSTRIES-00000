// ╔══════════════════════════════════════════════════════════════════════╗
// ║ manufacturersRoutes.js — Rotas HTTP de Fabricantes (CONSART ERP)    ║
// ║ ESM + Express.Router                                                 ║
// ║                                                                      ║
// ║ Rotas-base (montadas em /api no server.js):                          ║
// ║   • /products-manufacturers                                          ║
// ║   • /manufacturers (alias)                                           ║
// ║   • /fabricantes (alias)                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import manufacturersController from '../controllers/manufacturersController.js';

const router = Router();

// ---------------------------------------------------------------------------
// ROTA PRINCIPAL — compatível com editProducts.js
// ROUTES.fabricantes: [
//   `${API_BASE}/api/products-manufacturers`,
//   `${API_BASE}/api/manufacturers`,
//   `${API_BASE}/api/fabricantes`,
// ]
// ---------------------------------------------------------------------------

// LIST
router.get(
  '/products-manufacturers',
  manufacturersController.listManufacturers,
);

// GET BY ID
router.get(
  '/products-manufacturers/:id',
  manufacturersController.getManufacturer,
);

// CREATE
router.post(
  '/products-manufacturers',
  manufacturersController.createManufacturer,
);

// UPDATE
router.put(
  '/products-manufacturers/:id',
  manufacturersController.updateManufacturer,
);

// DELETE (soft delete)
router.delete(
  '/products-manufacturers/:id',
  manufacturersController.deleteManufacturer,
);

// ---------------------------------------------------------------------------
// ALIAS /manufacturers (mesmos handlers, p/ compatibilidade futura)
// ---------------------------------------------------------------------------
router.get(
  '/manufacturers',
  manufacturersController.listManufacturers,
);
router.get(
  '/manufacturers/:id',
  manufacturersController.getManufacturer,
);
router.post(
  '/manufacturers',
  manufacturersController.createManufacturer,
);
router.put(
  '/manufacturers/:id',
  manufacturersController.updateManufacturer,
);
router.delete(
  '/manufacturers/:id',
  manufacturersController.deleteManufacturer,
);

// ---------------------------------------------------------------------------
// ALIAS /fabricantes (português)
// ---------------------------------------------------------------------------
router.get(
  '/fabricantes',
  manufacturersController.listManufacturers,
);
router.get(
  '/fabricantes/:id',
  manufacturersController.getManufacturer,
);
router.post(
  '/fabricantes',
  manufacturersController.createManufacturer,
);
router.put(
  '/fabricantes/:id',
  manufacturersController.updateManufacturer,
);
router.delete(
  '/fabricantes/:id',
  manufacturersController.deleteManufacturer,
);

export default router;
