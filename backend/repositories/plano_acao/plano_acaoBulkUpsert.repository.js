// ╔════════════════════════════════════════════════════════════════════╗
// ║ plano_acaoBulkUpsert.repository.js — bulkUpsert (import Excel)     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toInt } from './plano_acao.sanitizers.js';
import { create } from './plano_acaoCreate.repository.js';
import { updateById } from './plano_acaoUpdate.repository.js';

/**
 * bulkUpsert:
 * - recebe array de linhas (como import do Excel)
 * - se vier `id`, atualiza por id
 * - se não vier id, cria
 */
export async function bulkUpsert(rows = []) {
  if (!Array.isArray(rows)) {
    const err = new Error('Payload inválido: esperado array.');
    err.statusCode = 400;
    throw err;
  }

  const out = [];
  for (const row of rows) {
    const id = toInt(row?.id, null);
    if (id) out.push(await updateById(id, row));
    else out.push(await create(row));
  }
  return out;
}
