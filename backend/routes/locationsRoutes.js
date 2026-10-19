// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsRoutes.js — Warehouse Locations Routes (Express | ESM)      ║
// ║ Base path: /api/locations                                           ║
// ║ ✅ UPDATE: adiciona GET /map para buscar mapa completo de localização ║
// ║ ✅ Mantém PATCH /product-locations/:id/deactivate                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  // Locals
  listLocals,
  createLocal,
  updateLocal,
  deleteLocal,

  // Corridors
  listCorridors,
  createCorridor,

  // Shelves
  listShelves,
  createShelf,

  // Bins
  listBins,
  createBin,

  // Positions
  listPositions,
  createPosition,

  // Location Map
  listLocationMap,

  // Product locations
  listProductLocations,
  createProductLocation,
  updateProductLocation,
  deactivateProductLocation,
  setPrimaryProductLocation,
  deleteProductLocation,
} from '../controllers/locationsController.js';

const router = express.Router();

/* --------------------------------------------------------------------- */
/* 1) Locals                                                             */
/* --------------------------------------------------------------------- */

router.get('/locals', listLocals);
router.post('/locals', createLocal);
router.put('/locals/:id', updateLocal);
router.delete('/locals/:id', deleteLocal);

/* --------------------------------------------------------------------- */
/* 2) Corridors                                                          */
/* --------------------------------------------------------------------- */

router.get('/corridors', listCorridors);
router.post('/corridors', createCorridor);

/* --------------------------------------------------------------------- */
/* 3) Shelves                                                            */
/* --------------------------------------------------------------------- */

router.get('/shelves', listShelves);
router.post('/shelves', createShelf);

/* --------------------------------------------------------------------- */
/* 4) Bins                                                               */
/* --------------------------------------------------------------------- */

router.get('/bins', listBins);
router.post('/bins', createBin);

/* --------------------------------------------------------------------- */
/* 5) Positions                                                          */
/* --------------------------------------------------------------------- */

router.get('/positions', listPositions);
router.post('/positions', createPosition);

/* --------------------------------------------------------------------- */
/* 5.1) Location Map — estrutura completa do estoque                      */
/* --------------------------------------------------------------------- */
// GET /api/locations/map?q=&corredor=&prateleira=&bandeja=&onlyActive=true
router.get('/map', listLocationMap);

/* --------------------------------------------------------------------- */
/* 6) Product locations (public."productsLocations")                      */
/* --------------------------------------------------------------------- */

router.get('/product-locations', listProductLocations);
router.post('/product-locations', createProductLocation);
router.put('/product-locations/:id', updateProductLocation);
router.patch('/product-locations/:id/deactivate', deactivateProductLocation);
router.patch('/product-locations/:id/primary', setPrimaryProductLocation);
router.delete('/product-locations/:id', deleteProductLocation);

export default router;