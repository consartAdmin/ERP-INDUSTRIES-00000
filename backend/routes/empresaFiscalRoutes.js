// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║ 🌐 empresaFiscalRoutes.js – Rotas da API: Informações Fiscais da Empresa (ESM) ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝

import express from 'express';
import * as controller from '../controllers/empresaFiscalController.js';

const router = express.Router();

// Todas as respostas são JSON
router.use((_req, res, next) => {
  res.type('application/json; charset=utf-8');
  next();
});

// 🔍 Listar
router.get('/', controller.listar);

// 🔎 Buscar por ID
router.get('/:id', controller.buscarPorId);

// 💾 Criar
router.post('/', controller.criar);

// ✏️ Editar
router.put('/:id', controller.editar);

// ❌ Excluir
router.delete('/:id', controller.excluir);

export default router;
