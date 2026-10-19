// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMap.index.js — ponto de entrada do mapa de status NF-e    ║
// ║ Mantém a mesma API pública do antigo nfeStatusMapApi.js            ║
// ║ (o original não tinha export default)                              ║
// ╚════════════════════════════════════════════════════════════════════╝

export { list, getById, getByCode } from './nfeStatusMapQuery.repository.js';
export { resolveStatusId, requireByCode } from './nfeStatusMapResolve.repository.js';
