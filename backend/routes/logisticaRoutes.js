// ╔══════════════════════════════════════════════════════╗
// ║ 🚚 logisticaRoutes.js – Rotas de Entregas e Coletas ║
// ╚══════════════════════════════════════════════════════╝

import express from 'express';
import * as controller from '../controllers/logisticaController.js';

const router = express.Router();

// 📄 Listar todas as entregas
router.get('/', controller.listar);

// 📄 Gerar PDF da Rota
router.get('/pdf/:data', controller.gerarPDF);

// ➕ Criar nova entrega/coleta
router.post('/', controller.criar);

// 💾 Atualizar entrega por ID
router.put('/:id', controller.atualizarEntrega);

// ✅ Atualizar apenas o status
router.patch('/:id/status', controller.atualizarStatus);

// 🗑️ Remover entrega por ID
router.delete('/:id', controller.removerEntrega);

export default router;
