// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStopsController.js — Controller                        ║
// ║ CONSART ERP | ESM                                                   ║
// ║ CRUD + list by route + reorder + status                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  createDeliveryRouteStop,
  getDeliveryRouteStopById,
  listDeliveryRouteStopsByRoute,
  updateDeliveryRouteStop,
  deleteDeliveryRouteStop,
  setDeliveryRouteStopStatus,
  reorderDeliveryRouteStops,
} from '../repositories/deliveryRouteStops/deliveryRouteStops.index.js';

// ======================================================================
// Helpers
// ======================================================================
function getInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
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

  if ('route_id' in b) out.route_id = b.route_id;
  if ('stop_order' in b) out.stop_order = b.stop_order;
  if ('movement_type' in b) out.movement_type = b.movement_type;
  if ('linked_type' in b) out.linked_type = b.linked_type;

  if ('customer_id' in b) out.customer_id = b.customer_id;
  if ('supplier_id' in b) out.supplier_id = b.supplier_id;

  if ('name' in b) out.name = b.name;
  if ('tax_id' in b) out.tax_id = b.tax_id;
  if ('address' in b) out.address = b.address;
  if ('city' in b) out.city = b.city;
  if ('region' in b) out.region = b.region;
  if ('contact_name' in b) out.contact_name = b.contact_name;
  if ('phone' in b) out.phone = b.phone;
  if ('notes' in b) out.notes = b.notes;
  if ('expected_date' in b) out.expected_date = b.expected_date;
  if ('expected_time' in b) out.expected_time = b.expected_time;
  if ('status' in b) out.status = b.status;

  return out;
}

// ======================================================================
// Controllers
// ======================================================================
export async function listByRoute(req, res) {
  try {
    const route_id = getInt(req.params.route_id, null);
    if (!route_id) return fail(res, 400, 'route_id invalid');

    const rows = await listDeliveryRouteStopsByRoute(route_id);
    return ok(res, rows);
  } catch (e) {
    console.error('[deliveryRouteStopsController:listByRoute]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to list route stops');
  }
}

export async function getById(req, res) {
  try {
    const stop_id = getInt(req.params.stop_id, null);
    if (!stop_id) return fail(res, 400, 'stop_id invalid');

    const row = await getDeliveryRouteStopById(stop_id);
    if (!row) return fail(res, 404, 'Stop not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRouteStopsController:getById]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to get stop');
  }
}

export async function create(req, res) {
  try {
    const payload = pickBody(req);
    const row = await createDeliveryRouteStop(payload);
    return ok(res, row, 201);
  } catch (e) {
    console.error('[deliveryRouteStopsController:create]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to create stop');
  }
}

export async function update(req, res) {
  try {
    const stop_id = getInt(req.params.stop_id, null);
    if (!stop_id) return fail(res, 400, 'stop_id invalid');

    const payload = pickBody(req);
    const row = await updateDeliveryRouteStop(stop_id, payload);
    if (!row) return fail(res, 404, 'Stop not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRouteStopsController:update]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to update stop');
  }
}

export async function remove(req, res) {
  try {
    const stop_id = getInt(req.params.stop_id, null);
    if (!stop_id) return fail(res, 400, 'stop_id invalid');

    const row = await deleteDeliveryRouteStop(stop_id);
    if (!row) return fail(res, 404, 'Stop not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRouteStopsController:remove]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to delete stop');
  }
}

export async function setStatus(req, res) {
  try {
    const stop_id = getInt(req.params.stop_id, null);
    if (!stop_id) return fail(res, 400, 'stop_id invalid');

    const { status } = req.body || {};
    const row = await setDeliveryRouteStopStatus(stop_id, status);
    if (!row) return fail(res, 404, 'Stop not found');

    return ok(res, row);
  } catch (e) {
    console.error('[deliveryRouteStopsController:setStatus]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to update stop status');
  }
}

export async function reorder(req, res) {
  try {
    const route_id = getInt(req.body?.route_id, null);
    const items = Array.isArray(req.body?.items) ? req.body.items : null;

    if (!route_id) return fail(res, 400, 'route_id invalid');
    if (!items) return fail(res, 400, 'items invalid');

    const rows = await reorderDeliveryRouteStops(route_id, items);
    return ok(res, rows);
  } catch (e) {
    console.error('[deliveryRouteStopsController:reorder]', e);
    return fail(res, e?.status || 500, e?.message || 'Failed to reorder stops');
  }
}