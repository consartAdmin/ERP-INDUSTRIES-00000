// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableCashMovement.repository.js — ENTRADA no caixa    ║
// ║ syncReceivableCashMovement → public."cashMoviments"                ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  TB,
  TB_BRIDGE,
  TB_CUSTOMERS,
  TB_BANK_ACCOUNTS,
  TB_CASH_DOCUMENT_TYPES,
  TB_CASH_MOVEMENTS,
  AR_CASH_MOVEMENT_START_DATE,
} from './accountsReceivable.constants.js';
import { accountBankSql, effectiveBankAccountIdSql } from './accountsReceivable.sql.js';
import { isReceivedStatus, toIsoDate, cut, money } from './accountsReceivable.utils.js';

/* ===================================================================
   CAIXA — ENTRADA automática para contas recebidas
   Toda conta a receber recebida (manual ou Asaas) gera 1 movimentação
   em public."cashMoviments", vinculada por accounts_receivable_id
   (índice único ux_cashmoviments_accounts_receivable_id).
   - Estorno (deixa de estar recebida) → movimentação fica is_active = false
   - Contas já recebidas antes deste recurso não geram movimentação:
     cria quando a conta PASSA a recebida ou quando o recebimento é
     a partir de AR_CASH_MOVEMENT_START_DATE (permite reprocessar o Asaas)
   =================================================================== */

/**
 * Cria / reativa / desativa a ENTRADA de caixa de uma conta a receber.
 *
 * @param {object} executor  pool ou client (dentro de transação)
 * @param {number|string} accountId
 * @param {object} [opts]
 * @param {boolean} [opts.isTransition=false] a conta acabou de passar a recebida
 * @param {boolean} [opts.refresh=false] atualiza a movimentação já existente
 * @param {string}  [opts.movementDate] data/hora do recebimento (YYYY-MM-DDTHH:mm)
 * @param {object}  [opts.breakdown] { amount, interest, charges } do recebimento manual
 * @returns {Promise<{ action: string, id?: number }>}
 */
