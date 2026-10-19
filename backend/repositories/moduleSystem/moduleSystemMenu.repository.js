// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemMenu.repository.js — árvore do menu principal          ║
// ║ Tabela: public."moduleSystem"                                      ║
// ║ Devolve o mesmo formato do antigo MENU_CONFIG do menuConsart.js:   ║
// ║ { type, id, htmlId, label, href, className, feature, external,    ║
// ║   children }                                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './moduleSystem.constants.js';
import { q } from './moduleSystem.utils.js';

// Quais tipos podem ficar dentro de cada nível
const ALLOWED_CHILDREN = Object.freeze({
  root: ['dropdown', 'link'],
  dropdown: ['submenu', 'link'],
  submenu: ['link'],
});

function toMenuItem(row) {
  const item = { type: row.menu_type, label: row.name };
  // Itens públicos ficam sem id: o securityModules.js não os esconde.
  item.id = row.is_public ? null : Number(row.id);
  if (row.menu_type === 'link') item.href = (row.path || '#').trim();
  if (row.html_id) item.htmlId = row.html_id;
  if (row.css_class) item.className = row.css_class;
  if (row.feature) item.feature = row.feature;
  if (row.is_external) item.external = true;
  return item;
}

/**
 * Monta a árvore do menu com os módulos ativos que têm menu_type.
 * Itens cujo pai está inativo/fora do menu não aparecem, e dropdowns ou
 * submenus sem filhos visíveis são descartados.
 */
export async function getMenuTree() {
  const { rows } = await q(`
    SELECT id, name, path, menu_type, parent_id, sort_order,
           html_id, css_class, feature, is_external, is_public
    FROM ${TABLE}
    WHERE is_active = true
      AND menu_type IS NOT NULL
    ORDER BY sort_order ASC, id ASC;
  `);

  const byParent = new Map();
  rows.forEach((row) => {
    const key = row.parent_id == null ? 'root' : String(row.parent_id);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  });

  function build(parentKey, level) {
    const allowed = ALLOWED_CHILDREN[level] || [];
    return (byParent.get(parentKey) || [])
      .filter((row) => allowed.includes(row.menu_type))
      .map((row) => {
        const item = toMenuItem(row);
        if (row.menu_type === 'link') return item;
        item.children = build(String(row.id), row.menu_type);
        return item.children.length ? item : null;
      })
      .filter(Boolean);
  }

  return build('root', 'root');
}
