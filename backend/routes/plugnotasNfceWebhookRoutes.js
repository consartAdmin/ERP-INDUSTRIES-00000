// ╔══════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfceWebhookRoutes.js — Webhook NFC-e PlugNotas (ESM)   ║
// ╚══════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  handlePlugnotasNfceWebhook,
  listNfceWebhookEvents,
  importNfceResumo,
  downloadNfceXml,
  downloadNfcePdf,        // 👈 NOVO
  syncNfceFromPdvSales,   // (se já estiver usando)
} from '../controllers/plugnotasNfceWebhookController.js';

const router = express.Router();

// Webhook chamado pela PlugNotas
router.post('/nfce', handlePlugnotasNfceWebhook);

// Lista eventos (painel)
router.get('/nfce-events', listNfceWebhookEvents);

// Importação manual via resumo da NFC-e
router.post('/nfce/import-resumo', express.json({ limit: '1mb' }), importNfceResumo);

// Download direto do XML da PlugNotas (proxy)
router.get('/nfce/:id/xml', downloadNfceXml);

// 🔹 NOVO: Download/visualização do PDF (DANFE) da NFC-e
router.get('/nfce/:id/pdf', downloadNfcePdf);

// (se já existir)
router.post('/nfce/sync-from-pdv-sales', syncNfceFromPdvSales);

export default router;
