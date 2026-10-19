// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRoutes.index.js — ponto de entrada (Rotas de Entrega)      ║
// ║ Mantém a mesma API pública do antigo deliveryRoutesApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

export { createDeliveryRoute } from './deliveryRoutesCreate.repository.js';
export {
  getDeliveryRouteById,
  listDeliveryRoutes,
} from './deliveryRoutesQuery.repository.js';
export {
  updateDeliveryRoute,
  setDeliveryRouteActive,
} from './deliveryRoutesUpdate.repository.js';
export { deleteDeliveryRoute } from './deliveryRoutesRemove.repository.js';
