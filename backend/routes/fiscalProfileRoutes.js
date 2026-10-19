// ╔══════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileRoutes.js — Rotas Express (ESM)                     ║
// ║ CONSART ERP — Fiscal Profile API                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import fiscalProfileController from '../controllers/fiscalProfileController.js';

const router = Router();

// 📋 Listagem com filtros opcionais (q, limit, offset)
router.get('/', fiscalProfileController.list);

// 🔍 Obter um perfil fiscal específico por ID
router.get('/:id', fiscalProfileController.getById);

// ➕ Criar novo perfil fiscal
router.post('/', fiscalProfileController.create);

// ✏️ Atualizar perfil fiscal existente
router.put('/:id', fiscalProfileController.update);

// 🗑️ Remover (lógico ou físico, via ?hard=true)
router.delete('/:id', fiscalProfileController.remove);

export default router;
