// ╔══════════════════════════════════════════════════════════════════════╗
// ║ upsertFromBudget.repository.js — CONSART ERP | Notas Fiscais Emitidas║
// ║ Cria ou atualiza a NF-e autorizada originada de um orçamento         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  createAuditLog,
  normalizeNfeStatusCode,
  resolveNfeStatus,
  normalizeBrazilianDate,
  normalizeBrazilianDateTime,
  normalizeMoney,
  normalizeText,
  normalizeUserId,
  rowToInvoice,
} from './_shared.js';

export async function upsertFromBudget(
  data = {},
  { userId = null } = {}
) {
  const budgetId = Number(data.budget_id);
  if (!Number.isSafeInteger(budgetId) || budgetId <= 0) {
    return { ok: false, error: 'budget_id inválido' };
  }

  const statusCode = normalizeNfeStatusCode(data.nfe_status);

  if (statusCode !== 'AUTORIZADO') {
    return {
      ok: false,
      error: 'A NF-e do orçamento ainda não está autorizada',
    };
  }

  const statusMap = await resolveNfeStatus(statusCode);

  if (!statusMap) {
    return {
      ok: false,
      error: `Status ${statusCode} não cadastrado em nfeStatusMap`,
    };
  }

  const nfeKey = normalizeText(data.nfe_key);
  const nfeProviderId = normalizeText(data.nfe_provider_id || data.nfe_id_integracao);

  if (!nfeKey || !/^\d{44}$/.test(nfeKey)) {
    return { ok: false, error: 'Chave de acesso da NF-e ausente ou inválida' };
  }

  const { rows } = await pool.query(
    `
      INSERT INTO ${TB_INVOICES} (
        order_id,
        budget_id,
        source_type,
        nfe_number,
        nfe_key,
        nfe_provider_id,
        nfe_status_id,
        nfe_status,
        nfe_protocol,
        nfe_environment,
        xml_url,
        danfe_url,
        issued_at,
        issued_date,
        total_amount,
        customer_name,
        customer_tax_id,
        customer_email
      )
      VALUES (
        NULL, $1, 'BUDGET', $2, $3, $4, $5, $6, $7, $8,
        $9, $10, COALESCE($11::timestamptz, NOW()),
        COALESCE($12::date, CURRENT_DATE), $13, $14, $15, $16
      )
      ON CONFLICT (budget_id) WHERE budget_id IS NOT NULL
      DO UPDATE SET
        source_type = 'BUDGET',
        nfe_number = EXCLUDED.nfe_number,
        nfe_key = EXCLUDED.nfe_key,
        nfe_provider_id = COALESCE(EXCLUDED.nfe_provider_id, ${TB_INVOICES}.nfe_provider_id),
        nfe_status_id = EXCLUDED.nfe_status_id,
        nfe_status = EXCLUDED.nfe_status,
        nfe_protocol = EXCLUDED.nfe_protocol,
        nfe_environment = EXCLUDED.nfe_environment,
        xml_url = EXCLUDED.xml_url,
        danfe_url = EXCLUDED.danfe_url,
        issued_at = COALESCE(${TB_INVOICES}.issued_at, EXCLUDED.issued_at),
        issued_date = COALESCE(${TB_INVOICES}.issued_date, EXCLUDED.issued_date),
        total_amount = EXCLUDED.total_amount,
        customer_name = EXCLUDED.customer_name,
        customer_tax_id = EXCLUDED.customer_tax_id,
        customer_email = EXCLUDED.customer_email,
        updated_at = NOW()
      RETURNING *
    `,
    [
      budgetId,
      data.nfe_number ?? null,
      nfeKey,
      nfeProviderId,
      statusMap.nfe_status_id,
      statusMap.code,
      normalizeText(data.nfe_protocol),
      normalizeText(data.nfe_environment),
      normalizeText(data.xml_url),
      normalizeText(data.danfe_url),
      normalizeBrazilianDateTime(data.issued_at),
      normalizeBrazilianDate(data.issued_date),
      normalizeMoney(data.total_amount, 0),
      normalizeText(data.customer_name),
      normalizeText(data.customer_tax_id),
      normalizeText(data.customer_email),
    ],
  );

  await createAuditLog({
    tabela: 'invoicesIssued',
    register_id: rows[0].invoice_id,
    operation: 'UPSERT_FROM_BUDGET',
    user_id: normalizeUserId(userId),
    before: null,
    after: rowToInvoice(rows[0]),
  });

  return { ok: true, invoice: rowToInvoice(rows[0]) };
}

export default upsertFromBudget;
