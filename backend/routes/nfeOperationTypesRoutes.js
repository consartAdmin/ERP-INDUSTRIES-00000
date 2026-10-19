import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as controller from '../controllers/nfeOperationTypesController.js';

const router = Router();
router.get('/', requireAuth, controller.search);
router.get('/:operationTypeId', requireAuth, controller.getById);
router.post('/', requireAuth, controller.create);
router.put('/:operationTypeId', requireAuth, controller.update);
router.delete('/:operationTypeId', requireAuth, controller.remove);
export default router;
