// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/routes/cashSubcategoriesRoutes.js                           ║
// ║ — Routes                                                            ║
// ║ Cash Subcategories                                                  ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';

import {
  listar,
  obter,
  criar,
  atualizar,
  setAtiva,
  excluir,
} from '../controllers/cashSubcategoriesController.js';

const router = Router();

/* =========================================================
   CASH SUBCATEGORIES
========================================================= */

router.get('/caixa/subcategorias', listar);

router.get('/caixa/subcategorias/:id', obter);

router.post('/caixa/subcategorias', criar);

router.put('/caixa/subcategorias/:id', atualizar);

router.patch('/caixa/subcategorias/:id/active', setAtiva);

router.delete('/caixa/subcategorias/:id', excluir);

export default router;