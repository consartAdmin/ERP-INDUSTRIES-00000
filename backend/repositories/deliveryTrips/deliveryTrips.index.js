// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryTrips.index.js — ponto de entrada de Rotas do dia/Paradas  ║
// ║ Mantém a mesma API pública do antigo deliveryTripsApi.js           ║
// ║ (o original não tinha export default)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listSources } from './deliveryTripsSources.repository.js';
export { listTrips, getTrip } from './deliveryTripsQuery.repository.js';
export { createTrip } from './deliveryTripsCreate.repository.js';
export { updateTrip, setTripStatus } from './deliveryTripsUpdate.repository.js';
export { deleteTrip } from './deliveryTripsRemove.repository.js';
export {
  addStops,
  updateStop,
  setStopStatus,
  deleteStop,
  reorderStops,
} from './deliveryTripsStops.repository.js';
