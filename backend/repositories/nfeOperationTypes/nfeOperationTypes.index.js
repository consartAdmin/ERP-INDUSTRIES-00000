// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypes.index.js — ponto de entrada do módulo            ║
// ║ Mantém a mesma API pública do antigo nfeOperationTypesApi.js       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './nfeOperationTypesSchema.repository.js';
import { search, getById, getByCode } from './nfeOperationTypesQuery.repository.js';
import { create, update, remove } from './nfeOperationTypesMutation.repository.js';

export { ensureTable, search, getById, getByCode, create, update, remove };

export default { ensureTable, search, getById, getByCode, create, update, remove };
