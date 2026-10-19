// ╔════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonial.utils.js — Helpers de query, ordenação e WHERE  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/** Execução de queries com retorno de linhas */
export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}

/** Ordenação segura */
export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return '';
  const [col, dirRaw] = String(orderBy).trim().split(/\s+/);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';
  return colSafe ? ` ORDER BY "${colSafe}" ${dir} ` : '';
}

/** Monta WHERE dinâmico a partir dos filtros */
export function buildWhere({ q:search, categoria, dt_from, dt_to }) {
  const where = [];
  const params = [];
  let i = 1;

  if (search) {
    where.push(`("asset_code" ILIKE $${i} OR "descricao" ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (categoria) {
    where.push(`"categoria" = $${i++}`);
    params.push(categoria);
  }
  if (dt_from) {
    where.push(`"data_aquisicao" >= $${i++}`);
    params.push(dt_from);
  }
  if (dt_to) {
    where.push(`"data_aquisicao" <= $${i++}`);
    params.push(dt_to);
  }
  return { whereSql: where.length ? ` WHERE ${where.join(' AND ')} ` : '', params };
}
