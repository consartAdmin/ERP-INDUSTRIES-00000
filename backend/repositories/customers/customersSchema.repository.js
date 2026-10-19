// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersSchema.repository.js — ensureTable                        ║
// ║ Roda o DDL do domínio de clientes em uma única transação.          ║
// ║ Chamar UMA vez no boot do servidor, nunca dentro de uma request.   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { ensureCustomersAddressDeliveryTable } from './customersAddressDelivery.schema.js';
import { ensureCustomersTable } from './customers.schema.js';
import { ensureCustomersAttachmentsTable } from './customersAttachments.schema.js';

// Ordem importa: tabelas referenciadas por FK vêm antes.
const STEPS = [
  ensureCustomersAddressDeliveryTable,
  ensureCustomersTable,
  ensureCustomersAttachmentsTable,
];

export async function ensureTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const step of STEPS) {
      await step(client);
    }

    await client.query('COMMIT');

    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default ensureTable;
