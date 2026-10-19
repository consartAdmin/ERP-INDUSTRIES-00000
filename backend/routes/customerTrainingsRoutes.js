// ╔═════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsRoutes.js — /api/customer-trainings (JWT)         ║
// ╚═════════════════════════════════════════════════════════════════════╝

import express from 'express';
import controller from '../controllers/customerTrainingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/ensure', controller.ensure);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/pdf', controller.pdf);

router.post('/', controller.create);
router.post('/:id/complete', controller.complete);
router.post('/:id/email', controller.sendEmail);

router.put('/:id', controller.update);

router.delete('/:id', controller.remove);

export default router;
