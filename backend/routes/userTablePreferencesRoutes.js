// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferencesRoutes.js — /api/user-table-preferences          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getPreferences,
  savePreferences,
  resetPreferences,
} from '../controllers/userTablePreferencesController.js';

const router = Router();

router.get('/:tableKey', requireAuth, getPreferences);
router.put('/:tableKey', requireAuth, savePreferences);
router.delete('/:tableKey', requireAuth, resetPreferences);

export default router;
