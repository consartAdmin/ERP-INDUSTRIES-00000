// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCodeRoutes.js — Routes Locations BarCode                ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Base suggested: /api/locations-barcode                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  listLocationsBarCode,
  getLocationsBarCodeById,
  readLocationsBarCode,
  createLocationsBarCode,
  updateLocationsBarCode,
  deactivateLocationsBarCode,
  deleteLocationsBarCode,
  generateLocationsBarCodeBins,
} from '../controllers/locationsBarCodeController.js';

const router = Router();

router.get('/', listLocationsBarCode);

router.get('/read/:barcode', readLocationsBarCode);
router.get('/barcode/:barcode', readLocationsBarCode);

router.post('/generate-bins', generateLocationsBarCodeBins);

router.get('/:id', getLocationsBarCodeById);
router.post('/', createLocationsBarCode);
router.put('/:id', updateLocationsBarCode);
router.patch('/:id/deactivate', deactivateLocationsBarCode);
router.delete('/:id', deleteLocationsBarCode);

export default router;