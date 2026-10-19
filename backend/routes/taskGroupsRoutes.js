// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsRoutes.js                                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import controller from '../controllers/taskGroupsController.js';

const router = express.Router();

router.get('/ensure', controller.ensure);

router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post('/', controller.create);

router.put('/:id', controller.update);
router.patch('/:id', controller.update);

router.delete('/:id', controller.remove);

router.patch('/:id/restore', controller.restore);

export default router;