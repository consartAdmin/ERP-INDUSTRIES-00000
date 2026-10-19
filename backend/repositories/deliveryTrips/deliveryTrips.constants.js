// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTrips.constants.js — Tabelas, transições e tipos de doc    ║
// ║ Tabelas: public."deliveryTrips" / public."deliveryTripStops"       ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TRIPS = 'public."deliveryTrips"';
export const STOPS = 'public."deliveryTripStops"';

/** Transições de status permitidas para a rota */
export const TRIP_TRANSITIONS = Object.freeze({
  PLANEJADA: ['EM_ROTA', 'CANCELADA'],
  EM_ROTA: ['CONCLUIDA', 'PLANEJADA', 'CANCELADA'],
  CONCLUIDA: ['EM_ROTA'],
  CANCELADA: ['PLANEJADA'],
});

/** Rotas nesses status não aceitam mudança de paradas */
export const LOCKED_TRIP_STATUS = ['CONCLUIDA', 'CANCELADA'];

/* ─────────────────────────── Documentos de origem ─────────────────────────── */

/** Tipos de documento que podem virar parada */
export const DOCUMENT_TYPES = ['PEDIDO', 'ORCAMENTO', 'NFE'];

export const NOT_FOUND = { PEDIDO: 'ORDER_NOT_FOUND', ORCAMENTO: 'BUDGET_NOT_FOUND', NFE: 'INVOICE_NOT_FOUND' };

/** Campo do payload com o id do documento, por tipo (usado em buildStop) */
export const SOURCE_ID_FIELD = { PEDIDO: 'order_id', ORCAMENTO: 'budget_id', NFE: 'invoice_id' };
