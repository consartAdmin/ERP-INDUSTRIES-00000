export function validarModulo({ name, path, menuType, parentId }) {
  if (!name || !path) {
    return 'Preencha os campos "Nome do Módulo" e "Caminho".';
  }
  if (menuType === 'submenu' && !parentId) {
    return 'Submenu precisa de um dropdown como menu pai.';
  }
  if (menuType === 'dropdown' && parentId) {
    return 'Dropdown fica sempre no topo do menu (sem menu pai).';
  }
  return null;
}

export function validarElementos(elements) {
  const obrigatorios = [
    'moduleForm', 'moduleId', 'name', 'path', 'menuType', 'parentId',
    'sortOrder', 'htmlId', 'cssClass', 'feature', 'isActive', 'isExternal',
    'isPublic', 'btnSave', 'btnClear', 'formTitle', 'searchInput', 'tbody',
    'filterStatus', 'filterType', 'filterParent', 'filterVisibility', 'btnClearFilters',
    'tableInfo', 'pageInfo', 'btnPreviousPage', 'btnNextPage', 'rowsPerPage',
  ];
  const ausentes = obrigatorios.filter((nome) => !elements[nome]);
  if (ausentes.length) {
    throw new Error(`Elementos HTML ausentes: ${ausentes.join(', ')}`);
  }
}
