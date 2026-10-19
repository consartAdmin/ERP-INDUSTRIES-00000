// ╔══════════════════════════════════════════════════════════════════════╗
// ║ deliveryTripsRoutes.js — Rotas Express (Módulo Entregas)             ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Base: /api/delivery-trips   (requer JWT)                            ║
// ║                                                                      ║
// ║ Motoristas                                                           ║
// ║   GET    /drivers                 GET /drivers/eligible-employees    ║
// ║   GET    /drivers/:id             POST /drivers                      ║
// ║   PUT    /drivers/:id             DELETE /drivers/:id                ║
// ║ Veículos                                                             ║
// ║   GET    /vehicles                GET /vehicles/:id                  ║
// ║   POST   /vehicles                PUT /vehicles/:id                  ║
// ║   DELETE /vehicles/:id                                               ║
// ║ Documentos de origem                                                 ║
// ║   GET    /sources?source_type=PEDIDO|ORCAMENTO&movement_type=...     ║
// ║ Rotas                                                                ║
// ║   GET    /                        POST /                             ║
// ║   GET    /:id                     PUT  /:id                          ║
// ║   PATCH  /:id/status              DELETE /:id                        ║
// ║ Paradas                                                              ║
// ║   POST   /:id/stops               PATCH /:id/stops/reorder           ║
// ║   PUT    /stops/:stopId           PATCH /stops/:stopId/status        ║
// ║   DELETE /stops/:stopId                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import * as c from '../controllers/deliveryTripsController.js';

const router = Router();

router.use(requireAuth);
router.use(c.ensureReady);

// Motoristas
router.get('/drivers/eligible-employees', c.listEligibleEmployees);
router.get('/drivers', c.listDrivers);
router.get('/drivers/:id', c.getDriver);
router.post('/drivers', c.createDriver);
router.put('/drivers/:id', c.updateDriver);
router.delete('/drivers/:id', c.deleteDriver);

// Veículos
router.get('/vehicles', c.listVehicles);
router.get('/vehicles/:id', c.getVehicle);
router.post('/vehicles', c.createVehicle);
router.put('/vehicles/:id', c.updateVehicle);
router.delete('/vehicles/:id', c.deleteVehicle);

// Documentos de origem
router.get('/sources', c.listSources);

// Paradas (rotas estáticas antes de /:id)
router.put('/stops/:stopId', c.updateStop);
router.patch('/stops/:stopId/status', c.setStopStatus);
router.delete('/stops/:stopId', c.deleteStop);

// Rotas
router.get('/', c.listTrips);
router.post('/', c.createTrip);
router.get('/:id', c.getTrip);
router.put('/:id', c.updateTrip);
router.patch('/:id/status', c.setTripStatus);
router.delete('/:id', c.deleteTrip);
router.post('/:id/stops', c.addStops);
router.patch('/:id/stops/reorder', c.reorderStops);

export default router;
