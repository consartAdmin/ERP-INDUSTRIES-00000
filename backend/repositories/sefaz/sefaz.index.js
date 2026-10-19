// ╔════════════════════════════════════════════════════════════════════╗
// ║ sefaz.index.js — ponto de entrada do provedor “SEFAZ” (mock)       ║
// ║ Mantém a mesma API pública do antigo sefazApi.js (só default)      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { searchSefazByCnpj, searchSefazByIe } from './sefazQuery.repository.js';

// Export default no padrão que você já está usando.
export default {
  searchSefazByCnpj,
  searchSefazByIe
};
