import { salvarModulo } from './moduleSystem.api.js';
import { elements, MENU_TYPE_LABELS } from './moduleSystem.config.js';
import { showToast } from './moduleSystem.modal.js';
import { state, setEditingId } from './moduleSystem.state.js';
import { validarModulo } from './moduleSystem.validation.js';
import { caminhoNoMenu, moduloEstaAtivo } from './moduleSystem.utils.js';

// Tipos que podem ser pai de cada tipo de item
const PAIS_PERMITIDOS = Object.freeze({
  link: ['dropdown', 'submenu'],
  submenu: ['dropdown'],
  dropdown: [],
  '': ['dropdown', 'submenu'],
});

/** Preenche o select "Menu pai" conforme o tipo escolhido */
export function atualizarOpcoesPai(selecionado = elements.parentId.value) {
  const tipo = elements.menuType.value;
  const permitidos = PAIS_PERMITIDOS[tipo] || [];
  const editandoId = String(elements.moduleId.value || '');

  const opcoes = state.modules
    .filter((m) => permitidos.includes(m.menu_type) && String(m.id) !== editandoId)
    .map((m) => ({ id: String(m.id), texto: caminhoNoMenu(m, state.modules), modulo: m }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR'));

  elements.parentId.replaceChildren();
  const topo = document.createElement('option');
  topo.value = '';
  topo.textContent = '(Topo do menu)';
  elements.parentId.appendChild(topo);

  opcoes.forEach(({ id, texto, modulo }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${texto}  —  ${MENU_TYPE_LABELS[modulo.menu_type]}${moduloEstaAtivo(modulo) ? '' : ' (inativo)'}`;
    elements.parentId.appendChild(option);
  });

  const valor = String(selecionado ?? '');
  elements.parentId.value = opcoes.some((o) => o.id === valor) ? valor : '';
  elements.parentId.disabled = tipo === 'dropdown';
}

export function resetForm() {
  elements.moduleId.value = '';
  elements.name.value = '';
  elements.path.value = '';
  elements.menuType.value = 'link';
  elements.sortOrder.value = '';
  elements.htmlId.value = '';
  elements.cssClass.value = '';
  elements.feature.value = '';
  elements.isActive.checked = true;
  elements.isExternal.checked = false;
  elements.isPublic.checked = false;
  atualizarOpcoesPai('');
  elements.formTitle.textContent = '➕ Novo Módulo';
  elements.btnSave.textContent = '💾 Salvar';
  setEditingId(null);
}

export function fillForm(modulo) {
  elements.moduleId.value = modulo.id;
  elements.name.value = modulo.name || '';
  elements.path.value = modulo.path || '';
  elements.menuType.value = modulo.menu_type || '';
  elements.sortOrder.value = modulo.sort_order ?? '';
  elements.htmlId.value = modulo.html_id || '';
  elements.cssClass.value = modulo.css_class || '';
  elements.feature.value = modulo.feature || '';
  elements.isActive.checked = moduloEstaAtivo(modulo);
  elements.isExternal.checked = !!modulo.is_external;
  elements.isPublic.checked = !!modulo.is_public;
  atualizarOpcoesPai(modulo.parent_id ?? '');
  elements.formTitle.textContent = '✏️ Editar Módulo';
  elements.btnSave.textContent = '💾 Atualizar';
  setEditingId(modulo.id);
  elements.moduleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function obterDadosFormulario() {
  return {
    id: elements.moduleId.value.trim(),
    name: elements.name.value.trim(),
    path: elements.path.value.trim(),
    menuType: elements.menuType.value,
    parentId: elements.menuType.value === 'dropdown' ? '' : elements.parentId.value,
    sortOrder: elements.sortOrder.value.trim(),
    htmlId: elements.htmlId.value.trim(),
    cssClass: elements.cssClass.value.trim(),
    feature: elements.feature.value.trim(),
    isActive: elements.isActive.checked,
    isExternal: elements.isExternal.checked,
    isPublic: elements.isPublic.checked,
  };
}

export function registrarFormulario(recarregar) {
  elements.menuType.addEventListener('change', () => {
    atualizarOpcoesPai();
    // Dropdown e submenu não abrem página: caminho padrão '#'
    if (elements.menuType.value !== 'link' && !elements.path.value.trim()) {
      elements.path.value = '#';
    }
  });

  elements.moduleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const dados = obterDadosFormulario();
    const erro = validarModulo(dados);
    if (erro) {
      showToast(erro, 'warn');
      return;
    }

    elements.btnSave.disabled = true;
    elements.btnSave.textContent = dados.id ? 'Atualizando...' : 'Salvando...';
    try {
      await salvarModulo(dados);
      showToast(
        dados.id ? 'Módulo atualizado com sucesso!' : 'Módulo criado com sucesso!',
        'success'
      );
      resetForm();
      await recarregar();
    } catch (error) {
      console.error('[moduleSystem] erro ao salvar módulo:', error);
      showToast(error.message || 'Erro ao salvar módulo.', 'error');
    } finally {
      elements.btnSave.disabled = false;
      elements.btnSave.textContent = elements.moduleId.value ? '💾 Atualizar' : '💾 Salvar';
    }
  });

  elements.btnClear.addEventListener('click', resetForm);
}
