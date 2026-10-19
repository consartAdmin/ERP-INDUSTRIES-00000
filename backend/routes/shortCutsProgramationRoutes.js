// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationRoutes.js                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import express from 'express';

import {
  list,
  listCategories,
  listSubCategories,
  getById,
  create,
  update,
  remove,
  restore,

  createCategory,
  updateCategory,
  removeCategory,
  createSubCategory,
  updateSubCategory,
  removeSubCategory,
} from '../controllers/shortCutsProgramationController.js';

const router = express.Router();

router.get('/', list);

router.get('/categories', listCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', removeCategory);

router.get('/subcategories', listSubCategories);
router.post('/subcategories', createSubCategory);
router.put('/subcategories/:id', updateSubCategory);
router.patch('/subcategories/:id', updateSubCategory);
router.delete('/subcategories/:id', removeSubCategory);

router.get('/', list);

router.get('/categories', listCategories);

router.get('/subcategories', listSubCategories);

router.get('/:id', getById);

router.post('/', create);

router.put('/:id', update);

router.patch('/:id', update);

router.delete('/:id', remove);

router.patch('/:id/restore', restore);

export default router;