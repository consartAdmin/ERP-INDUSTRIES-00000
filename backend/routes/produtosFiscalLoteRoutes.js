// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ 🔗 produtosFiscalLoteRoutes.js – Rotas para Atualização Fiscal em Lote    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as controller from '../controllers/produtosFiscalLoteController.js';

const router = Router();

// 🔁 Atualiza os dados fiscais em lote (grupo, subgrupo, classificação e perfil fiscal)
// (Atenção: este caminho já inclui /api – mantenho para não quebrar comportamento atual)
router.put('/api/produtos/fiscal-lote', controller.atualizarFiscalEmLote);

// 🔍 Retorna o perfil fiscal vinculado à classificação (usado no onchange do frontend)
// (idem acima: rota inclui /api por compatibilidade)
router.get('/api/classificacao-fiscal/:id', controller.obterPerfilPorClassificacao);

export default router;
