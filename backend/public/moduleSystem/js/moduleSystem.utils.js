export function unwrapArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.rows)) return payload.rows;
  return [];
}

export function moduloEstaAtivo(modulo) {
  return modulo.is_active ?? modulo.isActive ?? true;
}

/** Filtra por nome ou caminho (mesma regra da busca antiga no servidor) */
export function filtrarModulos(modules, search = '') {
  const termo = search.trim().toLocaleLowerCase('pt-BR');
  if (!termo) return modules;
  return modules.filter((m) =>
    String(m.name || '').toLocaleLowerCase('pt-BR').includes(termo) ||
    String(m.path || '').toLocaleLowerCase('pt-BR').includes(termo)
  );
}

/** id do item e de todos os seus ancestrais no menu */
function ancestrais(modulo, byId) {
  const ids = [];
  const vistos = new Set();
  let atual = modulo.parent_id != null ? byId.get(String(modulo.parent_id)) : null;
  while (atual && !vistos.has(String(atual.id))) {
    vistos.add(String(atual.id));
    ids.push(String(atual.id));
    atual = atual.parent_id != null ? byId.get(String(atual.parent_id)) : null;
  }
  return ids;
}

/**
 * Aplica os filtros da listagem.
 *  status: '' | 'active' | 'inactive'
 *  type: '' | 'dropdown' | 'submenu' | 'link' | 'none'
 *  parentId: '' | 'root' | id  (id inclui tudo que está dentro dele, em qualquer nível)
 *  visibility: '' | 'public' | 'restricted'
 */
export function aplicarFiltros(modules, { status, type, parentId, visibility } = {}) {
  const byId = new Map(modules.map((m) => [String(m.id), m]));
  return modules.filter((m) => {
    if (status === 'active' && !moduloEstaAtivo(m)) return false;
    if (status === 'inactive' && moduloEstaAtivo(m)) return false;
    if (type === 'none' && m.menu_type) return false;
    if (type && type !== 'none' && m.menu_type !== type) return false;
    if (parentId === 'root' && !(m.menu_type && m.parent_id == null)) return false;
    if (parentId && parentId !== 'root' && !ancestrais(m, byId).includes(String(parentId))) return false;
    if (visibility === 'public' && !m.is_public) return false;
    if (visibility === 'restricted' && m.is_public) return false;
    return true;
  });
}

/** Caminho do item no menu, ex.: "Gestão ERP › Clientes" */
export function caminhoNoMenu(modulo, modules) {
  const byId = new Map(modules.map((m) => [String(m.id), m]));
  const partes = [];
  let atual = modulo;
  const vistos = new Set();
  while (atual && !vistos.has(String(atual.id))) {
    vistos.add(String(atual.id));
    partes.unshift(String(atual.name || '').replace(/\s*[▹▸]\s*$/, '').trim());
    atual = atual.parent_id != null ? byId.get(String(atual.parent_id)) : null;
  }
  return partes.join(' › ');
}
