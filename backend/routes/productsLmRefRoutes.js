import { Router } from 'express';

import {
  getProductLmRef,
  listProductsLmRef,
  patchProductLmRef,
  postProductLmRef,
  removeProductLmRef,
} from '../controllers/productsLmRefController.js';

const router = Router();

router.get('/', listProductsLmRef);
router.get('/:productLmRefId', getProductLmRef);
router.post('/', postProductLmRef);
router.patch('/:productLmRefId', patchProductLmRef);
router.delete('/:productLmRefId', removeProductLmRef);

export default router;

