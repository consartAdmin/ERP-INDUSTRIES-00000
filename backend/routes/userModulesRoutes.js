// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userModulesRoutes.js — Rotas REST para public."userModules"          ║
// ║ CONSART ERP — inclui compat com /:usuario_id/modulos (legacy)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listUserModules,
  getUserModule,
  createUserModule,
  updateUserModule,
  deleteUserModule,
  listUserModulesByUser, // ✅ compat + JOIN com moduleSystem
} from '../controllers/userModulesController.js';

const router = Router();

/* ────────────────────────────────
   🔁 Compatibilidade legacy
   GET /api/userModules/:usuario_id/modulos
   (ou /api/userModules/:id/modulos)
   usado pelo securityModules.js antigo
──────────────────────────────── */
router.get('/:usuario_id/modulos', listUserModulesByUser);

/* ────────────────────────────────
   CRUD principal /api/userModules
──────────────────────────────── */
router.get('/', listUserModules);        // Listagem com filtros (?usuario_id=1 etc)
router.get('/:id', getUserModule);       // Buscar 1 permissão
router.post('/', createUserModule);      // Criar permissão
router.put('/:id', updateUserModule);    // Atualizar permissão
router.delete('/:id', deleteUserModule); // Excluir permissão

export default router;
