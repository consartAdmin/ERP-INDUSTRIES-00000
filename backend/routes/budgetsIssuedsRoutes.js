// backend/routes/budgetsIssuedsRoutes.js

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getBudgetNfePreviewPdf,
  issueBudgetNfeController,
  reconcileBudgetNfeController,
  getBudgetNfeXmlController,
  getBudgetNfeDanfeController,
} from '../controllers/budgetsIssuedsController.js';

const router = Router();

router.get(
  '/:budgetId/nfe-preview.pdf',
  requireAuth,
  getBudgetNfePreviewPdf,
);

router.post(
  '/:budgetId/issue',
  requireAuth,
  issueBudgetNfeController,
);

router.get(
  '/:budgetId/status',
  requireAuth,
  reconcileBudgetNfeController,
);

router.get(
  '/:budgetId/xml',
  requireAuth,
  getBudgetNfeXmlController,
);

router.get(
  '/:budgetId/danfe.pdf',
  requireAuth,
  getBudgetNfeDanfeController,
);

export default router;
