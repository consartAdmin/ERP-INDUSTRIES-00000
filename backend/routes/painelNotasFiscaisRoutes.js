// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ backend/routes/painelNotasFiscaisRoutes.js – Rotas do Painel NF-e    ║
// ║ Escopado para ser montado como: app.use("/api", painelRoutes)        ║
// ║ CONSART ERP | ESM                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════╝
'use strict';

import { Router } from 'express';
import controller from '../controllers/painelNotasFiscaisController.js';

const router = Router();

// ───────────────────────────────────────────────────────────────────────────
// Logs
const LOG_ON = String(process.env.NFE_PAINEL_LOG || '1') === '1';
const log = (...args) => {
  if (LOG_ON) console.warn('[PAINEL-NFE]', ...args);
};

// ───────────────────────────────────────────────────────────────────────────
// Middleware de log
router.use('/painel-notas-fiscais', (req, _res, next) => {
  log('[REQ]', req.method, req.originalUrl, '@' + new Date().toISOString());
  next();
});

// ───────────────────────────────────────────────────────────────────────────
// Wrapper async
const wrap = (fn, nome = 'handler') => {
  if (typeof fn !== 'function') {
    throw new TypeError(`Handler inválido em painelNotasFiscaisRoutes: ${nome} não é função`);
  }

  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      const trace = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        ua: req.get('user-agent'),
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined,
      };

      console.error('───────────────────────────────────────────────');
      console.error('💥 ERRO no Painel NF-e');
      console.error('Mensagem:', err.message);
      console.error('Código:', err.code || '(n/d)');
      console.error('Stack:', err.stack?.slice(0, 2000) || '(sem stack)');
      console.error('Requisição:', trace);
      console.error('───────────────────────────────────────────────');

      return res.status(500).json({
        ok: false,
        erro: err.message || 'Erro interno no Painel de Notas Fiscais',
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        detalhes: trace,
      });
    }
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Rotas
router.get(
  '/painel-notas-fiscais/list',
  wrap(controller.listarPainel, 'controller.listarPainel')
);

router.get(
  '/painel-notas-fiscais/xmls',
  wrap(controller.listarNotasXML, 'controller.listarNotasXML')
);

router.get(
  '/painel-notas-fiscais/danfes',
  wrap(controller.listarDANFEs, 'controller.listarDANFEs')
);

router.post(
  '/painel-notas-fiscais/danfe/download',
  wrap(controller.downloadDANFE, 'controller.downloadDANFE')
);

router.post(
  '/painel-notas-fiscais/danfe/json',
  wrap(controller.gerarDANFEJson, 'controller.gerarDANFEJson')
);

// ───────────────────────────────────────────────────────────────────────────
// 404 do módulo
router.use('/painel-notas-fiscais', (req, res) => {
  log('[404] Caminho não encontrado:', req.originalUrl);
  return res.status(404).json({
    ok: false,
    erro: 'Rota não encontrada no Painel de Notas Fiscais',
    path: req.originalUrl,
  });
});

export default router;