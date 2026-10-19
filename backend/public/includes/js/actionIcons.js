// ╔════════════════════════════════════════════════════════════════════╗
// ║ actionIcons.js — botões de ação discretos (ícones SVG de linha)    ║
// ║ Estilo em /public/includes/css/actionIcons.css (via style.css).    ║
// ║                                                                    ║
// ║ Uso com DOM:                                                       ║
// ║   import { createActionIcons } from '/public/includes/js/actionIcons.js';
// ║   td.appendChild(createActionIcons([                               ║
// ║     { action: 'edit', title: 'Editar', onClick: () => editar(row) },║
// ║     { action: 'delete', title: 'Excluir', onClick: () => excluir(row) },
// ║   ]));                                                             ║
// ║                                                                    ║
// ║ Uso com template string:                                           ║
// ║   actionIconsHtml([{ action: 'edit', title: 'Editar',              ║
// ║                      attrs: { 'data-act': 'edit', 'data-id': id } }])
// ╚════════════════════════════════════════════════════════════════════╝

const PATHS = Object.freeze({
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  confirm: '<path d="M20 6 9 17l-5-5"/>',
  cancel: '<path d="M18 6 6 18M6 6l12 12"/>',
  payment: '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
});

export const ACTION_ICONS = Object.freeze(Object.keys(PATHS));

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function actionIconSvg(action) {
  const path = PATHS[action] || PATHS.view;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/** Cria um botão de ação (elemento DOM) */
export function createActionButton({ action, title = '', onClick, attrs = {}, disabled = false }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `action-icon action-icon--${action}`;
  if (title) {
    button.title = title;
    button.setAttribute('aria-label', title);
  }
  Object.entries(attrs).forEach(([name, value]) => button.setAttribute(name, value));
  button.disabled = !!disabled;
  button.innerHTML = actionIconSvg(action);
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

/** Cria o grupo de botões (elemento DOM) */
export function createActionIcons(items = []) {
  const group = document.createElement('div');
  group.className = 'action-icons';
  items.filter(Boolean).forEach((item) => group.appendChild(createActionButton(item)));
  return group;
}

/** Versão em HTML (para telas que montam a tabela com template string) */
export function actionIconsHtml(items = []) {
  const buttons = items.filter(Boolean).map(({ action, title = '', attrs = {}, disabled = false }) => {
    const extra = Object.entries(attrs)
      .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
    const label = title ? ` title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}"` : '';
    return `<button type="button" class="action-icon action-icon--${action}"${label}${extra}` +
      `${disabled ? ' disabled' : ''}>${actionIconSvg(action)}</button>`;
  });
  return `<div class="action-icons">${buttons.join('')}</div>`;
}
