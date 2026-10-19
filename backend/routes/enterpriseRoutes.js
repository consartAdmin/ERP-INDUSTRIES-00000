// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseRoutes.js                                                 ║
// ║ Descrição: Rotas do módulo de empresas                              ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listEnterprises,
  getEnterpriseById,
  createEnterprise,
  updateEnterprise,
  deleteEnterprise,
  toggleEnterpriseStatus
} from '../controllers/enterpriseController.js';

const router = Router();

router.get('/', listEnterprises);
router.get('/:id', getEnterpriseById);
router.post('/', createEnterprise);
router.put('/:id', updateEnterprise);
router.patch('/:id/status', toggleEnterpriseStatus);
router.delete('/:id', deleteEnterprise);

export default router;