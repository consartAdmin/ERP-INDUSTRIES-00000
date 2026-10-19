// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSyncLookup.repository.js — localiza cobranças            ║
// ║ findLocalLink (ponte local) e findRemotePayment (Asaas)          ║
// ╚══════════════════════════════════════════════════════════════════╝

import * as asaasApi from '../../repositories/asaas/asaas.index.js';
import { TB_BRIDGE } from './nfeAsaasSync.constants.js';

// ============================================================================
// LOCALIZAÇÃO / REUTILIZAÇÃO DE COBRANÇAS
// ============================================================================

export async function findLocalLink(client, externalReference) {
  const result = await client.query(
    `
      SELECT
        asa.accounts_receivable_id,
        asa.asaas_payment_id,
        asa.last_status,
        asa.raw
      FROM ${TB_BRIDGE} asa
      WHERE asa.raw->>'externalReference' = $1
      LIMIT 1
    `,
    [externalReference],
  );

  return result.rows[0] || null;
}

export async function findRemotePayment(externalReference) {
  const result = await asaasApi.listPayments({
    externalReference,
    limit: 1,
    offset: 0,
    sort: 'dueDate',
    order: 'asc',
  });

  return Array.isArray(result?.data) ? (result.data[0] || null) : null;
}
