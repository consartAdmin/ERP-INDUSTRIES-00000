// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomes.sql.js — Cláusula de busca (ILIKE)                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { SEARCH_FIELDS } from './crmDealsOutcomes.constants.js';
import { normalizeText } from './crmDealsOutcomes.sanitizers.js';

export function buildSearchClause(q, startIndex = 1) {
  const term = normalizeText(q, '');
  if (!term) return { clause: '', values: [] };

  const values = [];
  const parts = [];

  SEARCH_FIELDS.forEach((field, idx) => {
    values.push(`%${term}%`);
    parts.push(`${field} ILIKE $${startIndex + idx}`);
  });

  return {
    clause: `(${parts.join(' OR ')})`,
    values
  };
}
