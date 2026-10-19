// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfileRoutes.js — Rotas REST para public."usersProfile"        ║
// ║ Mount: app.use('/api/users-profile', usersProfileRoutes);            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';

import {
  listProfiles,
  getProfilesSummary,
  listUserProfiles,
  getUserModuleProfile,
  saveUserProfiles,
  saveUserModuleProfile,
  deleteUserModuleProfile,
} from '../controllers/usersProfileController.js';

const router = Router();

router.use(requireAuth);

// GET /api/users-profile/profiles — catálogo de perfis e permissões
router.get('/profiles', listProfiles);

// GET /api/users-profile/summary — módulos com acesso por usuário
router.get('/summary', getProfilesSummary);

// GET /api/users-profile/:userId — todos os módulos com o perfil do usuário
router.get('/:userId', listUserProfiles);

// GET /api/users-profile/:userId/:moduleId — perfil em um módulo
router.get('/:userId/:moduleId', getUserModuleProfile);

// PUT /api/users-profile/:userId — salva vários módulos (body.modules)
router.put('/:userId', saveUserProfiles);

// PUT /api/users-profile/:userId/:moduleId — salva um módulo
router.put('/:userId/:moduleId', saveUserModuleProfile);

// DELETE /api/users-profile/:userId/:moduleId — remove o perfil
router.delete('/:userId/:moduleId', deleteUserModuleProfile);

export default router;
