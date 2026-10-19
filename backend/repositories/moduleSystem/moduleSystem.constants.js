// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystem.constants.js — Tabela de cadastro de módulos          ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TABLE = 'public."moduleSystem"';

/** Tipos de item do menu. NULL = módulo fora do menu. */
export const MENU_TYPES = Object.freeze(['dropdown', 'submenu', 'link']);

/** Colunas devolvidas pelas consultas e pelos RETURNING */
export const COLUMNS = `
  id, name, path, is_active, created_at, updated_at,
  menu_type, parent_id, sort_order, html_id, css_class, feature,
  is_external, is_public
`;
