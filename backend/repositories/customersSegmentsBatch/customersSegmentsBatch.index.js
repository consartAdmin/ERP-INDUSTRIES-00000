// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatch.index.js — ponto de entrada (vínculo lote)  ║
// ║ Mantém a mesma API pública do antigo customersSegmentsBatchApi.js  ║
// ║ Obs: o original não tinha export default — mantido assim.          ║
// ╚════════════════════════════════════════════════════════════════════╝

export { listBatch } from './customersSegmentsBatchQuery.repository.js';
export { batchApply, unlinkOne } from './customersSegmentsBatchUpdate.repository.js';
