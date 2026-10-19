// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acao.index.js — ponto de entrada do módulo plano_acao        ║
// ║ Mantém a mesma API pública do antigo plano_acaoApi.js              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list, getById } from './plano_acaoQuery.repository.js';
import { create } from './plano_acaoCreate.repository.js';
import { updateById } from './plano_acaoUpdate.repository.js';
import { removeById } from './plano_acaoRemove.repository.js';
import { bulkUpsert } from './plano_acaoBulkUpsert.repository.js';

export { list, getById, create, updateById, removeById, bulkUpsert };
