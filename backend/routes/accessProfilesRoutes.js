// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfilesRoutes.js — Rotas REST do cadastro de perfis          ║
// ║ Mount: app.use('/api/access-profiles', accessProfilesRoutes);       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';

import {
  listAccessProfiles,
  getAccessProfile,
  createAccessProfile,
  updateAccessProfile,
  deleteAccessProfile,
} from '../controllers/accessProfilesController.js';

const router = Router();

router.use(requireAuth);

// GET /api/access-profiles?onlyActive=1&search=texto
router.get('/', listAccessProfiles);

// GET /api/access-profiles/:id
router.get('/:id', getAccessProfile);

// POST /api/access-profiles
router.post('/', createAccessProfile);

// PUT /api/access-profiles/:id
router.put('/:id', updateAccessProfile);

// DELETE /api/access-profiles/:id
router.delete('/:id', deleteAccessProfile);

export default router;
