// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locationsMap.repository.js — listLocationMap (mapa completo do depósito) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { TABLES } from './locations.constants.js';

/* ------------------------------------------------------------------------- */
/* 5.1) LOCATION MAP — FULL WAREHOUSE MAP                                    */
/* ------------------------------------------------------------------------- */

export async function listLocationMap(
  pgPool,
  {
    q = '',
    corredor = '',
    prateleira = '',
    bandeja = '',
    onlyActive = true,
    limit = 5000,
  } = {}
) {
  const params = [];
  const where = [];
  let idx = 1;

  const active =
    String(onlyActive ?? 'true')
      .trim()
      .toLowerCase()
      .match(/^(1|true|t|yes|y|sim)$/i);

  if (active) {
    where.push(`
      ll.active = TRUE
      AND lc.active = TRUE
      AND ls.active = TRUE
      AND lb.active = TRUE
    `);
  }

  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);

    where.push(`
      (
        LOWER(COALESCE(ll.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lc.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(ls.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lb.name, '')) LIKE $${idx}
        OR LOWER(COALESCE(lp.name, '')) LIKE $${idx}
      )
    `);

    idx++;
  }

  if (corredor) {
    params.push(`%${String(corredor).toLowerCase()}%`);

    where.push(`
      LOWER(COALESCE(lc.name, '')) LIKE $${idx}
    `);

    idx++;
  }

  if (prateleira) {
    params.push(`%${String(prateleira).toLowerCase()}%`);

    where.push(`
      LOWER(COALESCE(ls.name, '')) LIKE $${idx}
    `);

    idx++;
  }

  if (bandeja) {
    params.push(`%${String(bandeja).toLowerCase()}%`);

    where.push(`
      LOWER(COALESCE(lb.name, '')) LIKE $${idx}
    `);

    idx++;
  }

  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';

  const sql = `
    SELECT
      lb.id AS id,

      ll.id AS local_id,
      lc.id AS corridor_id,
      ls.id AS shelf_id,
      lb.id AS bin_id,
      lp.id AS position_id,

      ll.name AS local,
      lc.name AS corredor,
      ls.name AS prateleira,
      ls.name AS gondola,
      lb.name AS bandeja,
      lb.name AS bin,
      lp.name AS position,

      CONCAT_WS(
        ' / ',
        ll.name,
        lc.name,
        ls.name,
        lb.name,
        lp.name
      ) AS label,

      COALESCE(
        lb.description,
        ls.description,
        lc.description,
        ll.description,
        ''
      ) AS descricao,

      (
        ll.active = TRUE
        AND lc.active = TRUE
        AND ls.active = TRUE
        AND lb.active = TRUE
      ) AS is_active

    FROM ${TABLES.LOCALS} ll

    INNER JOIN ${TABLES.CORRIDORS} lc
      ON lc.local_id = ll.id

    INNER JOIN ${TABLES.SHELVES} ls
      ON ls.corridor_id = lc.id

    INNER JOIN ${TABLES.BINS} lb
      ON lb.shelf_id = ls.id

    LEFT JOIN ${TABLES.POSITIONS} lp
      ON lp.bin_id = lb.id

    ${whereSql}

    ORDER BY
      ll.name ASC,
      lc.name ASC,
      ls.name ASC,
      lb.name ASC,
      lp.name ASC NULLS LAST

    LIMIT ${Math.max(1, Math.min(10000, Number(limit) || 5000))}
  `;

  const { rows } = await pgPool.query(sql, params);

  return rows;
}
