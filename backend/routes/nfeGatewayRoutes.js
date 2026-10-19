// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ 🌐 nfeGatewayRoutes.js – Rotas do ERP para integração NF-e externa           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { Router } from "express";
import {
  montarNfePorPedido,
  emitirNfeViaApi,
} from "../controllers/nfeGatewayController.js";

const router = Router();

/**
 * GET /api/nfe/pedido/:numero
 * (mantém rota existente)
 */
router.get("/nfe/pedido/:numero(\\d+)", montarNfePorPedido);

/**
 * GET /api/nfe/pedido?numero=114  (fallback opcional)
 */
router.get("/nfe/pedido", (req, res, next) => {
  const numero = req.query.numero ?? req.query.pedido ?? req.query.id;
  if (!numero) {
    return res.status(400).json({ ok: false, erro: "PARAMETRO_FALTANDO", hint: "Use ?numero=114" });
  }
  req.params.numero = String(numero);
  return montarNfePorPedido(req, res, next);
});

/**
 * POST /api/nfe/emitir/:numero
 * (mantém rota existente)
 */
router.post("/nfe/emitir/:numero(\\d+)", emitirNfeViaApi);

/**
 * POST /api/nfe/emitir  (novo — requerido pelo front)
 * Aceita corpo como:
 * { "pedido": 114, "numero": 114, "id": 114 }  (qualquer um)
 * Também aceita query (?numero=114) como fallback.
 */
router.post("/nfe/emitir", (req, res, next) => {
  const numero =
    req.body?.pedido ?? req.body?.numero ?? req.body?.id ??
    req.query?.numero ?? req.query?.pedido ?? req.query?.id;

  if (!numero) {
    return res.status(400).json({
      ok: false,
      erro: "PARAMETRO_FALTANDO",
      hint: 'Informe o número do pedido em body: { "pedido": 114 } ou use ?numero=114',
    });
  }
  req.params.numero = String(numero);
  return emitirNfeViaApi(req, res, next);
});

export default router;
