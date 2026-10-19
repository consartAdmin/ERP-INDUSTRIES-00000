// ╔═══════════════════════════════════════════════════════════════════════════╗
// 📄 backend/routes/gradesVinculosRoutes.js
// ║ Rotas REST para Vínculos Produto x Grade (gradesProdutos)                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import Ctrl, {
  list,
  getById,
  listByProduto,
  create,
  update,
  remove,
  syncByProduto,
  listGradesCatalog,
} from '../controllers/gradesVinculosController.js';

const router = Router();

// Listagem geral / filtros
router.get('/grades-vinculos', list);

// Por ID (PK)
router.get('/grades-vinculos/:id', getById);

// Por produto (SKU)
router.get('/produtos/:produto_id/grades-vinculos', listByProduto);

router.get('/grades', listGradesCatalog);   // <- novo

// CRUD simples
router.post('/grades-vinculos', create);
router.put('/grades-vinculos/:id', update);
router.delete('/grades-vinculos/:id', remove);

// Sincronização em lote por produto
router.put('/produtos/:produto_id/grades-vinculos', syncByProduto);

export default router;
