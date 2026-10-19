// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasQuery.repository.js — listagem e busca por chave        ║
// ║ Tabela: public."nfeXmlAntigas"                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeXmlAntigas.constants.js';

// ╔═══════════════════════════════════════════════════════════════════╗
// ║ LISTAGEM COM FILTROS + PAGINAÇÃO                                 ║
// ╚═══════════════════════════════════════════════════════════════════╝

export async function listNfeXmlAntigas(filters, pagination) {
  const {
    q,
    accessKey,
    cnpj,
    startDate,
    endDate,
    number,
    series,
    status
  } = filters;

  const { page, pageSize } = pagination;

  const where = [];
  const params = [];
  let idx = 1;

  if (q) {
    where.push(`(
      LOWER(dest_name)   LIKE LOWER($${idx})
      OR LOWER(emitter_name) LIKE LOWER($${idx})
      OR access_key      LIKE $${idx}
    )`);
    params.push(`%${q}%`);
    idx++;
  }

  if (accessKey) {
    where.push(`access_key = $${idx}`);
    params.push(accessKey);
    idx++;
  }

  if (cnpj) {
    where.push(`dest_cnpj_cpf = $${idx}`);
    params.push(cnpj);
    idx++;
  }

  if (startDate) {
    where.push(`issue_date >= $${idx}`);
    params.push(startDate);
    idx++;
  }

  if (endDate) {
    where.push(`issue_date <= $${idx}`);
    params.push(endDate);
    idx++;
  }

  if (number) {
    where.push(`number = $${idx}`);
    params.push(number);
    idx++;
  }

  if (series) {
    where.push(`series = $${idx}`);
    params.push(series);
    idx++;
  }

  if (status) {
    where.push(`status_sefaz = $${idx}`);
    params.push(status);
    idx++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TB}
    ${whereSql}
  `;

  const offset = (page - 1) * pageSize;

  const listSql = `
    SELECT
      id,
      access_key,
      model,
      series,
      number,
      issue_date,
      emitter_name,
      emitter_cnpj,
      dest_name,
      dest_cnpj_cpf,
      total_value,
      status_sefaz,
      status_desc,
      environment
    FROM ${TB}
    ${whereSql}
    ORDER BY issue_date DESC, id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  try {
    const totalResult = await pool.query(countSql, params);
    const listResult = await pool.query(listSql, params);

    return {
      total: Number(totalResult.rows[0]?.total || 0),
      page,
      pageSize,
      data: listResult.rows
    };
  } catch (err) {
    console.error('[listNfeXmlAntigas] Erro:', err);
    throw err;
  }
}

// ╔═══════════════════════════════════════════════════════════════════╗
// ║ BUSCAR UMA NF-e POR CHAVE DE ACESSO                              ║
// ╚═══════════════════════════════════════════════════════════════════╝

export async function getNfeXmlAntigasByAccessKey(accessKey) {
  try {
    const sql = `
      SELECT *
      FROM ${TB}
      WHERE access_key = $1
      LIMIT 1
    `;
    const result = await pool.query(sql, [accessKey]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('[getNfeXmlAntigasByAccessKey] Erro:', err);
    throw err;
  }
}
