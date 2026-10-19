import { elements, MENU_TYPE_LABELS } from './moduleSystem.config.js';
import { caminhoNoMenu, moduloEstaAtivo } from './moduleSystem.utils.js';
import { createActionIcons } from '/public/includes/js/actionIcons.js';

const TOTAL_COLUNAS = 8;

function criarCelula(texto = '') {
  const td = document.createElement('td');
  td.textContent = texto;
  return td;
}

export function renderModulesTable(modules, handlers, allModules = modules) {
  elements.tbody.innerHTML = '';

  if (!modules.length) {
    const tr = document.createElement('tr');
    const td = criarCelula('Nenhum módulo encontrado.');
    td.colSpan = TOTAL_COLUNAS;
    td.className = 'ms-table-empty';
    tr.appendChild(td);
    elements.tbody.appendChild(tr);
    return;
  }

  const byId = new Map(allModules.map((m) => [String(m.id), m]));

  modules.forEach((modulo) => {
    const ativo = moduloEstaAtivo(modulo);
    const tr = document.createElement('tr');
    const tdActive = document.createElement('td');
    const badge = document.createElement('span');
    badge.textContent = ativo ? 'Ativo' : 'Inativo';
    badge.className = ativo
      ? 'ms-badge ms-badge--active'
      : 'ms-badge ms-badge--inactive';
    tdActive.appendChild(badge);

    const tdActions = document.createElement('td');
    tdActions.className = 'ms-actions-cell';
    tdActions.appendChild(createActionIcons([
      { action: 'edit', title: 'Editar módulo', onClick: () => handlers.editar(modulo) },
      {
        action: ativo ? 'pause' : 'play',
        title: ativo ? 'Desativar' : 'Ativar',
        onClick: () => handlers.alternar(modulo),
      },
      { action: 'delete', title: 'Excluir módulo', onClick: () => handlers.excluir(modulo) },
    ]));

    const pai = modulo.parent_id != null ? byId.get(String(modulo.parent_id)) : null;
    const tipo = MENU_TYPE_LABELS[modulo.menu_type] || '🚫 Fora do menu';

    tr.append(
      criarCelula(modulo.id),
      criarCelula(modulo.name || ''),
      criarCelula(modulo.path || ''),
      criarCelula(modulo.is_public ? `${tipo} (todos)` : tipo),
      criarCelula(pai ? caminhoNoMenu(pai, allModules) : (modulo.menu_type ? '(Topo)' : '')),
      criarCelula(modulo.menu_type ? String(modulo.sort_order ?? '') : ''),
      tdActive,
      tdActions
    );
    elements.tbody.appendChild(tr);
  });
}
