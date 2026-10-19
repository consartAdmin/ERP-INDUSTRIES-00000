// ╔════════════════════════════════════════════════════════════════════╗
// ║ debtPaymentsCashMovement.repository.js — SAÍDA no caixa            ║
// ║ Cada pagamento de dívida gera 1 movimentação em "cashMoviments"    ║
// ║ vinculada por debt_payment_id (índice único parcial)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PAYMENTS } from './debtPayments.constants.js';
import { normalizeDate, roundMoney, safeText } from './debtPayments.utils.js';

const TB_CASH_MOVEMENTS = 'public."cashMoviments"';
const TB_BANK_ACCOUNTS = 'public."bankAccounts"';

let columnReady = null;

/**
 * Garante "cashMoviments".debt_payment_id (mesmo SQL de
 * scripts/2026-10-13_cashMoviments_debt_payment_id.sql).
 */
export function ensureDebtPaymentCashColumn() {
  columnReady ??= (async () => {
    await pool.query(`
      ALTER TABLE ${TB_CASH_MOVEMENTS}
        ADD COLUMN IF NOT EXISTS debt_payment_id bigint
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_cashmoviments_debt_payment'
        ) THEN
          ALTER TABLE ${TB_CASH_MOVEMENTS}
            ADD CONSTRAINT fk_cashmoviments_debt_payment
            FOREIGN KEY (debt_payment_id)
            REFERENCES ${TB_PAYMENTS}(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_cashmoviments_debt_payment_id
        ON ${TB_CASH_MOVEMENTS} (debt_payment_id)
        WHERE debt_payment_id IS NOT NULL
    `);
  })().catch((error) => {
    columnReady = null;
    throw error;
  });

  return columnReady;
}

const DEFAULTS_SELECT = `
  SELECT
    m.bank_account_id,
    m.cash_account,
    c.id AS category_id,
    s.id AS subcategory_id,
    m.chart_account_id,
    coa.code AS chart_account_code,
    coa.description AS chart_account_description,
    m.document_type,
    m.is_deductible,
    m.is_pis_cofins_creditable,
    m.deduct_charges_only
  FROM ${TB_CASH_MOVEMENTS} m
  LEFT JOIN "cashCategories" c
    ON c.id::text = m.category::text
    OR UPPER(TRIM(c.name)) = UPPER(TRIM(m.category::text))
  LEFT JOIN "cashSubcategories" s
    ON s.id::text = m.subcategory::text
    OR UPPER(TRIM(s.name)) = UPPER(TRIM(m.subcategory::text))
  LEFT JOIN "chartOfAccounts" coa
    ON coa.id = m.chart_account_id
`;

/**
 * Classificação sugerida para o caixa de uma dívida:
 * 1) último pagamento desta dívida que já foi para o caixa
 * 2) última SAÍDA lançada para o mesmo credor
 */
export async function getDebtCashDefaults(debtId, executor = pool) {
  await ensureDebtPaymentCashColumn();

  const { rows: debtRows } = await executor.query(
    'SELECT id, creditor_name FROM public.debts WHERE id = $1',
    [debtId]
  );
  const debt = debtRows[0];
  if (!debt) return null;

  const { rows: byDebt } = await executor.query(
    `${DEFAULTS_SELECT}
     WHERE m.debt_payment_id IN (SELECT id FROM ${TB_PAYMENTS} WHERE debt_id = $1)
     ORDER BY m.movement_date DESC, m.id DESC
     LIMIT 1`,
    [debtId]
  );
  if (byDebt[0]) return { source: 'debt', ...byDebt[0] };

  const creditor = String(debt.creditor_name || '').trim();
  if (creditor) {
    const { rows: byCreditor } = await executor.query(
      `${DEFAULTS_SELECT}
       WHERE m.movement_type = 'SAIDA'
         AND COALESCE(m.is_active, TRUE)
         AND UPPER(TRIM(m.supplier_name)) = UPPER(TRIM($1))
       ORDER BY m.movement_date DESC, m.id DESC
       LIMIT 1`,
      [creditor]
    );
    if (byCreditor[0]) return { source: 'creditor', ...byCreditor[0] };
  }

  return { source: 'none' };
}

function toIdOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function pick(cash, defaults, key, defaultsKey = key) {
  if (cash && Object.prototype.hasOwnProperty.call(cash, key) && cash[key] !== '') {
    return cash[key];
  }
  return defaults?.[defaultsKey] ?? null;
}

/**
 * Monta os parâmetros ($1..$17) da SAÍDA de caixa de um pagamento.
 *
 * @param {object} client  client da transação
 * @param {object} args
 * @param {object} args.payment  linha de debt_payments
 * @param {object} args.debt     linha de public.debts
 * @param {object} [args.cash]   escolhas do modal: bank_account_id, category_id,
 *                               subcategory_id, chart_account_id, document_type
 * @param {object} [args.defaults] classificação usada quando o modal não informa
 */
async function buildCashMovementValues(client, { payment, debt, cash = {}, defaults = {} }) {
  const bankAccountId = toIdOrNull(pick(cash, defaults, 'bank_account_id'));
  let cashAccount = null;
  if (bankAccountId) {
    const { rows } = await client.query(
      `SELECT name FROM ${TB_BANK_ACCOUNTS} WHERE id = $1`,
      [bankAccountId]
    );
    cashAccount = rows[0]?.name || null;
  }
  cashAccount = safeText(cashAccount || defaults?.cash_account, 50) || 'CAIXA';

  const principal = roundMoney(payment.amount);
  const discount = roundMoney(payment.discount_amount);
  const amount = Math.max(roundMoney(principal - discount), 0);

  const installmentTotal = Number(debt.installment_total || 0);
  const installmentLabel = payment.installment_number
    ? `parcela ${String(payment.installment_number).padStart(3, '0')}` +
      (installmentTotal > 0 ? `/${String(installmentTotal).padStart(3, '0')}` : '')
    : null;

  const notes = [
    `Pagamento dívida ${debt.code || `#${debt.id}`}`,
    installmentLabel,
    safeText(debt.description, 200),
  ].filter(Boolean).join(' – ') +
    (discount > 0 ? ` | Desconto: ${discount.toFixed(2).replace('.', ',')}` : '') +
    (payment.receipt_number ? ` | Comprovante: ${payment.receipt_number}` : '') +
    (payment.notes ? ` | ${payment.notes}` : '');

  const documentType = safeText(
    pick(cash, defaults, 'document_type') || payment.payment_method,
    20
  );
  const documentNumber = safeText(
    debt.document_number || debt.reference_number || payment.receipt_number || debt.code || `DIV-${debt.id}`,
    50
  );

  const categoryId = toIdOrNull(pick(cash, defaults, 'category_id'));
  const subcategoryId = toIdOrNull(pick(cash, defaults, 'subcategory_id'));
  const chartAccountId = toIdOrNull(pick(cash, defaults, 'chart_account_id'));

  return [
    `${normalizeDate(payment.payment_date)} 00:00:00`,
    cashAccount,
    amount,
    documentType,
    documentNumber,
    safeText(debt.creditor_name, 255),
    notes,
    roundMoney(payment.fine_amount),
    roundMoney(payment.interest_amount),
    categoryId != null ? String(categoryId) : null,
    subcategoryId != null ? String(subcategoryId) : null,
    chartAccountId,
    defaults?.is_deductible ?? null,
    defaults?.is_pis_cofins_creditable ?? null,
    defaults?.deduct_charges_only ?? null,
    payment.id,
    bankAccountId,
  ];
}

/**
 * Cria a SAÍDA de caixa do pagamento (dentro da transação do pagamento).
 */
