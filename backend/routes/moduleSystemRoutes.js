// ╔══════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemRoutes.js — Rotas Express do cadastro de módulos        ║
// ║ Mount sugerido: app.use('/api/module-system', moduleSystemRoutes);  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { moduleSystemController as ctrl } from '../controllers/moduleSystemController.js';

const router = Router();

// GET /api/module-system/menu — árvore do menu (antes de '/:id')
router.get('/menu', (req, res) => ctrl.menu(req, res));

// GET /api/module-system?onlyActive=1&search=texto
router.get('/', (req, res) => ctrl.list(req, res));

// GET /api/module-system/:id
router.get('/:id', (req, res) => ctrl.getById(req, res));

// POST /api/module-system
router.post('/', (req, res) => ctrl.create(req, res));

// PUT /api/module-system/:id
router.put('/:id', (req, res) => ctrl.update(req, res));

// DELETE /api/module-system/:id
router.delete('/:id', (req, res) => ctrl.remove(req, res));

export default router;
