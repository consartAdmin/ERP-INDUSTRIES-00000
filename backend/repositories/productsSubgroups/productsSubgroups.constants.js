// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroups.constants.js — Tabela, alias e colunas           ║
// ║ Tabela: public."productsSubgroups" (alias: psg)                    ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB         = '"productsSubgroups"';
export const ALIAS      = 'psg';
export const COLS = Object.freeze({
  id:         'product_subgroup_id',
  name:       'name',
  group_id:   'group_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
  is_active:  'is_active',
});

export const ORDERABLE = new Set([COLS.name, COLS.created_at, COLS.updated_at, COLS.is_active]);
