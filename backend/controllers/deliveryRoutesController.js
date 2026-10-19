// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutesController.js — Controller (Rotas de Entrega)          ║
// ║ CONSART ERP | ESM                                                   ║
// ║ CRUD + List (q/is_active/route_type/paginação) + toggle active       ║
// ║ Usa: backend/services/apis/deliveryRoutesApi.js                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  createDeliveryRoute,
  getDeliveryRouteById,
  updateDeliveryRoute,
  deleteDeliveryRoute,
  listDeliveryRoutes,
  setDeliveryRouteActive,
} from '../repositories/deliveryRoutes/deliveryRoutes.index.js';

// ======================================================================
// Helpers de resposta
// ======================================================================
function getInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, status, error, details = undefined) {
  const payload = { ok: false, error: String(error || 'Error') };
  if (details !== undefined) payload.details = details;
  return res.status(status).json(payload);
}

function pickBody(req) {
  const b = req.body || {};
  const out = {};

  if ('route_code' in b) out.route_code = b.route_code;
  if ('name' in b) out.name = b.name;
  if ('route_type' in b) out.route_type = b.route_type;

  if ('city' in b) out.city = b.city;
  if ('region' in b) out.region = b.region;
  if ('weekdays' in b) out.weekdays = b.weekdays;

  if ('driver_name' in b) out.driver_name = b.driver_name;
  if ('vehicle_plate' in b) out.vehicle_plate = b.vehicle_plate;

  if ('is_active' in b) out.is_active = b.is_active;
  if ('notes' in b) out.notes = b.notes;

  // ✅ vínculo
  if ('customer_id' in b) out.customer_id = b.customer_id;
  if ('supplier_id' in b) out.supplier_id = b.supplier_id;
  if ('linked_name' in b) out.linked_name = b.linked_name;
  if ('linked_tax_id' in b) out.linked_tax_id = b.linked_tax_id;

  return out;
}

// ======================================================================
// Controllers
// ======================================================================
export async function list(req, res) {
  try {
    const q = (req.query.q ?? '').toString();

    const is_active = req.query.is_active === undefined ? null : req.query.is_active;
    const route_type = req.query.route_type === undefined ? null : req.query.route_type;

    const limit = getInt(req.query.limit, 50);
    const offset = getInt(req.query.offset, 0);

    const order = (req.query.order ?? 'name').toString();
    const dir = (req.query.dir ?? 'asc').toString();

    const data = await listDeliveryRoutes({ q, is_active, route_type, limit, offset, order, dir });
    return ok(res, data);
  } catch (e) {
    console.error('[deliveryRoutesController:list]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to list delivery routes');
  }
}

export async function getById(req, res) {
  try {
    const route_id = getInt(req.params.route_id, null);
    if (!route_id) return fail(res, 400, 'route_id invalid');

    const row = await getDeliveryRouteById(route_id);
    if (!row) return fail(res, 404, 'Route not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRoutesController:getById]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to get route');
  }
}

export async function create(req, res) {
  try {
    const payload = pickBody(req);
    const row = await createDeliveryRoute(payload);
    return ok(res, row, 201);
  } catch (e) {
    console.error('[deliveryRoutesController:create]', e);

    // Postgres check/fk mensagens costumam ser cruas; retorna mais amigável
    const msg = e?.message || 'Failed to create route';
    return fail(res, e?.status || 500, msg);
  }
}

export async function update(req, res) {
  try {
    const route_id = getInt(req.params.route_id, null);
    if (!route_id) return fail(res, 400, 'route_id invalid');

    const payload = pickBody(req);
    const row = await updateDeliveryRoute(route_id, payload);
    if (!row) return fail(res, 404, 'Route not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRoutesController:update]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to update route');
  }
}

export async function remove(req, res) {
  try {
    const route_id = getInt(req.params.route_id, null);
    if (!route_id) return fail(res, 400, 'route_id invalid');

    const row = await deleteDeliveryRoute(route_id);
    if (!row) return fail(res, 404, 'Route not found');

    return ok(res, { route_id: row.route_id });
  } catch (e) {
    console.error('[deliveryRoutesController:remove]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to delete route');
  }
}

export async function setActive(req, res) {
  try {
    const route_id = getInt(req.params.route_id, null);
    if (!route_id) return fail(res, 400, 'route_id invalid');

    const { is_active } = req.body || {};
    const row = await setDeliveryRouteActive(route_id, is_active);
    if (!row) return fail(res, 404, 'Route not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRoutesController:setActive]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to toggle route');
  }
}