export async function createDebtPaymentCashMovement(client, { payment, debt, cash = {} }) {
  const defaults = await getDebtCashDefaults(debt.id, client);
  const values = await buildCashMovementValues(client, { payment, debt, cash, defaults });

  const { rows } = await client.query(
    `
    INSERT INTO ${TB_CASH_MOVEMENTS} (
      movement_date, movement_type, cash_account, amount,
      document_type, document_number, supplier_name, notes,
      penalty_amount, interest_amount, fee_amount,
      category, subcategory, chart_account_id,
      is_deductible, is_pis_cofins_creditable, deduct_charges_only,
      debt_payment_id, bank_account_id, is_active
    ) VALUES (
      $1, 'SAIDA', $2, $3,
      $4, $5, $6, $7,
      $8, $9, 0,
      $10, $11, $12,
      $13, $14, $15,
      $16, COALESCE(
        $17::bigint,
        (SELECT ba.id FROM ${TB_BANK_ACCOUNTS} ba
          WHERE UPPER(TRIM(ba.name)) = UPPER(TRIM($2::varchar))
          ORDER BY ba.is_active DESC, ba.id ASC LIMIT 1)
      ), TRUE
    )
    RETURNING id
    `,
    values
  );

  return { id: Number(rows[0].id) };
}

/** Classificação atual da SAÍDA de um pagamento (para a edição). */
export async function getDebtPaymentCash(paymentId, executor = pool) {
  await ensureDebtPaymentCashColumn();

  const { rows } = await executor.query(
    `${DEFAULTS_SELECT}
     WHERE m.debt_payment_id = $1
     LIMIT 1`,
    [paymentId]
  );

  return rows[0] || null;
}

/**
 * Pagamento editado → atualiza a SAÍDA vinculada (mantém id e anexos).
 * Sem movimentação vinculada (pagamentos antigos) → cria uma nova.
 */
export async function updateDebtPaymentCashMovement(client, { payment, debt, cash = {} }) {
  const current = await getDebtPaymentCash(payment.id, client);

  if (!current) {
    return createDebtPaymentCashMovement(client, { payment, debt, cash });
  }

  const values = await buildCashMovementValues(client, { payment, debt, cash, defaults: current });

  const { rows } = await client.query(
    `
    UPDATE ${TB_CASH_MOVEMENTS} SET
      movement_date = $1,
      cash_account = $2,
      amount = $3,
      document_type = $4,
      document_number = $5,
      supplier_name = $6,
      notes = $7,
      penalty_amount = $8,
      interest_amount = $9,
      category = $10,
      subcategory = $11,
      chart_account_id = $12,
      is_deductible = $13,
      is_pis_cofins_creditable = $14,
      deduct_charges_only = $15,
      bank_account_id = COALESCE(
        $17::bigint,
        (SELECT ba.id FROM ${TB_BANK_ACCOUNTS} ba
          WHERE UPPER(TRIM(ba.name)) = UPPER(TRIM($2::varchar))
          ORDER BY ba.is_active DESC, ba.id ASC LIMIT 1)
      )
    WHERE debt_payment_id = $16
    RETURNING id
    `,
    values
  );

  return { id: Number(rows[0].id) };
}

/**
 * Pagamento excluído → a SAÍDA dele também sai de Movimentações
 * (mesma limpeza do deleteMovement: anexos + movimentação).
 */
export async function deleteDebtPaymentCashMovement(client, paymentId) {
  await ensureDebtPaymentCashColumn();

  const { rows } = await client.query(
    `SELECT id FROM ${TB_CASH_MOVEMENTS} WHERE debt_payment_id = $1`,
    [paymentId]
  );
  const ids = rows.map((row) => Number(row.id));
  if (!ids.length) return [];

  await client.query(
    'DELETE FROM "cashMovimentsAttachments" WHERE cash_movement_id = ANY($1::bigint[])',
    [ids]
  );
  await client.query(
    `DELETE FROM ${TB_CASH_MOVEMENTS} WHERE id = ANY($1::bigint[])`,
    [ids]
  );

  return ids;
}
