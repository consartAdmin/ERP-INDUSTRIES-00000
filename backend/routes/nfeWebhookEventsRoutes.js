// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEventsRoutes.js — Rotas NF-e Webhook Events               ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/nfeWebhookEventsController.js';
import { handlePlugNotasWebhook } from '../services/webhooks/plugNotasWebhookHandler.js';

const router = Router();

function mustFn(fn, name) {
  if (typeof fn !== 'function') {
    console.error(`❌ [nfeWebhookEventsRoutes] Handler ausente: ${name}`);

    return (_req, res) => {
      return res.status(501).json({
        ok: false,
        error: `Handler não implementado: ${name}`,
      });
    };
  }

  return fn;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║ Listagem + filtros + paginação                              ║
// ╚══════════════════════════════════════════════════════════════╝
router.get(
  '/nfe/webhooks',
  mustFn(ctrl.listWebhookEvents, 'ctrl.listWebhookEvents')
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ Detalhe do evento                                           ║
// ╚══════════════════════════════════════════════════════════════╝
router.get(
  '/nfe/webhooks/:id',
  mustFn(ctrl.getWebhookEvent, 'ctrl.getWebhookEvent')
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ XML do evento                                               ║
// ╚══════════════════════════════════════════════════════════════╝
router.get(
  '/nfe/webhooks/:id/xml',
  mustFn(ctrl.getWebhookXml, 'ctrl.getWebhookXml')
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ DANFE do evento                                             ║
// ╚══════════════════════════════════════════════════════════════╝
router.get(
  '/nfe/webhooks/:id/danfe',
  mustFn(ctrl.getWebhookDanfe, 'ctrl.getWebhookDanfe')
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ Reprocessar / sincronizar eventos                           ║
// ╚══════════════════════════════════════════════════════════════╝
router.post(
  '/nfe/webhooks/reprocess',
  mustFn(ctrl.reprocessWebhookNotes, 'ctrl.reprocessWebhookNotes')
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ Webhook PlugNotas — endpoint público                        ║
// ╚══════════════════════════════════════════════════════════════╝
router.post(
  '/nfe/webhook/plugnotas',
  mustFn(handlePlugNotasWebhook || ctrl.receiveWebhook, 'handlePlugNotasWebhook')
);

export default router;