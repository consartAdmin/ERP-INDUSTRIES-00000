// ╔══════════════════════════════════════════════════════════════════════╗
// ║ getByProviderId.repository.js — CONSART ERP | Notas Fiscais Emitidas ║
// ║ Busca a NF-e pelo ID interno do provedor (PlugNotas / TecnoSpeed)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  TB_NFE_STATUS_MAP,
  normalizeText,
  rowToInvoice,
} from './_shared.js';

export async function getByProviderId(providerId) {
  const provider = normalizeText(providerId);

  if (!provider) {
    return {
      ok: false,
      error: 'nfe_provider_id inválido',
    };
  }

  const { rows } = await pool.query(
    `
      SELECT
        i.*,
        nsm.code AS nfe_status_code,
        nsm.name AS nfe_status_name
      FROM ${TB_INVOICES} i
      LEFT JOIN ${TB_NFE_STATUS_MAP} nsm
        ON nsm.nfe_status_id = i.nfe_status_id
      WHERE i.nfe_provider_id = $1
      ORDER BY i.invoice_id DESC
      LIMIT 1
    `,
    [provider]
  );

  if (!rows.length) {
    return {
      ok: false,
      error: 'NOT_FOUND',
    };
  }

  return {
    ok: true,
    invoice: rowToInvoice(rows[0]),
  };
}

export default getByProviderId;
