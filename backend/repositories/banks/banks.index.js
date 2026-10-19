// ╔════════════════════════════════════════════════════════════════════╗
// ║ banks.index.js — ponto de entrada do módulo de bancos              ║
// ║ Mantém a mesma API pública do antigo banksApi.js                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { listBanks, getBankById } from './banksQuery.repository.js';
import { createBank, updateBank, deactivateBank } from './banksMutation.repository.js';

export { listBanks, getBankById, createBank, updateBank, deactivateBank };

export default { listBanks, getBankById, createBank, updateBank, deactivateBank };
