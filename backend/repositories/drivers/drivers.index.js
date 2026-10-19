// ╔════════════════════════════════════════════════════════════════════╗
// ║ drivers.index.js — ponto de entrada de motoristas (Entregas)       ║
// ║ Mantém a mesma API pública do antigo deliveryTrips/driversApi.js   ║
// ║ (o original não tinha export default)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listDrivers, getDriverById, listEligibleEmployees } from './driversQuery.repository.js';
export { createDriver } from './driversCreate.repository.js';
export { updateDriver } from './driversUpdate.repository.js';
export { deleteDriver } from './driversRemove.repository.js';
