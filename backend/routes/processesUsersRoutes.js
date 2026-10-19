// ╔══════════════════════════════════════════════════════════════════════╗
// ║ processesUsersRoutes.js — Rotas REST Permissões — /api/processes-users║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from '../controllers/processesUsersController.js';

const router = express.Router();

// GET /api/processes-users
router.get('/', listPermissions);

// POST /api/processes-users
router.post('/', createPermission);

// PUT /api/processes-users/:id
router.put('/:id', updatePermission);

// DELETE /api/processes-users/:id
router.delete('/:id', deletePermission);

export default router;
