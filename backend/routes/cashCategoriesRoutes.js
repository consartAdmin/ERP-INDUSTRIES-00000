// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/routes/cashCategoriesRoutes.js                              ║
// ║ — Routes                                                            ║
// ║ Cash Categories                                                     ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  listarCategorias,
  obterCategoria,
  criarCategoria,
  atualizarCategoria,
  setCategoriaAtiva,
  excluirCategoria,
  listarSubcategorias,
} from '../controllers/cashCategoriesController.js';

const router = Router();

/* =========================================================
   CASH CATEGORIES
========================================================= */

router.get('/caixa/categorias', listarCategorias);

router.get('/caixa/categorias/:id', obterCategoria);

router.post('/caixa/categorias', criarCategoria);

router.put('/caixa/categorias/:id', atualizarCategoria);

router.patch('/caixa/categorias/:id/active', setCategoriaAtiva);

router.delete('/caixa/categorias/:id', excluirCategoria);

/* =========================================================
   CATEGORY -> SUBCATEGORIES
========================================================= */

router.get(
  '/caixa/categorias/:categoriaId/subcategorias',
  listarSubcategorias,
);

export default router;