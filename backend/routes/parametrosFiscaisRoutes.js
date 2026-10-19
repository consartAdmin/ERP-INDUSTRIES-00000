// ╔══════════════════════════════════════════════════════════════╗
/* ║ parametrosFiscaisRoutes.js – rotas REST (ESM)               ║ */
// ╚══════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getSequencia, putSequencia,
  getAmbiente,  putAmbiente,
} from '../controllers/parametrosFiscaisController.js';

const router = Router();

// Sequência
router.get('/sequencia', getSequencia);
router.put('/sequencia', putSequencia);

// Ambiente
router.get('/ambiente', getAmbiente);
router.put('/ambiente', putAmbiente);

export default router;

/* ──────────────────────────────────────────────────────────────
   COMO MONTAR NO server.js (ESM):
   import parametrosFiscaisRoutes from './routes/parametrosFiscaisRoutes.js';
   app.use('/api/paramfiscais', parametrosFiscaisRoutes);

   E servir estáticos:
   app.use('/public', express.static(path.resolve(process.cwd(), 'public')));

   (garanta que /public/includes/theme-consart.css exista no caminho informado)
   ────────────────────────────────────────────────────────────── */
