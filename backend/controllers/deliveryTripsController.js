// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsController.js — Controller (Módulo Entregas)            ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Motoristas + Veículos + Rotas do dia + Paradas + Documentos origem   ║
// ║ Usa: backend/services/apis/deliveryTrips/*                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ensureDeliveryTables } from '../repositories/deliveryTrips/deliveryTrips.schema.js';
import * as driversApi from '../repositories/drivers/drivers.index.js';
import * as vehiclesApi from '../repositories/vehicles/vehicles.index.js';
import * as tripsApi from '../repositories/deliveryTrips/deliveryTrips.index.js';

// ======================================================================
// Helpers de resposta
// ======================================================================
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, err, scope) {
  const status = err?.status || 500;
  if (status >= 500) console.error(`[deliveryTripsController:${scope}]`, err);
  const payload = { ok: false, error: String(err?.message || 'Error') };
  if (err?.details !== undefined) payload.details = err.details;
  return res.status(status).json(payload);
}

/** Envolve a função da API em try/catch padronizado */
const handle = (scope, fn, status = 200) => async (req, res) => {
  try {
    return ok(res, await fn(req), status);
  } catch (err) {
    return fail(res, err, scope);
  }
};

export async function ensureReady(_req, res, next) {
  try {
    await ensureDeliveryTables();
    return next();
  } catch (err) {
    return fail(res, err, 'ensureReady');
  }
}

// ======================================================================
// Motoristas
// ======================================================================
export const listDrivers = handle('listDrivers', (req) => driversApi.listDrivers(req.query));
export const listEligibleEmployees = handle('listEligibleEmployees', (req) => driversApi.listEligibleEmployees(req.query));
export const getDriver = handle('getDriver', (req) => driversApi.getDriverById(req.params.id));
export const createDriver = handle('createDriver', (req) => driversApi.createDriver(req.body), 201);
export const updateDriver = handle('updateDriver', (req) => driversApi.updateDriver(req.params.id, req.body));
export const deleteDriver = handle('deleteDriver', (req) => driversApi.deleteDriver(req.params.id));

// ======================================================================
// Veículos
// ======================================================================
export const listVehicles = handle('listVehicles', (req) => vehiclesApi.listVehicles(req.query));
export const getVehicle = handle('getVehicle', (req) => vehiclesApi.getVehicleById(req.params.id));
export const createVehicle = handle('createVehicle', (req) => vehiclesApi.createVehicle(req.body), 201);
export const updateVehicle = handle('updateVehicle', (req) => vehiclesApi.updateVehicle(req.params.id, req.body));
export const deleteVehicle = handle('deleteVehicle', (req) => vehiclesApi.deleteVehicle(req.params.id));

// ======================================================================
// Documentos de origem (Pedidos / Orçamentos)
// ======================================================================
export const listSources = handle('listSources', (req) => tripsApi.listSources(req.query));

// ======================================================================
// Rotas
// ======================================================================
export const listTrips = handle('listTrips', (req) => tripsApi.listTrips(req.query));
export const getTrip = handle('getTrip', (req) => tripsApi.getTrip(req.params.id));
export const createTrip = handle('createTrip', (req) => tripsApi.createTrip(req.body, req.user?.user_id), 201);
export const updateTrip = handle('updateTrip', (req) => tripsApi.updateTrip(req.params.id, req.body));
export const setTripStatus = handle('setTripStatus', (req) => tripsApi.setTripStatus(req.params.id, req.body));
export const deleteTrip = handle('deleteTrip', (req) => tripsApi.deleteTrip(req.params.id));

// ======================================================================
// Paradas
// ======================================================================
export const addStops = handle('addStops', (req) => tripsApi.addStops(req.params.id, req.body), 201);
export const reorderStops = handle('reorderStops', (req) => tripsApi.reorderStops(req.params.id, req.body?.stop_ids));
export const updateStop = handle('updateStop', (req) => tripsApi.updateStop(req.params.stopId, req.body));
export const setStopStatus = handle('setStopStatus', (req) => tripsApi.setStopStatus(req.params.stopId, req.body));
export const deleteStop = handle('deleteStop', (req) => tripsApi.deleteStop(req.params.stopId));
