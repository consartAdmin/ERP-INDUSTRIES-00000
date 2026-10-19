// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccounts.sql.js — Fragmentos SQL (SELECT completo)          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ALL_COLS } from './chartOfAccounts.constants.js';

/** Full SELECT list with the parent account's code/description joined in */
export const FULL_SELECT = ALL_COLS.flatMap((c) =>
  c === 'parent_account_id'
    ? [`coa.${c}`, 'parent.code AS parent_code', 'parent.description AS parent_description']
    : [`coa.${c}`]
).join(',\n        ');
