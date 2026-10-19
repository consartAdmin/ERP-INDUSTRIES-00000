// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehicles.index.js — ponto de entrada da frota (Entregas)           ║
// ║ Mantém a mesma API pública do antigo deliveryTrips/vehiclesApi.js  ║
// ║ (o original não tinha export default)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listVehicles, getVehicleById } from './vehiclesQuery.repository.js';
export { createVehicle } from './vehiclesCreate.repository.js';
export { updateVehicle } from './vehiclesUpdate.repository.js';
export { deleteVehicle } from './vehiclesRemove.repository.js';
