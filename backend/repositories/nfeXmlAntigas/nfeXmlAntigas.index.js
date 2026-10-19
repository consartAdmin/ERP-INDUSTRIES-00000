// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigas.index.js — ponto de entrada (NF-e XML antigas)         ║
// ║ Mantém a mesma API pública do antigo nfeXmlAntigasApi.js             ║
// ║ (somente named exports, sem default — como no original)              ║
// ╚══════════════════════════════════════════════════════════════════════╝

export {
  listNfeXmlAntigas,
  getNfeXmlAntigasByAccessKey,
} from './nfeXmlAntigasQuery.repository.js';
export { deleteNfeXmlAntigasByAccessKey } from './nfeXmlAntigasRemove.repository.js';
export { uploadNfeXmlAntigasFiles } from './nfeXmlAntigasUpload.repository.js';
