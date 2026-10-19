// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsRemove.repository.js — exclui devolução           ║
// ║ itens primeiro, depois cabeçalho                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE_HEAD, TABLE_ITEMS } from './supplierReturns.constants.js';
import { toNumber } from './supplierReturns.utils.js';
import { ensureTables } from './supplierReturnsSchema.repository.js';
import { getById } from './supplierReturnsGetById.repository.js';

export async function remove(returnId) {
    await ensureTables();

    const id = toNumber(returnId, 0);
    if (!id) throw new Error('ID inválido.');

    const current = await getById(id);
    if (!current) return null;

    if (current.status === 'AUTHORIZED') {
        throw new Error('Devolução autorizada não pode ser excluída.');
    }

    /*
     * Itens primeiro: no banco, supplierReturnNfeItems_return_id_fkey foi
     * criada sem ON DELETE CASCADE (a tabela é anterior ao DDL atual).
     */
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM ${TABLE_ITEMS} WHERE return_id = $1`, [id]);
        await client.query(`DELETE FROM ${TABLE_HEAD} WHERE return_id = $1`, [id]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    return current;
}
