// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesQuery.repository.js — list / getById / getDefault   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_SIGNATURES_TABLE } from './emailSignatures.constants.js';
import { withClient } from './emailSignatures.utils.js';
import { buildOwnerWhere } from './emailSignatures.sql.js';

/**
 * Lista assinaturas, opcionalmente filtrando por usuário.
 * @param {import('pg').Pool} pgPool
 * @param {{ ownerUserId?: number | null }} [options]
 */
export async function list(pgPool, options = {}) {
  const { ownerUserId = null } = options;

  return withClient(pgPool, async (client) => {
    if (ownerUserId === 'all') {
      const { rows } = await client.query(
        `SELECT *
           FROM ${EMAIL_SIGNATURES_TABLE}
          ORDER BY owneruserid NULLS FIRST, isdefault DESC, name ASC`
      );
      return rows;
    }

    const { where, params } = buildOwnerWhere(ownerUserId);
    const { rows } = await client.query(
      `SELECT *
         FROM ${EMAIL_SIGNATURES_TABLE}
        WHERE ${where}
        ORDER BY isdefault DESC, name ASC`,
      params
    );
    return rows;
  });
}

/**
 * Busca assinatura por ID
 * @param {import('pg').Pool} pgPool
 * @param {number} id
 */
export async function getById(pgPool, id) {
  return withClient(pgPool, async (client) => {
    const { rows } = await client.query(
      `SELECT *
         FROM ${EMAIL_SIGNATURES_TABLE}
        WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  });
}

/**
 * Busca assinatura padrão para um usuário.
 * Estratégia:
 *  1) Tenta assinatura default do usuário (owneruserid = user)
 *  2) Se não existir, tenta default global (owneruserid IS NULL)
 *
 * @param {import('pg').Pool} pgPool
 * @param {number|null} [ownerUserId]
 */
export async function getDefault(pgPool, ownerUserId = null) {
  return withClient(pgPool, async (client) => {
    // 1) Default do usuário, se informado
    if (ownerUserId != null) {
      const { rows } = await client.query(
        `SELECT *
           FROM ${EMAIL_SIGNATURES_TABLE}
          WHERE owneruserid = $1
            AND isdefault = TRUE
          LIMIT 1`,
        [ownerUserId]
      );
      if (rows[0]) return rows[0];
    }

    // 2) Default global
    const { rows: globalRows } = await client.query(
      `SELECT *
         FROM ${EMAIL_SIGNATURES_TABLE}
        WHERE owneruserid IS NULL
          AND isdefault = TRUE
        LIMIT 1`
    );
    return globalRows[0] || null;
  });
}
