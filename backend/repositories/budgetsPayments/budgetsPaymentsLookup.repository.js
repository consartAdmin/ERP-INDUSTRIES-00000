// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPaymentsLookup.repository.js — consultas auxiliares           ║
// ║ Budget, forma de pagamento, conta bancária e totais                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  PK,
  quoteIdent,
  TB_BUDGETS,
  TB_SHIPPING,
  TB_METHODS,
  TB_BANK_ACCOUNTS,
  TB_ITEMS,
  TB_PAYMENTS,
  METHOD_PK,
  BANK_ACCOUNT_PK,
  DEFAULT_COLLECTION_PROVIDER,
  DEFAULT_BOLETO_MODE,
  BOLETO_MODES,
  COLLECTION_PROVIDERS,
} from './budgetsPayments.constants.js';
import {
  toInt,
  round2,
} from './budgetsPayments.sanitizers.js';

/* ──────────────────────────────────────────────────────────────────────
 * Consultas auxiliares
 * ──────────────────────────────────────────────────────────────────── */

export async function getBudgetById(client, budgetId) {
  const sql = `
    SELECT
      b.budget_id,
      b.issue_date,
      b.status,
      b.customer_name,
      COALESCE(bs.freight_value, 0) AS freight_value
    FROM ${TB_BUDGETS} b
    LEFT JOIN ${TB_SHIPPING} bs
      ON bs.budget_shipping_id = b.budget_shipping_id
    WHERE b.budget_id = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [budgetId]);
  return rows[0] || null;
}

export async function getPaymentMethodById(client, paymentMethodId) {
  const sql = `
    SELECT
      pm.${METHOD_PK},
      pm.name,
      pm.type,
      pm.installments,
      pm.gap_one,
      pm.gap_two,
      pm.gap_three,
      pm.gap_four,
      pm.active
    FROM ${TB_METHODS} pm
    WHERE pm.${METHOD_PK} = $1
    LIMIT 1
  `;
  const { rows } = await client.query(sql, [paymentMethodId]);
  return rows[0] || null;
}

export async function resolveBankAccount(client, value) {
  const bankAccountId = toInt(value);

  if (!bankAccountId) {
    return {
      bank_account_id: null,
      collection_provider: DEFAULT_COLLECTION_PROVIDER,
      boleto_mode: DEFAULT_BOLETO_MODE
    };
  }

  const { rows } = await client.query(
    `
      SELECT
        ba.${BANK_ACCOUNT_PK} AS id,
        ba.integration_provider,
        ba.boleto_mode,
        ba.is_active
      FROM ${TB_BANK_ACCOUNTS} ba
      WHERE ba.${BANK_ACCOUNT_PK} = $1
      LIMIT 1
    `,
    [bankAccountId]
  );

  const account = rows[0];

  if (!account) {
    throw new Error(
      `Conta bancária não encontrada: ${bankAccountId}.`
    );
  }

  if (account.is_active === false) {
    throw new Error(
      `A conta bancária ${bankAccountId} está inativa.`
    );
  }

  const collectionProvider = String(
    account.integration_provider || DEFAULT_COLLECTION_PROVIDER
  ).toUpperCase();

  const boletoMode = String(
    account.boleto_mode || DEFAULT_BOLETO_MODE
  ).toUpperCase();

  /*
   * Os valores vêm de bankAccounts, mas precisam caber nos CHECKs de
   * budgetsPayments; sem isso o erro só apareceria como violação 23514.
   */
  if (!COLLECTION_PROVIDERS.includes(collectionProvider)) {
    throw new Error(
      `A conta bancária ${bankAccountId} usa integration_provider "${collectionProvider}", ` +
      `não aceito em pagamentos (${COLLECTION_PROVIDERS.join(', ')}).`
    );
  }

  if (!BOLETO_MODES.includes(boletoMode)) {
    throw new Error(
      `A conta bancária ${bankAccountId} usa boleto_mode "${boletoMode}", ` +
      `não aceito em pagamentos (${BOLETO_MODES.join(', ')}).`
    );
  }

  return {
    bank_account_id: Number(account.id),
    collection_provider: collectionProvider,
    boleto_mode: boletoMode
  };
}

export async function getBudgetItemsTotal(client, budgetId) {
  /*
   * A coluna "total" não existe em budgetsItems (nem existia na legada
   * budgetItens): a query anterior sempre lançava 42703 e o catch devolvia 0,
   * zerando silenciosamente a validação de pagamentos. O valor por item é
   * quantidade × preço unitário, menos o desconto do item.
   */
  const sql = `
    SELECT
      COALESCE(SUM(
        (COALESCE(quantity, 0) * COALESCE(unit_price, 0))
        - COALESCE(discount_value, 0)
      ), 0)::numeric(14,2) AS items_total
    FROM ${TB_ITEMS}
    WHERE budget_id = $1
  `;
  try {
    const { rows } = await client.query(sql, [budgetId]);
    return round2(rows[0]?.items_total || 0);
  } catch (error) {
    // Nunca engolir em silêncio: um total zerado aqui invalida a conferência
    // financeira do orçamento inteiro.
    console.error('[budgetsPaymentsApi][getBudgetItemsTotal]', {
      budget_id: budgetId,
      error: error?.message || error,
    });
    throw error;
  }
}

export async function getBudgetPaymentsSum(client, budgetId, exceptId = null) {
  let sql = `
    SELECT COALESCE(SUM(amount), 0)::numeric(14,2) AS total
    FROM ${TB_PAYMENTS}
    WHERE budget_id = $1
  `;
  const params = [budgetId];

  if (exceptId) {
    sql += ` AND ${quoteIdent(PK)} <> $2`;
    params.push(exceptId);
  }

  const { rows } = await client.query(sql, params);
  return round2(rows[0]?.total || 0);
}

export async function getExpectedBudgetTotal(client, budgetId) {
  const budget = await getBudgetById(client, budgetId);
  if (!budget) return null;

  const itemsTotal = await getBudgetItemsTotal(client, budgetId);
  const freight = round2(budget.freight_value || 0);

  return {
    budget_id: Number(budget.budget_id),
    items_total: itemsTotal,
    freight_value: freight,
    expected_total: round2(itemsTotal + freight)
  };
}
