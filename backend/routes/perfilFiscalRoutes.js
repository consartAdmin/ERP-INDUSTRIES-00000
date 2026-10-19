// ╔═══════════════════════════════════════════════════════╗
// ║ 🛣️ perfilFiscalRoutes.js – Rotas Perfil Fiscal (ESM)  ║
/* ║ Base: /api/perfil-fiscal
   ║ GET    /             → listarPerfis
   ║ GET    /:id          → obterPerfilPorId
   ║ POST   /             → criarPerfil
   ║ PUT    /:id          → atualizarPerfil
   ║ DELETE /:id          → removerPerfil
   ║                                                     */
// ╚═══════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listarPerfis,
  obterPerfilPorId,
  criarPerfil,
  atualizarPerfil,
  removerPerfil,
} from '../controllers/perfilFiscalController.js';

const router = Router();

console.log('✅ [ROTAS] perfilFiscalRoutes carregadas em /api/perfil-fiscal');

// Import sanity check: se algum handler estiver undefined, loga e evita crash
const handlers = { listarPerfis, obterPerfilPorId, criarPerfil, atualizarPerfil, removerPerfil };
for (const [k, fn] of Object.entries(handlers)) {
  if (typeof fn !== 'function') {
    console.error(`❌ Handler ausente em perfilFiscalController: ${k} =`, fn);
  }
}

router.get('/',    listarPerfis);
router.get('/:id', obterPerfilPorId);
router.post('/',   criarPerfil);
router.put('/:id', atualizarPerfil);
router.delete('/:id', removerPerfil);

export default router;

//TESTES API´s: http://localhost:8080/api/produtos/4828/produto-fiscal
