// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: tasksRoutes.js                                        ║
// ║ MODULE: Tasks Routes                                        ║
// ║ BASE: /api/tasks                                            ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  list,
  getById,
  create,
  update,
  finish,
  remove,
} from '../controllers/tasksController.js';

const router = Router();

router.get('/', list);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/finish', finish);
router.delete('/:id', remove);

export default router;