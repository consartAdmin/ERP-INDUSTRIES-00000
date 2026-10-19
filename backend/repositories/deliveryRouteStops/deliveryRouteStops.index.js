// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStops.index.js — ponto de entrada (Paradas de Rotas)  ║
// ║ Mantém a mesma API pública do antigo deliveryRouteStopsApi.js      ║
// ╚════════════════════════════════════════════════════════════════════╝

export { createDeliveryRouteStop } from './deliveryRouteStopsCreate.repository.js';
export {
  getDeliveryRouteStopById,
  listDeliveryRouteStopsByRoute,
} from './deliveryRouteStopsQuery.repository.js';
export {
  updateDeliveryRouteStop,
  setDeliveryRouteStopStatus,
} from './deliveryRouteStopsUpdate.repository.js';
export { deleteDeliveryRouteStop } from './deliveryRouteStopsRemove.repository.js';
export { reorderDeliveryRouteStops } from './deliveryRouteStopsReorder.repository.js';
