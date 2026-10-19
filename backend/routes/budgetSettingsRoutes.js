// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettingsRoutes.js — Rotas dos parâmetros dos Orçamentos      ║
// ║ CONSART ERP | Express | ESM                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createBudgetSettingsController } from '../controllers/budgetSettingsController.js';

const router = express.Router();
const controller = createBudgetSettingsController(pool);

function noCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return next();
}

router.get('/', requireAuth, noCache, controller.get);
router.put('/', requireAuth, noCache, controller.update);

export default router;
