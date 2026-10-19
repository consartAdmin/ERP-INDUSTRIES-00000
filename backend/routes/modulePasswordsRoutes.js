// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/routes/modulePasswordsRoutes.js                       ║
// ║ MODULE: Senhas dos Módulos                                          ║
// ║ 🔐 /status: login | demais rotas: login + perfil administrador       ║
// ║ Montado em: app.use('/api/module-passwords', ...)                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import { requireAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

import controller from '../controllers/modulePasswordsController.js';

const router = express.Router();

// Qualquer usuário logado: só informa se a ação exige senha
router.get('/status', requireAuth, controller.status);

// Demais rotas: somente administradores
router.use(requireAuth, requireAdmin);

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.updateById);
router.delete('/:id/password', controller.clearPassword);
router.delete('/:id', controller.removeById);

export default router;
