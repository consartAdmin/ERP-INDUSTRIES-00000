// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sefazSearchRoutes.js — Rotas de busca SEFAZ (CNPJ / IE)             ║
// ║ Base: /api/search/sefaz                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { searchByCnpj, searchByIe } from '../controllers/sefazSearchController.js';

const router = Router();

// Ex: GET /api/search/sefaz/cnpj/08187168000160?uf=MG
router.get('/cnpj/:cnpj', searchByCnpj);

// Ex: GET /api/search/sefaz/ie/MG/123456789
router.get('/ie/:uf/:ie', searchByIe);

export default router;
