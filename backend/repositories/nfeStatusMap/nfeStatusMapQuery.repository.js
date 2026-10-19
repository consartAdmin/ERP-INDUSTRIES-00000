// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMapQuery.repository.js — list / getById / getByCode       ║
// ║ Tabela: public."nfeStatusMap"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeStatusMap.constants.js';
import { mapRow } from './nfeStatusMap.mappers.js';


/* =========================================================================
 * List
 * ========================================================================= */

export async function list({ activeOnly = true } = {}) {
    try {
        let sql = `
            SELECT
                nfe_status_id,
                code,
                name,
                description,
                is_final,
                is_authorized,
                is_active,
                created_at,
                updated_at
            FROM ${TB}
        `;

        if (activeOnly) {
            sql += `
                WHERE is_active = TRUE
            `;
        }

        sql += `
            ORDER BY nfe_status_id ASC
        `;

        const { rows } = await pool.query(sql);

        return {
            ok: true,
            data: rows.map(mapRow),
        };
    } catch (error) {
        console.error('[nfeStatusMapApi:list]', error);

        return {
            ok: false,
            status: 500,
            error: 'Erro ao listar os status de NF-e.',
        };
    }
}


/* =========================================================================
 * Get by ID
 * ========================================================================= */

export async function getById(nfeStatusId) {
    try {
        const id = Number(nfeStatusId);

        if (!Number.isInteger(id) || id <= 0) {
            return {
                ok: false,
                status: 400,
                error: 'nfe_status_id inválido.',
            };
        }

        const { rows } = await pool.query(
            `
                SELECT
                    nfe_status_id,
                    code,
                    name,
                    description,
                    is_final,
                    is_authorized,
                    is_active,
                    created_at,
                    updated_at
                FROM ${TB}
                WHERE nfe_status_id = $1
                LIMIT 1
            `,
            [id]
        );

        if (!rows.length) {
            return {
                ok: false,
                status: 404,
                error: 'Status de NF-e não encontrado.',
            };
        }

        return {
            ok: true,
            data: mapRow(rows[0]),
        };
    } catch (error) {
        console.error('[nfeStatusMapApi:getById]', error);

        return {
            ok: false,
            status: 500,
            error: 'Erro ao consultar o status de NF-e.',
        };
    }
}


/* =========================================================================
 * Get by code
 * ========================================================================= */

export async function getByCode(code) {
    try {
        const normalizedCode = String(code || '')
            .trim()
            .toUpperCase();

        if (!normalizedCode) {
            return {
                ok: false,
                status: 400,
                error: 'Código do status não informado.',
            };
        }

        const { rows } = await pool.query(
            `
                SELECT
                    nfe_status_id,
                    code,
                    name,
                    description,
                    is_final,
                    is_authorized,
                    is_active,
                    created_at,
                    updated_at
                FROM ${TB}
                WHERE UPPER(code) = $1
                LIMIT 1
            `,
            [normalizedCode]
        );

        if (!rows.length) {
            return {
                ok: false,
                status: 404,
                error: 'Status de NF-e não encontrado.',
            };
        }

        return {
            ok: true,
            data: mapRow(rows[0]),
        };
    } catch (error) {
        console.error('[nfeStatusMapApi:getByCode]', error);

        return {
            ok: false,
            status: 500,
            error: 'Erro ao consultar o status de NF-e.',
        };
    }
}
