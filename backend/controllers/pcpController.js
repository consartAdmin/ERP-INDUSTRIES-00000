// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pcpController.js — Controllers HTTP do PCP / Produção (Express ESM) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Pcp from '../repositories/pcp/pcp.index.js';

const ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res, error) => {
  const status = error?.status || 500;
  if (status === 500) console.error('[PCP] 💥', error);
  res.status(status).json({ ok: false, error: status === 500 ? 'Erro interno no PCP.' : String(error.message) });
};

/** Envolve o handler: garante as tabelas e padroniza a resposta. */
const handle = (fn, status = 200) => async (req, res) => {
  try {
    await Pcp.ensureOnce();
    ok(res, await fn(req), status);
  } catch (e) {
    fail(res, e);
  }
};

const id = (req) => {
  const n = Number(req.params.id);
  if (!Number.isSafeInteger(n) || n <= 0) throw Object.assign(new Error('ID inválido.'), { status: 400 });
  return n;
};

const required = (row) => {
  if (!row) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  return row;
};

export const ensure = handle(() => Pcp.ensureTables());

// Produtos (busca para os campos do PCP)
export const searchProducts = handle((req) => Pcp.Bom.searchProducts(req.query));

// Centros de trabalho
export const listWorkCenters = handle((req) => Pcp.WorkCenters.list(req.query));
export const createWorkCenter = handle((req) => Pcp.WorkCenters.create(req.body), 201);
export const updateWorkCenter = handle((req) => Pcp.WorkCenters.update(id(req), req.body));
export const removeWorkCenter = handle((req) => Pcp.WorkCenters.remove(id(req)));

// Ficha técnica
export const listBoms = handle((req) => Pcp.Bom.list(req.query));
export const getBom = handle(async (req) => required(await Pcp.Bom.getById(id(req))));
export const createBom = handle((req) => Pcp.Bom.save(null, req.body), 201);
export const updateBom = handle((req) => Pcp.Bom.save(id(req), req.body));
export const removeBom = handle((req) => Pcp.Bom.remove(id(req)));

// Ordens de produção
export const listOrders = handle((req) => Pcp.Orders.list(req.query));
export const getOrder = handle(async (req) => required(await Pcp.Orders.getById(id(req))));
export const createOrder = handle((req) => Pcp.Orders.create(req.body, req.user), 201);
export const updateOrder = handle((req) => Pcp.Orders.update(id(req), req.body));
export const changeOrderStatus = handle((req) => Pcp.Orders.changeStatus(id(req), req.body?.status));
export const addOrderReport = handle((req) => Pcp.Orders.addReport(id(req), req.body), 201);
export const removeOrder = handle((req) => Pcp.Orders.remove(id(req)));

// MRP
export const materialNeeds = handle((req) => Pcp.Mrp.materialNeeds(req.query));
