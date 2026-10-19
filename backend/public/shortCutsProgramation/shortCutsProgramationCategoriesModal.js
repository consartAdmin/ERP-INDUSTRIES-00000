// ╔══════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationCategoriesModal.js                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE =
  (typeof window !== 'undefined' && window.apiBase) || window.location.origin;

const ROUTES = Object.freeze({
  categories: `${API_BASE}/api/shortcuts-programation/categories`,
  categoryById: (id) =>
    `${API_BASE}/api/shortcuts-programation/categories/${encodeURIComponent(id)}`,

  subcategories: `${API_BASE}/api/shortcuts-programation/subcategories`,
  subcategoryById: (id) =>
    `${API_BASE}/api/shortcuts-programation/subcategories/${encodeURIComponent(id)}`,
});

const $ = (sel) => document.querySelector(sel);

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    console.error('URL:', url);
    console.error('Status:', res.status);
    console.error('Resposta:', data);

    throw new Error(
      `${res.status} - ${url}\n${data.error || data.message || 'Not Found'}`
    );
  }

  return data;
}

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function rows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

let state = {
  categories: [],
  subcategories: [],
  selectedCategoryId: null,
  selectedSubcategoryId: null,
};

function ensureModal() {
  if ($('#scpCategoriesModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="scpCategoriesModal" class="scp-modal-backdrop hidden">
      <div class="scp-modal">
        <header class="scp-modal-header">
          <div>
            <h2>Categorias e Subcategorias</h2>
            <p>Gerencie os selects dos shortcuts.</p>
          </div>
          <button id="scpBtnClose" class="btn btn-toolbar btn-sm" type="button">Fechar</button>
        </header>

        <section class="scp-modal-body">
          <div class="scp-box">
            <div class="scp-box-title">
              <strong>Categorias</strong>
              <button id="scpBtnNewCategory" class="btn btn-toolbar btn-sm" type="button">+ Nova</button>
            </div>

            <div class="scp-form">
              <input id="scpCategoryId" type="hidden">
              <label>Nome *</label>
              <input id="scpCategoryName" placeholder="Backend, PostgreSQL..." />

              <label>Descrição</label>
              <textarea id="scpCategoryDescription" rows="3"></textarea>

              <div class="scp-grid-3">
                <input id="scpCategoryIcon" placeholder="Ícone" />
                <input id="scpCategoryColor" placeholder="Cor" />
                <input id="scpCategorySort" type="number" placeholder="Ordem" value="0" />
              </div>

              <label class="scp-check">
                <input id="scpCategoryActive" type="checkbox" checked>
                Ativo
              </label>

              <div class="scp-actions">
                <button id="scpBtnSaveCategory" class="btn btn-toolbar btn-sm" type="button">Salvar</button>
                <button id="scpBtnDeleteCategory" class="btn btn-toolbar btn-sm danger" type="button">Inativar</button>
              </div>
            </div>

            <div class="scp-list" id="scpCategoriesList"></div>
          </div>

          <div class="scp-box">
            <div class="scp-box-title">
              <strong>Subcategorias</strong>
              <button id="scpBtnNewSubcategory" class="btn btn-toolbar btn-sm" type="button">+ Nova</button>
            </div>

            <div class="scp-form">
              <input id="scpSubcategoryId" type="hidden">

              <label>Categoria *</label>
              <select id="scpSubcategoryCategoryId"></select>

              <label>Nome *</label>
              <input id="scpSubcategoryName" placeholder="CRUD, Trigger, Modal..." />

              <label>Descrição</label>
              <textarea id="scpSubcategoryDescription" rows="3"></textarea>

              <input id="scpSubcategorySort" type="number" placeholder="Ordem" value="0" />

              <label class="scp-check">
                <input id="scpSubcategoryActive" type="checkbox" checked>
                Ativo
              </label>

              <div class="scp-actions">
                <button id="scpBtnSaveSubcategory" class="btn btn-toolbar btn-sm" type="button">Salvar</button>
                <button id="scpBtnDeleteSubcategory" class="btn btn-toolbar btn-sm danger" type="button">Inativar</button>
              </div>
            </div>

            <div class="scp-list" id="scpSubcategoriesList"></div>
          </div>
        </section>
      </div>
    </div>
  `);

  bindModalEvents();
}

function openModal() {
  ensureModal();
  $('#scpCategoriesModal').classList.remove('hidden');
  loadAll();
}

function closeModal() {
  $('#scpCategoriesModal')?.classList.add('hidden');

  if (typeof window.loadCategories === 'function') {
    window.loadCategories();
  }
}

async function loadAll() {
  await loadCategories();
  await loadSubcategories();
}

async function loadCategories() {
  const data = await api(ROUTES.categories + '?active=');
  state.categories = rows(data);
  renderCategories();
  renderCategorySelect();
}

async function loadSubcategories() {
  const categoryId = state.selectedCategoryId || '';
  const data = await api(`${ROUTES.subcategories}?active=&category_id=${encodeURIComponent(categoryId)}`);
  state.subcategories = rows(data);
  renderSubcategories();
}

function renderCategories() {
  const el = $('#scpCategoriesList');

  if (!state.categories.length) {
    el.innerHTML = `<div class="scp-empty">Nenhuma categoria.</div>`;
    return;
  }

  el.innerHTML = state.categories.map((c) => `
    <button class="scp-row ${String(c.category_id) === String(state.selectedCategoryId) ? 'selected' : ''}"
      type="button"
      data-category-id="${escapeHtml(c.category_id)}">
      <span>${escapeHtml(c.name)}</span>
      <small>${c.active ? 'Ativo' : 'Inativo'}</small>
    </button>
  `).join('');
}

function renderSubcategories() {
  const el = $('#scpSubcategoriesList');

  if (!state.subcategories.length) {
    el.innerHTML = `<div class="scp-empty">Nenhuma subcategoria.</div>`;
    return;
  }

  el.innerHTML = state.subcategories.map((s) => `
    <button class="scp-row ${String(s.subcategory_id) === String(state.selectedSubcategoryId) ? 'selected' : ''}"
      type="button"
      data-subcategory-id="${escapeHtml(s.subcategory_id)}">
      <span>${escapeHtml(s.name)}</span>
      <small>${s.active ? 'Ativo' : 'Inativo'}</small>
    </button>
  `).join('');
}

function renderCategorySelect() {
  $('#scpSubcategoryCategoryId').innerHTML = `
    <option value="">Selecione...</option>
    ${state.categories.map((c) => `
      <option value="${escapeHtml(c.category_id)}">${escapeHtml(c.name)}</option>
    `).join('')}
  `;
}

function clearCategoryForm() {
  state.selectedCategoryId = null;
  $('#scpCategoryId').value = '';
  $('#scpCategoryName').value = '';
  $('#scpCategoryDescription').value = '';
  $('#scpCategoryIcon').value = '';
  $('#scpCategoryColor').value = '';
  $('#scpCategorySort').value = '0';
  $('#scpCategoryActive').checked = true;
  renderCategories();
}

function clearSubcategoryForm() {
  state.selectedSubcategoryId = null;
  $('#scpSubcategoryId').value = '';
  $('#scpSubcategoryCategoryId').value = state.selectedCategoryId || '';
  $('#scpSubcategoryName').value = '';
  $('#scpSubcategoryDescription').value = '';
  $('#scpSubcategorySort').value = '0';
  $('#scpSubcategoryActive').checked = true;
  renderSubcategories();
}

function fillCategory(c) {
  state.selectedCategoryId = c.category_id;
  $('#scpCategoryId').value = c.category_id;
  $('#scpCategoryName').value = c.name || '';
  $('#scpCategoryDescription').value = c.description || '';
  $('#scpCategoryIcon').value = c.icon || '';
  $('#scpCategoryColor').value = c.color || '';
  $('#scpCategorySort').value = c.sort_order || 0;
  $('#scpCategoryActive').checked = Boolean(c.active);
  renderCategories();
  clearSubcategoryForm();
  loadSubcategories();
}

function fillSubcategory(s) {
  state.selectedSubcategoryId = s.subcategory_id;
  $('#scpSubcategoryId').value = s.subcategory_id;
  $('#scpSubcategoryCategoryId').value = s.category_id || '';
  $('#scpSubcategoryName').value = s.name || '';
  $('#scpSubcategoryDescription').value = s.description || '';
  $('#scpSubcategorySort').value = s.sort_order || 0;
  $('#scpSubcategoryActive').checked = Boolean(s.active);
  renderSubcategories();
}

async function saveCategory() {
  const id = $('#scpCategoryId').value;

  const payload = {
    name: $('#scpCategoryName').value.trim(),
    description: $('#scpCategoryDescription').value.trim(),
    icon: $('#scpCategoryIcon').value.trim(),
    color: $('#scpCategoryColor').value.trim(),
    sort_order: Number($('#scpCategorySort').value || 0),
    active: $('#scpCategoryActive').checked,
  };

  if (!payload.name) return alert('Nome da categoria é obrigatório.');

  const data = await api(id ? ROUTES.categoryById(id) : ROUTES.categories, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });

  state.selectedCategoryId = data.row?.category_id || id;
  await loadAll();
}

async function saveSubcategory() {
  const id = $('#scpSubcategoryId').value;

  const payload = {
    category_id: $('#scpSubcategoryCategoryId').value,
    name: $('#scpSubcategoryName').value.trim(),
    description: $('#scpSubcategoryDescription').value.trim(),
    sort_order: Number($('#scpSubcategorySort').value || 0),
    active: $('#scpSubcategoryActive').checked,
  };

  if (!payload.category_id) return alert('Categoria é obrigatória.');
  if (!payload.name) return alert('Nome da subcategoria é obrigatório.');

  const data = await api(id ? ROUTES.subcategoryById(id) : ROUTES.subcategories, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload),
  });

  state.selectedSubcategoryId = data.row?.subcategory_id || id;
  await loadSubcategories();
}

async function deleteCategory() {
  const id = $('#scpCategoryId').value;
  if (!id) return alert('Selecione uma categoria.');
  if (!confirm('Deseja inativar esta categoria?')) return;

  await api(ROUTES.categoryById(id), { method: 'DELETE' });
  clearCategoryForm();
  await loadAll();
}

async function deleteSubcategory() {
  const id = $('#scpSubcategoryId').value;
  if (!id) return alert('Selecione uma subcategoria.');
  if (!confirm('Deseja inativar esta subcategoria?')) return;

  await api(ROUTES.subcategoryById(id), { method: 'DELETE' });
  clearSubcategoryForm();
  await loadSubcategories();
}

function bindModalEvents() {
  $('#scpBtnClose').addEventListener('click', closeModal);
  $('#scpBtnNewCategory').addEventListener('click', clearCategoryForm);
  $('#scpBtnNewSubcategory').addEventListener('click', clearSubcategoryForm);
  $('#scpBtnSaveCategory').addEventListener('click', saveCategory);
  $('#scpBtnSaveSubcategory').addEventListener('click', saveSubcategory);
  $('#scpBtnDeleteCategory').addEventListener('click', deleteCategory);
  $('#scpBtnDeleteSubcategory').addEventListener('click', deleteSubcategory);

  $('#scpCategoriesList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-category-id]');
    if (!btn) return;

    const row = state.categories.find(
      (c) => String(c.category_id) === String(btn.dataset.categoryId)
    );

    if (row) fillCategory(row);
  });

  $('#scpSubcategoriesList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-subcategory-id]');
    if (!btn) return;

    const row = state.subcategories.find(
      (s) => String(s.subcategory_id) === String(btn.dataset.subcategoryId)
    );

    if (row) fillSubcategory(row);
  });

  $('#scpSubcategoryCategoryId').addEventListener('change', async () => {
    state.selectedCategoryId = $('#scpSubcategoryCategoryId').value || null;
    await loadSubcategories();
  });

  $('#scpCategoriesModal').addEventListener('click', (ev) => {
    if (ev.target.id === 'scpCategoriesModal') closeModal();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('#scpCategoriesModal')?.classList.contains('hidden')) {
      closeModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = $('#btnOpenCategoriesModal');
  if (btn) btn.addEventListener('click', openModal);
});

export { openModal as openShortCutsProgramationCategoriesModal };