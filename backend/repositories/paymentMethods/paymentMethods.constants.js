// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethods.constants.js — Tabela, PK, lock e colunas de prazo  ║
// ╚════════════════════════════════════════════════════════════════════╝

export const SCHEMA = 'public';
export const TABLE = 'paymentMethods';
export const TB = `${SCHEMA}."${TABLE}"`;
export const PK = '"paymentMethods_id"';
export const ADVISORY_LOCK_KEY = 847521001;

export const GAP_COLUMNS = [
  'gap_one', 'gap_two', 'gap_three', 'gap_four', 'gap_five',
  'gap_six', 'gap_seven', 'gap_eight', 'gap_nine', 'gap_ten',
];
