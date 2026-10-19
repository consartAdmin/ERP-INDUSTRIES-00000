// ╔══════════════════════════════════════════════════════════════════╗
// ║ plugnotasWebhookRoutes.js — Rotas Webhook PlugNotas             ║
// ║ CONSART ERP — ESM                                               ║
// ║                                                                  ║
// ║ - GET  /api/integrations/plugnotas/webhook         (config)     ║
// ║ - PUT  /api/integrations/plugnotas/webhook         (salvar cfg) ║
// ║ - POST /api/integrations/plugnotas/webhook/test    (teste)      ║
// ║ - GET  /api/integrations/plugnotas/webhook/logs    (logs)       ║
// ║ - POST /webhooks/plugnotas                         (callback)   ║
// ╚══════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  getPlugnotasWebhookConfig,
  updatePlugnotasWebhookConfig,
  testPlugnotasWebhook,
  handlePlugnotasWebhook,
  getPlugnotasWebhookLogs,
} from '../controllers/plugnotasWebhookController.js';

const router = express.Router();

// Configuração do webhook (usado pelo frontend)
router.get('/api/integrations/plugnotas/webhook', getPlugnotasWebhookConfig);
router.put(
  '/api/integrations/plugnotas/webhook',
  express.json({ limit: '1mb' }),
  updatePlugnotasWebhookConfig
);

// Teste manual (botão "Testar webhook" no frontend)
router.post(
  '/api/integrations/plugnotas/webhook/test',
  express.json({ limit: '1mb' }),
  testPlugnotasWebhook
);

// Logs de callbacks recebidos (tabela integrations_plugnotas_webhook_logs)
router.get('/api/integrations/plugnotas/webhook/logs', getPlugnotasWebhookLogs);

// Rota pública chamada pelo PlugNotas
router.post(
  '/webhooks/plugnotas',
  express.json({ limit: '1mb' }),
  handlePlugnotasWebhook
);

export default router;
