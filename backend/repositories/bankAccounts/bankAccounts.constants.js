// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccounts.constants.js — Tabelas e enums de contas bancárias    ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."bankAccounts"';
export const TB_BANKS = 'public."banks"';
export const PROVIDERS = new Set(['ASAAS', 'MANUAL', 'OTHER_API']);
export const BOLETO_MODES = new Set(['AUTOMATIC', 'MANUAL', 'NONE']);
