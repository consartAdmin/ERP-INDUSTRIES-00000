// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccounts.sql.js — Colunas do SELECT (conta + banco)            ║
// ╚════════════════════════════════════════════════════════════════════╝

export const SELECT_FIELDS = `
  ba.id, ba.bank_id, b.code AS bank_code, b.name AS bank_name,
  ba.name, ba.agency, ba.account_number, ba.account_digit,
  ba.integration_provider, ba.boleto_mode,
  ba.is_default, ba.is_active, ba.created_at, ba.updated_at
`;
