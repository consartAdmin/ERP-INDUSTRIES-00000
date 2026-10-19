// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModules.sql.js — WHERE dinâmico (filtros do list)              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ALIAS } from './userModules.constants.js';
import { isFiniteNum } from './userModules.sanitizers.js';

/**
 * Monta WHERE + params dinamicamente
 * Filtros suportados:
 *   - usuario_id  (number)
 *   - modulo_id   (number)
 *   - pode_acessar (boolean)
 */
export function buildWhereAndParams({ usuario_id, modulo_id, pode_acessar } = {}) {
  const where = [];
  const params = [];

  if (isFiniteNum(usuario_id)) {
    params.push(Number(usuario_id));
    where.push(`${ALIAS}.usuario_id = $${params.length}`);
  }

  if (isFiniteNum(modulo_id)) {
    params.push(Number(modulo_id));
    where.push(`${ALIAS}.modulo_id = $${params.length}`);
  }

  if (typeof pode_acessar === 'boolean') {
    params.push(pode_acessar);
    where.push(`${ALIAS}.pode_acessar = $${params.length}`);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { clause, params };
}
