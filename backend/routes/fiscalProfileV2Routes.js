// ╔════════════════════════════════════════════════════════════════════════╗
// ║  fiscalProfileV2Routes.js                                              ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as controller from '../controllers/fiscalProfileV2Controller.js';

const router = Router();
router.get('/', controller.list);
router.get('/:id(\\d+)', controller.getById);
router.post('/', controller.create);
router.put('/:id(\\d+)', controller.update);
router.patch('/:id(\\d+)/active', controller.setActive);
export default router;
