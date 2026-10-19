// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookPlugNotasRoutes.js — Rotas NF-e Webhook (PlugNotas)       ║
// ║ Base: /api/nfe                                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  receiveWebhook,
  listWebhooks,
  reprocessFromFilters
} from '../controllers/nfeWebhookPlugNotasController.js';

const router = express.Router();

// 🔹 Rota pública chamada pela PlugNotas (não precisa autenticação do usuário)
router.post(
  '/webhook/plugnotas',
  express.json({ limit: '2mb' }),
  receiveWebhook
);

// 🔹 Rotas internas para o frontend webhookPlugNotas.html
router.get('/webhooks', listWebhooks);
router.post('/webhooks/reprocess', express.json(), reprocessFromFilters);

export default router;
