// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasRemove.repository.js — excluir XML antiga pela chave    ║
// ║ Tabela: public."nfeXmlAntigas"                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeXmlAntigas.constants.js';

// ╔═══════════════════════════════════════════════════════════════════╗
// ║ DELETAR XML ANTIGA PELA CHAVE                                    ║
// ╚═══════════════════════════════════════════════════════════════════╝

export async function deleteNfeXmlAntigasByAccessKey(accessKey) {
  try {
    const sql = `
      DELETE FROM ${TB}
      WHERE access_key = $1
      RETURNING access_key
    `;
    const result = await pool.query(sql, [accessKey]);
    return !!result.rowCount;
  } catch (err) {
    console.error('[deleteNfeXmlAntigasByAccessKey] Erro:', err);
    throw err;
  }
}
