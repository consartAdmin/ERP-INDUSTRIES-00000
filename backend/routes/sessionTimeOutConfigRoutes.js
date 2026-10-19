// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║ File: backend/routes/sessionTimeOutConfigRoutes.js                            ║
// ║ Desc: Rotas para sessionTimeOutConfig — expõe /api/session-config             ║
// ║ Padrão: ESM — usar em server.js como: import sessionCfgRoutes from './routes/...'; app.use(sessionCfgRoutes); ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { getSessionConfig, updateSessionConfig } from '../controllers/sessionTimeOutConfigController.js';

const router = Router();

// rota base: /api/session-config
router.get('/api/session-config', async (req, res) => {
  return getSessionConfig(req, res);
});

// permitir PUT para atualizar a config
router.put('/api/session-config', async (req, res) => {
  return updateSessionConfig(req, res);
});

// Caso prefira PATCH use a rota abaixo (opcional):
// router.patch('/api/session-config', async (req, res) => updateSessionConfig(req, res));

export default router;