export async function syncReceivableCashMovement(executor, accountId, {
  isTransition = false,
  refresh = false,
  movementDate = null,
  breakdown = null,
} = {}) {
  const { rows: accountRows } = await executor.query(
    `
    SELECT
      ar.id,
      ar.status,
      ar.value,
      ar.amount_paid,
      ar.payment_date,
      ar.description,
      ar.invoice_number,
      ar.document_number,
      ar.category_id,
      ar.subcategory_id,
      ar.chart_account_id,
      COALESCE(
        NULLIF(TRIM(c.trade_name), ''),
        NULLIF(TRIM(c.legal_name), ''),
        asa.asaas_customer_name
      ) AS customer_name,
      ${accountBankSql('ba', 'asa')} AS bank_name,
      ${effectiveBankAccountIdSql('ar', 'asa')} AS effective_bank_account_id,
      dt.name AS document_type_name,
      (asa.id IS NOT NULL) AS is_asaas
    FROM ${TB} ar
    LEFT JOIN ${TB_CUSTOMERS} c ON c.customer_id = ar.customer_id
    LEFT JOIN ${TB_BANK_ACCOUNTS} ba ON ba.id = ar.bank_account_id
    LEFT JOIN ${TB_CASH_DOCUMENT_TYPES} dt ON dt.id = ar.document_type_id
    LEFT JOIN LATERAL (
      SELECT b.id, b.asaas_customer_name
      FROM ${TB_BRIDGE} b
      WHERE b.accounts_receivable_id = ar.id
      ORDER BY b.id DESC
      LIMIT 1
    ) asa ON TRUE
    WHERE ar.id = $1
    `,
    [accountId]
  );

  const account = accountRows[0];
  if (!account) return { action: 'account-not-found' };

  const { rows: cashRows } = await executor.query(
    `
    SELECT id, is_active
    FROM ${TB_CASH_MOVEMENTS}
    WHERE accounts_receivable_id = $1
    FOR UPDATE
    `,
    [account.id]
  );
  const existing = cashRows[0] || null;

  // Estorno / cancelamento: desativa, mantendo o histórico
  if (!isReceivedStatus(account.status)) {
    if (existing?.is_active) {
      await executor.query(
        `UPDATE ${TB_CASH_MOVEMENTS} SET is_active = FALSE, updated_at = now() WHERE id = $1`,
        [existing.id]
      );
      return { action: 'deactivated', id: Number(existing.id) };
    }
    return { action: 'none' };
  }

  // Asaas RECEIVED_IN_CASH chega com amount_paid = 0 → usa o valor da conta
  const total = money(Number(account.amount_paid) > 0 ? account.amount_paid : account.value);
  if (total <= 0) return { action: 'skipped-zero' };

  let amount = total;
  let interest = 0;
  let charges = 0;
  if (breakdown) {
    interest = money(breakdown.interest);
    charges = money(breakdown.charges);
    amount = money(breakdown.amount);
    // Garante Total do caixa = valor recebido
    if (amount < 0 || money(amount + interest + charges) !== total) {
      amount = total;
      interest = 0;
      charges = 0;
    }
  }

  const paymentDate = toIsoDate(account.payment_date);
  const movementTimestamp = movementDate
    ? String(movementDate).replace('T', ' ').slice(0, 19)
    : `${paymentDate || toIsoDate(new Date())} 00:00:00`;

  const notes = [
    `Recebimento conta a receber #${account.id}`,
    account.description ? `– ${String(account.description).trim()}` : '',
    account.is_asaas ? '(Asaas)' : '',
  ].filter(Boolean).join(' ');

  const values = [
    movementTimestamp,                                              // $1 movement_date
    cut(account.bank_name, 50) || (account.is_asaas ? 'ASAAS' : 'CAIXA'), // $2 cash_account
    amount,                                                         // $3 amount
    cut(account.document_type_name, 20) || (account.is_asaas ? 'BOLETO' : null), // $4
    cut(account.invoice_number || account.document_number || `CR-${account.id}`, 50), // $5
    cut(account.customer_name, 255),                                // $6 supplier_name
    notes,                                                          // $7 notes
    interest,                                                       // $8 interest_amount
    charges,                                                        // $9 fee_amount
    account.category_id != null ? String(account.category_id) : null,       // $10
    account.subcategory_id != null ? String(account.subcategory_id) : null, // $11
    account.chart_account_id ?? null,                               // $12
    account.id,                                                     // $13
    account.effective_bank_account_id ?? null,                      // $14 bank_account_id
  ];

  if (existing) {
    if (!refresh && existing.is_active) return { action: 'unchanged', id: Number(existing.id) };

    await executor.query(
      `
      UPDATE ${TB_CASH_MOVEMENTS}
      SET
        movement_date    = $1,
        movement_type    = 'ENTRADA',
        cash_account     = $2,
        amount           = $3,
        document_type    = $4,
        document_number  = $5,
        supplier_name    = $6,
        notes            = $7,
        penalty_amount   = 0,
        interest_amount  = $8,
        fee_amount       = $9,
        category         = $10,
        subcategory      = $11,
        chart_account_id = $12,
        bank_account_id  = $14,
        is_active        = TRUE,
        updated_at       = now()
      WHERE accounts_receivable_id = $13
      `,
      values
    );
    return { action: existing.is_active ? 'updated' : 'reactivated', id: Number(existing.id) };
  }

  const isNewReceipt =
    isTransition || (paymentDate && paymentDate >= AR_CASH_MOVEMENT_START_DATE);
  if (!isNewReceipt) return { action: 'skipped-before-start-date' };

  const { rows: inserted } = await executor.query(
    `
    INSERT INTO ${TB_CASH_MOVEMENTS} (
      movement_date, movement_type, cash_account, amount,
      document_type, document_number, supplier_name, notes,
      penalty_amount, interest_amount, fee_amount,
      category, subcategory, chart_account_id,
      accounts_receivable_id, bank_account_id, is_active
    ) VALUES (
      $1, 'ENTRADA', $2, $3,
      $4, $5, $6, $7,
      0, $8, $9,
      $10, $11, $12,
      $13, $14, TRUE
    )
    ON CONFLICT (accounts_receivable_id) WHERE accounts_receivable_id IS NOT NULL
    DO NOTHING
    RETURNING id
    `,
    values
  );

  if (inserted[0]) {
    console.info('[AR:CAIXA] entrada criada', { accountId: account.id, cashMovementId: inserted[0].id, total });
    return { action: 'created', id: Number(inserted[0].id) };
  }
  return { action: 'already-exists' };
}
