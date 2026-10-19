// ╔══════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesRoutes.js — Rotas Assinaturas de Entrega         ║
// ║ Padrão CONSART (mesmo estilo do sessionTimeOutConfigRoutes)          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  listSignaturesDeliveries,
  searchSignaturesDeliveries,
  getSignatureDeliveryById,
  createSignatureDelivery,
  updateSignatureDelivery,
  removeSignatureDelivery,
} from '../controllers/signaturesDeliveriesController.js';

const router = Router();

/* ======================================================================
 * Prefixo padrão CONSART
 * ====================================================================== */
const BASE = '/api/signatures-deliveries';

/* ======================================================================
 * Rotas
 * ====================================================================== */

// Busca rápida
router.get(`${BASE}/search`, searchSignaturesDeliveries);

// Listagem com filtros
router.get(BASE, listSignaturesDeliveries);

// CRUD básico
router.get(`${BASE}/:id`, getSignatureDeliveryById);
router.post(BASE, createSignatureDelivery);
router.put(`${BASE}/:id`, updateSignatureDelivery);
router.delete(`${BASE}/:id`, removeSignatureDelivery);

/* ======================================================================
 * Export
 * ====================================================================== */
export default router;
