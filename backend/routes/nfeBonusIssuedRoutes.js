import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as c from '../controllers/nfeBonusIssuedController.js';

const router=Router();
router.get('/',requireAuth,c.searchController);
router.post('/',requireAuth,c.createController);
router.get('/:bonusId',requireAuth,c.getController);
router.put('/:bonusId',requireAuth,c.updateController);
router.delete('/:bonusId',requireAuth,c.removeController);
router.post('/:bonusId/ready',requireAuth,c.readyController);
router.post('/:bonusId/items',requireAuth,c.addItemController);
router.put('/:bonusId/items/:itemId',requireAuth,c.updateItemController);
router.delete('/:bonusId/items/:itemId',requireAuth,c.removeItemController);
router.post('/:bonusId/issue',requireAuth,c.issueController);
router.get('/:bonusId/status',requireAuth,c.statusController);
router.get('/:bonusId/xml',requireAuth,c.xmlController);
router.get('/:bonusId/danfe.pdf',requireAuth,c.danfeController);
export default router;
