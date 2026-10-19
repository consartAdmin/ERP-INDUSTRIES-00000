// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsOutcomes.constants.js — Tabelas, campos e ordenação        ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TABLE = '"crmDealsOutcomes"';
export const DEALS_TABLE = '"crmDeals"';
export const STAGES_TABLE = '"crmDealsStages"';

export const FIELDS = [
  'name',
  'icon',
  'color',
  'sort_order',
  'is_active',
  'code',
  'outcome_type'
];

export const SEARCH_FIELDS = ['name', 'code', 'outcome_type'];
export const DEFAULT_ORDER = 'sort_order ASC, name ASC';
