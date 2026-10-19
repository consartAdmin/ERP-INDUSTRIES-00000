// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParametersRoutes.js — Express Routes (ESM)                     ║
// ║ CONSART ERP — /api/label-parameters endpoints                       ║
// ║ UPDATE: visual label parameter routes + prices helper               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  listLabelParameters,
  getLabelParametersById,
  createLabelParameters,
  updateLabelParameters,
  deleteLabelParameters,
  listPriceTables,
} from '../controllers/labelParametersController.js';

const router = express.Router();

// IMPORTANT: specific route first
router.get('/api/label-parameters/prices', listPriceTables);

// Base path: /api/label-parameters
router.get('/api/label-parameters', listLabelParameters);
router.get('/api/label-parameters/:id', getLabelParametersById);
router.post('/api/label-parameters', createLabelParameters);
router.put('/api/label-parameters/:id', updateLabelParameters);
router.delete('/api/label-parameters/:id', deleteLabelParameters);

export default router;