// ╔════════════════════════════════════════════════════════════════════╗
// ║ dreGerencial.index.js — ponto de entrada do módulo DRE Gerencial   ║
// ║ Mantém a mesma API pública do antigo dreGerencialApi.js            ║
// ║ (somente default export; o original não tinha named exports)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getResumo } from './dreGerencialResumo.repository.js';
import { listDespesas } from './dreGerencialDespesasQuery.repository.js';
import { createDespesa, updateDespesa, deleteDespesa } from './dreGerencialDespesasMutation.repository.js';

export default {
  getResumo,
  listDespesas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
};
