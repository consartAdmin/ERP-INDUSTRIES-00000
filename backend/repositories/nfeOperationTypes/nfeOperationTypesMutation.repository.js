// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeOperationTypesMutation.repository.js — create / update / remove ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeOperationTypes.constants.js';
import { positiveInteger, text, boolean } from './nfeOperationTypes.sanitizers.js';
import { rowToOperation } from './nfeOperationTypes.mappers.js';
import { ensureTable } from './nfeOperationTypesSchema.repository.js';

export async function create(data = {}) {
  await ensureTable();
  const code = text(data.code)?.toUpperCase();
  const name = text(data.name);
  const nature = text(data.nature_operation);
  if (!code || !name || !nature) return { ok: false, error: 'code, name e nature_operation são obrigatórios' };
  const { rows } = await pool.query(`
    INSERT INTO ${TB} (code, name, nature_operation, cfop_internal, cfop_interstate, generates_receivable, moves_stock, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
  `, [code, name, nature, text(data.cfop_internal), text(data.cfop_interstate), boolean(data.generates_receivable), boolean(data.moves_stock, true), boolean(data.active, true)]);
  return { ok: true, operation: rowToOperation(rows[0]) };
}

export async function update(operationTypeId, patch = {}) {
  await ensureTable();
  const id = positiveInteger(operationTypeId);
  if (!id) return { ok: false, error: 'operation_type_id inválido' };
  const allowed = ['code','name','nature_operation','cfop_internal','cfop_interstate','generates_receivable','moves_stock','active'];
  const sets = [];
  const args = [];
  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    let value = patch[key];
    if (['code','name','nature_operation','cfop_internal','cfop_interstate'].includes(key)) value = text(value);
    if (key === 'code' && value) value = value.toUpperCase();
    if (['generates_receivable','moves_stock','active'].includes(key)) value = boolean(value);
    args.push(value);
    sets.push(`${key} = $${args.length}`);
  }
  if (!sets.length) return { ok: false, error: 'Nenhum campo para atualizar' };
  args.push(id);
  const { rows } = await pool.query(`UPDATE ${TB} SET ${sets.join(', ')}, updated_at = NOW() WHERE operation_type_id = $${args.length} RETURNING *`, args);
  return rows[0] ? { ok: true, operation: rowToOperation(rows[0]) } : { ok: false, error: 'NOT_FOUND' };
}

export async function remove(operationTypeId) {
  await ensureTable();
  const id = positiveInteger(operationTypeId);
  if (!id) return { ok: false, error: 'operation_type_id inválido' };
  try {
    const { rows } = await pool.query(`DELETE FROM ${TB} WHERE operation_type_id = $1 RETURNING *`, [id]);
    return rows[0] ? { ok: true, deleted: 1, operation: rowToOperation(rows[0]) } : { ok: false, error: 'NOT_FOUND' };
  } catch (error) {
    if (error?.code === '23503') return { ok: false, error: 'OPERATION_TYPE_IN_USE', message: 'Esta operação fiscal já está vinculada e não pode ser excluída. Desative-a em vez de excluir.' };
    throw error;
  }
}
