// ╔══════════════════════════════════════════════════════════════════════╗
// ║ upsertFromBonus.repository.js — CONSART ERP | Notas Fiscais Emitidas ║
// ║ Cria ou atualiza a NF-e autorizada originada de uma bonificação      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  pool,
  TB_INVOICES,
  createAuditLog,
  normalizeNfeStatusCode,
  resolveNfeStatus,
  normalizeMoney,
  normalizeText,
  normalizeUserId,
  rowToInvoice,
} from './_shared.js';

export async function upsertFromBonus(data = {}, { userId = null } = {}) {
  const bonusId = Number(data.bonus_id);
  if (!Number.isSafeInteger(bonusId) || bonusId <= 0) {
    return { ok: false, error: 'bonus_id inválido' };
  }

  const statusCode = normalizeNfeStatusCode(data.nfe_status);

  if (statusCode !== 'AUTORIZADO') {
    return {
      ok: false,
      error: 'A NF-e de bonificação ainda não está autorizada',
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
  if (!nfeKey || !/^\d{44}$/.test(nfeKey)) {
    return {
      ok: false,
      error: 'Chave de acesso da NF-e ausente ou inválida',
    };
  }

  const { rows } = await pool.query(
    `
      INSERT INTO ${TB_INVOICES} (
        order_id,
        budget_id,
        bonus_id,
        source_type,
        nfe_number,
        nfe_key,
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
        NULL, NULL, $1, 'BONUS', $2, $3, $4, $5, $6, $7, $8, $9,
        COALESCE($10::timestamptz, NOW()),
        COALESCE($11::date, CURRENT_DATE),
        $12, $13, $14, $15
      )
      ON CONFLICT (bonus_id) WHERE bonus_id IS NOT NULL
      DO UPDATE SET
        source_type = 'BONUS',
        nfe_number = EXCLUDED.nfe_number,
        nfe_key = EXCLUDED.nfe_key,
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
      bonusId,
      data.nfe_number ?? null,
      nfeKey,
      statusMap.nfe_status_id,
      statusMap.code,
      normalizeText(data.nfe_protocol),
      normalizeText(data.nfe_environment),
      normalizeText(data.xml_url),
      normalizeText(data.danfe_url),
      data.issued_at ?? null,
      data.issued_date ?? null,
      normalizeMoney(data.total_amount, 0),
      normalizeText(data.customer_name),
      normalizeText(data.customer_tax_id),
      normalizeText(data.customer_email),
    ]
  );

  await createAuditLog({
    tabela: 'invoicesIssued',
    register_id: rows[0].invoice_id,
    operation: 'UPSERT_FROM_BONUS',
    user_id: normalizeUserId(userId),
    before: null,
    after: rowToInvoice(rows[0]),
  });

  return {
    ok: true,
    invoice: rowToInvoice(rows[0]),
  };
}

export default upsertFromBonus;
