// ╔══════════════════════════════════════════════════════════════╗
// ║ gestaoVendasRoutes.js – Rotas REST                          ║
// ╚══════════════════════════════════════════════════════════════╝
import express from 'express';
import * as controller from '../controllers/gestaoVendasController.js';

const router = express.Router();

// Lista com filtros/paginação
router.get('/', controller.listar);

// Obter por ID
router.get('/:id', controller.obterPorId);

// Criar
router.post('/', controller.criar);

// Atualizar
router.put('/:id', controller.atualizar);

// Excluir
router.delete('/:id', controller.excluir);

// Relatório (agregado)
router.get('/relatorio/diario', controller.relatorioDiario);

export default router;
