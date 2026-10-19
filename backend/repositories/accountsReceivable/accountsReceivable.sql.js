// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.sql.js — Fragmentos SQL reutilizados            ║
// ║ Banco efetivo (Asaas), nome do banco e status efetivo              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_BANK_ACCOUNTS } from './accountsReceivable.constants.js';

// -------------------------------------------------------------------
// Conta bancária Asaas padrão
// Usada para contas sincronizadas do Asaas que não têm bank_account_id.
// O PostgreSQL executa esta subquery uma única vez por consulta.
// -------------------------------------------------------------------
export const ASAAS_BANK_ACCOUNT_ID_SQL = `(
  SELECT x.id
  FROM ${TB_BANK_ACCOUNTS} x
  WHERE x.integration_provider = 'ASAAS'
    AND x.is_active = TRUE
  ORDER BY x.is_default DESC, x.id ASC
  LIMIT 1
)`;

export const ASAAS_BANK_ACCOUNT_NAME_SQL = `(
  SELECT x.name
  FROM ${TB_BANK_ACCOUNTS} x
  WHERE x.integration_provider = 'ASAAS'
    AND x.is_active = TRUE
  ORDER BY x.is_default DESC, x.id ASC
  LIMIT 1
)`;

/**
 * ID da conta bancária efetiva (mesma regra da coluna "Banco").
 * Usado pelo filtro "Conta Bancária" para bater com o que a tela mostra.
 */
export function effectiveBankAccountIdSql(arAlias = 'ar', bridgeAlias = 'asa') {
  return `
    COALESCE(
      ${arAlias}.bank_account_id,
      CASE
        WHEN ${bridgeAlias}.id IS NOT NULL THEN ${ASAAS_BANK_ACCOUNT_ID_SQL}
      END
    )
  `;
}

/**
 * Nome do banco exibido na coluna "Banco".
 * 1) banco gravado na própria conta a receber (ar.bank_account_id)
 * 2) se a conta veio do Asaas (tem ponte), usa a conta Asaas ativa
 */
export function accountBankSql(bankAlias = 'ba', bridgeAlias = 'asa') {
  return `
    COALESCE(
      ${bankAlias}.name,
      CASE
        WHEN ${bridgeAlias}.id IS NOT NULL THEN ${ASAAS_BANK_ACCOUNT_NAME_SQL}
      END
    )
  `;
}

export function effectiveStatusSql(alias = 'ar') {
  return `
    CASE
      WHEN UPPER(COALESCE(${alias}.status, 'PENDING')) = 'PENDING'
        AND ${alias}.due_date < CURRENT_DATE
      THEN 'OVERDUE'
      ELSE UPPER(COALESCE(${alias}.status, 'PENDING'))
    END
  `;
}
