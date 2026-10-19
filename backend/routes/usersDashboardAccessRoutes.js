// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersDashboardAccessRoutes.js — Dashboard access permission routes  ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';

import {
  listDashboardAccessByUser,
  getDashboardAccessByUserAndKey,
  saveDashboardAccess,
  replaceDashboardAccessByUser,
  removeDashboardAccess,
  removeAllDashboardAccess,
} from '../controllers/usersDashboardAccessController.js';

const router = Router();

router.use(requireAuth);

// GET /api/users-dashboard-access/:userId
router.get(
  '/:userId',
  listDashboardAccessByUser
);

// GET /api/users-dashboard-access/:userId/:dashboardKey
router.get(
  '/:userId/:dashboardKey',
  getDashboardAccessByUserAndKey
);

// PUT /api/users-dashboard-access/:userId
// Body:
// {
//   "dashboardKey": "daily-sales",
//   "canView": true
// }
router.put(
  '/:userId',
  saveDashboardAccess
);

// PUT /api/users-dashboard-access/:userId/all
// Body:
// {
//   "dashboards": [
//     { "dashboardKey": "daily-sales", "canView": true },
//     { "dashboardKey": "monthly-sales", "canView": false }
//   ]
// }
router.put(
  '/:userId/all',
  replaceDashboardAccessByUser
);

// DELETE /api/users-dashboard-access/:userId/:dashboardKey
router.delete(
  '/:userId/:dashboardKey',
  removeDashboardAccess
);

// DELETE /api/users-dashboard-access/:userId
router.delete(
  '/:userId',
  removeAllDashboardAccess
);

export default router;
