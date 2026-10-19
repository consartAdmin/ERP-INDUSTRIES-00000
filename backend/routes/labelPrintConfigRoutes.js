// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfigRoutes.js — Routes Label Print Config               ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Base: full path routes /api/label-print-config                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';

import {
  getLabelConfig,
  updateLabelConfig,
  resetLabelConfig,
} from '../controllers/labelPrintConfigController.js';

const router = express.Router();

router.get('/api/label-print-config', getLabelConfig);
router.put('/api/label-print-config', updateLabelConfig);
router.post('/api/label-print-config/reset', resetLabelConfig);

export default router;