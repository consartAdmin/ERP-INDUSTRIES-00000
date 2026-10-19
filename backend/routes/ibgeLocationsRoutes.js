// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsRoutes.js — Routes IBGE Locations                       ║
// ║ CONSART ERP | ESM                                                    ║
// ║ Mount: app.use('/api', router)                                       ║
// ║ Result base: /api/ibge-locations                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as C from '../controllers/ibgeLocationsController.js';

const router = Router();

/* -----------------------------------------------------------------------
 * Ensure table
 * --------------------------------------------------------------------- */
router.post('/ibge-locations/ensure', C.ensure);

/* -----------------------------------------------------------------------
 * ✅ Import (IBGE → Banco por UF)
 * POST /api/ibge-locations/import/state
 * body: { "state": "MG" }
 * --------------------------------------------------------------------- */
router.post('/ibge-locations/import/state', C.importByState);

/* -----------------------------------------------------------------------
 * List / Search
 * --------------------------------------------------------------------- */
router.get('/ibge-locations', C.list);
router.get('/ibge-locations/search', C.search);

/* -----------------------------------------------------------------------
 * ✅ UFs list (distinct states)
 * GET /api/ibge-locations/ufs
 * --------------------------------------------------------------------- */
router.get('/ibge-locations/ufs', C.ufs);

/* -----------------------------------------------------------------------
 * ✅ Resolve city -> IBGE code
 * GET /api/ibge-locations/resolve?uf=MG&city=Belo%20Horizonte
 * --------------------------------------------------------------------- */
router.get('/ibge-locations/resolve', C.resolveCity);

/* -----------------------------------------------------------------------
 * ✅ Reports / Helpers (ANTES do :id)
 * --------------------------------------------------------------------- */
router.get('/ibge-locations/count-by-state', C.countByState);
router.get('/ibge-locations/by-ibge/:ibgeCode', C.getByIbgeCode);
router.get('/ibge-locations/cities/:state', C.citiesByState);

/* -----------------------------------------------------------------------
 * CRUD (⚠️ sempre por último)
 * --------------------------------------------------------------------- */
router.get('/ibge-locations/:id', C.getById);
router.post('/ibge-locations', C.create);
router.put('/ibge-locations/:id', C.update);
router.delete('/ibge-locations/:id', C.remove);

export default router;
