// /backend/app/labels/labelParameters.js
// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.js — Parâmetros de Etiquetas — PRODNEX ERP (ESM)    ║
// ║ - Lista e formulário simplificados                                  ║
// ║ - CRUD completo via API REST                                        ║
// ║ - Designer visual de etiqueta com drag-and-drop                     ║
// ║ - Suporte completo a elemento barcode                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ======================================================================
   TOAST
   ====================================================================== */
const toast = {
  info: (title, message, ms = 3800) =>
    showCenterModal({ variant: 'info', title, message, timeoutMs: ms }),

  success: (title, message, ms = 4200) =>
    showCenterModal({ variant: 'success', title, message, timeoutMs: ms }),

  warn: (title, message) =>
    showCenterModal({ variant: 'warning', title, message }),

  error: (title, message) =>
    showCenterModal({ variant: 'error', title, message })
};

/* ======================================================================
   API
   ====================================================================== */
const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) ||
  '';

const ROUTES = Object.freeze({
  base: `${API_BASE}/api/label-parameters`,
  byId: (id) => `${API_BASE}/api/label-parameters/${encodeURIComponent(id)}`
});

/* ======================================================================
   DOM HELPERS
   ====================================================================== */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let currentEditId = null;
let currentList = [];

/* ======================================================================
   DESIGNER STATE
   ====================================================================== */
const DESIGNER_SCALE_PX_PER_MM = 5;

const designerState = {
  selectedId: null,
  drag: {
    active: false,
    elementId: null,
    pointerOffsetXmm: 0,
    pointerOffsetYmm: 0
  },
  layout: {
    version: 1,
    elements: []
  }
};

/* ======================================================================
   BOOTSTRAP
   ====================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  bindFilterEvents();
  bindFormEvents();
  bindHeaderButtons();
  bindSizeSyncEvents();
  bindDesignerEvents();

  applyDefaultValues();
  resetDesignerToDefault();
  renderDesigner();

  loadParameters();
});

/* ======================================================================
   FILTER EVENTS
   ====================================================================== */
function bindFilterEvents() {
  const btnApplyFilters = $('#btnApplyFilters');

  if (btnApplyFilters) {
    btnApplyFilters.addEventListener('click', () => {
      loadParameters();
    });
  }
}

/* ======================================================================
   FORM EVENTS
   ====================================================================== */
function bindFormEvents() {
  const form = $('#labelParametersForm');
  const btnResetForm = $('#btnResetForm');
  const btnDelete = $('#btnDeleteParameter');

  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  if (btnResetForm) {
    btnResetForm.addEventListener('click', () => {
      resetForm();
      toast.info('Formulário limpo', 'Os campos foram limpos. Você pode iniciar um novo cadastro.');
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', handleDelete);
  }
}

/* ======================================================================
   HEADER BUTTONS
   ====================================================================== */
function bindHeaderButtons() {
  const btnNew = $('#btnNewParameter');

  if (btnNew) {
    btnNew.addEventListener('click', () => {
      resetForm();
      toast.info('Novo parâmetro', 'Preencha os dados básicos e monte o layout visual da etiqueta.');
    });
  }
}

/* ======================================================================
   SIZE SYNC
   ====================================================================== */
function bindSizeSyncEvents() {
  ['#label_width_mm', '#label_height_mm', '#page_width_mm', '#page_height_mm'].forEach((selector) => {
    const el = $(selector);
    if (!el) return;

    el.addEventListener('input', () => {
      autoClampAllDesignerElements();
      syncLayoutJsonInput();
      renderDesigner();
    });

    el.addEventListener('change', () => {
      autoClampAllDesignerElements();
      syncLayoutJsonInput();
      renderDesigner();
    });
  });
}

/* ======================================================================
   DESIGNER EVENTS
   ====================================================================== */
function bindDesignerEvents() {
  const canvas = $('#labelPreviewCanvas');

  $('#btnAddTitle')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('title'));
  });

  $('#btnAddCode')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('code'));
  });

  $('#btnAddPrice')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('price'));
  });

  $('#btnAddBarcode')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('barcode'));
  });

  $('#btnAddBarcodeText')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('barcodeText'));
  });

  $('#btnAddCustomText')?.addEventListener('click', () => {
    addDesignerElement(createNewDesignerElement('custom'));
  });

  $('#btnDuplicateSelectedElement')?.addEventListener('click', duplicateSelectedDesignerElement);
  $('#btnRemoveSelectedElement')?.addEventListener('click', removeSelectedDesignerElement);

  if (canvas) {
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('click', (event) => {
      if (event.target === canvas) {
        setSelectedDesignerElement(null);
      }
    });
  }

  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);

  bindDesignerPropertyInputs();
}

/* ======================================================================
   LOAD PARAMETERS
   ====================================================================== */
async function loadParameters() {
  const tbody = $('#labelParametersTbody');
  const emptyState = $('#labelParametersEmpty');
  const filterUserId = $('#filterUserId');
  const filterActive = $('#filterActive');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="lp-loading-row">
        Carregando parâmetros de etiquetas...
      </td>
    </tr>
  `;

  if (emptyState) {
    emptyState.style.display = 'none';
  }

  try {
    const params = new URLSearchParams();

    const userIdVal = filterUserId?.value?.trim();
    if (userIdVal) params.append('userId', userIdVal);

    const activeVal = filterActive?.value;
    if (activeVal === 'true' || activeVal === 'false') {
      params.append('active', activeVal);
    }

    const url = params.toString()
      ? `${ROUTES.base}?${params.toString()}`
      : ROUTES.base;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Erro ao listar parâmetros: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    currentList = Array.isArray(data) ? data : [];

    renderTable(currentList);
  } catch (err) {
    console.error('[labelParameters] loadParameters error:', err);

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="lp-error-row">
          Erro ao carregar parâmetros. Tente novamente.
        </td>
      </tr>
    `;

    toast.error('Erro ao carregar', err.message || 'Não foi possível carregar os parâmetros de etiquetas.');
  }
}

/* ======================================================================
   RENDER TABLE
   ====================================================================== */
function renderTable(list) {
  const tbody = $('#labelParametersTbody');
  const emptyState = $('#labelParametersEmpty');

  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const rowsHtml = list.map((item) => {
    const page = `${safeNumber(item.page_width_mm)} × ${safeNumber(item.page_height_mm)}`;
    const label = `${safeNumber(item.label_width_mm)} × ${safeNumber(item.label_height_mm)}`;
    const active = item.active ? 'Sim' : 'Não';

    const layout = parseLayoutJson(item.layout_json);
    const totalElements = Array.isArray(layout?.elements) ? layout.elements.length : 0;

    return `
      <tr data-id="${item.id}">
        <td>${escapeHtml(item.name)}</td>
        <td>${page}</td>
        <td>${label}</td>
        <td>${totalElements}</td>
        <td>${active}</td>
        <td class="lp-col-actions">
          <button type="button"
                  class="btn btn-sm btn-secondary lp-btn-edit"
                  data-id="${item.id}">
            Editar
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;

  $$('#labelParametersTbody .lp-btn-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const found = currentList.find((p) => String(p.id) === String(id));
      if (found) fillForm(found);
    });
  });

  $$('#labelParametersTbody tr').forEach((tr) => {
    tr.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;

      const id = tr.getAttribute('data-id');
      const found = currentList.find((p) => String(p.id) === String(id));
      if (found) fillForm(found);
    });
  });
}

/* ======================================================================
   FILL FORM
   ====================================================================== */
function fillForm(param) {
  currentEditId = param.id ?? null;

  $('#formTitle').textContent = 'Editar parâmetro';
  $('#formSubtitle').textContent = 'Ajuste os dados e o layout visual da etiqueta.';

  $('#paramId').value = param.id ?? '';
  $('#user_id').value = param.user_id ?? '';
  $('#name').value = param.name ?? '';
  $('#active').checked = !!param.active;

  $('#page_width_mm').value = toInputNumber(param.page_width_mm);
  $('#page_height_mm').value = toInputNumber(param.page_height_mm);
  $('#label_width_mm').value = toInputNumber(param.label_width_mm);
  $('#label_height_mm').value = toInputNumber(param.label_height_mm);

  const btnDelete = $('#btnDeleteParameter');
  if (btnDelete) {
    btnDelete.disabled = !currentEditId;
  }

  loadDesignerLayoutFromParam(param);
  renderDesigner();

  toast.info('Parâmetro carregado', `Editando: ${param.name}`);
}

/* ======================================================================
   RESET FORM
   ====================================================================== */
function resetForm() {
  const form = $('#labelParametersForm');
  if (form) form.reset();

  currentEditId = null;

  $('#paramId').value = '';
  $('#layout_json').value = '';

  $('#formTitle').textContent = 'Novo parâmetro';
  $('#formSubtitle').textContent = 'Preencha os dados básicos e monte o layout visual da etiqueta.';

  const btnDelete = $('#btnDeleteParameter');
  if (btnDelete) {
    btnDelete.disabled = true;
  }

  applyDefaultValues();
  resetDesignerToDefault();
  renderDesigner();
}

/* ======================================================================
   SUBMIT
   ====================================================================== */
async function handleFormSubmit(event) {
  event.preventDefault();

  const btnSave = $('#btnSaveParameter');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
  }

  try {
    const payload = collectFormPayload();

    if (!payload.name) {
      throw new Error('O campo "Nome" é obrigatório.');
    }

    const method = currentEditId ? 'PUT' : 'POST';
    const url = currentEditId ? ROUTES.byId(currentEditId) : ROUTES.base;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Erro ao salvar (HTTP ${res.status})`);
    }

    const saved = await res.json();

    toast.success(
      currentEditId ? 'Parâmetro atualizado' : 'Parâmetro criado',
      `Parâmetro "${saved.name || payload.name}" salvo com sucesso.`
    );

    currentEditId = saved.id ?? currentEditId;

    await loadParameters();

    if (saved?.id) {
      const found = currentList.find((p) => String(p.id) === String(saved.id));
      if (found) fillForm(found);
    }
  } catch (err) {
    console.error('[labelParameters] handleFormSubmit error:', err);
    toast.error('Erro ao salvar', err.message || 'Não foi possível salvar o parâmetro.');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Salvar';
    }
  }
}

/* ======================================================================
   COLLECT PAYLOAD
   ====================================================================== */
function collectFormPayload() {
  syncLayoutJsonInput();

  const idHidden = $('#paramId').value?.trim();
  const userIdVal = $('#user_id').value?.trim();

  return {
    ...(idHidden ? { id: Number(idHidden) || idHidden } : {}),

    user_id: userIdVal ? Number(userIdVal) || null : null,
    name: $('#name').value?.trim() || '',

    page_width_mm: toNumber($('#page_width_mm').value),
    page_height_mm: toNumber($('#page_height_mm').value),
    label_width_mm: toNumber($('#label_width_mm').value),
    label_height_mm: toNumber($('#label_height_mm').value),

    active: $('#active').checked,

    layout_json: $('#layout_json').value || JSON.stringify(designerState.layout)
  };
}

/* ======================================================================
   DELETE
   ====================================================================== */
async function handleDelete() {
  if (!currentEditId) {
    toast.warn('Nenhum registro selecionado', 'Selecione um parâmetro na lista antes de tentar excluir.');
    return;
  }

  const confirmDelete = window.confirm('Tem certeza que deseja excluir este parâmetro? Esta ação não pode ser desfeita.');
  if (!confirmDelete) return;

  const btnDelete = $('#btnDeleteParameter');
  if (btnDelete) {
    btnDelete.disabled = true;
    btnDelete.textContent = 'Excluindo...';
  }

  try {
    const res = await fetch(ROUTES.byId(currentEditId), { method: 'DELETE' });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Erro ao excluir (HTTP ${res.status})`);
    }

    toast.success('Parâmetro excluído', 'O parâmetro foi removido com sucesso.');

    resetForm();
    await loadParameters();
  } catch (err) {
    console.error('[labelParameters] handleDelete error:', err);
    toast.error('Erro ao excluir', err.message || 'Não foi possível excluir o parâmetro.');
  } finally {
    if (btnDelete) {
      btnDelete.disabled = !currentEditId;
      btnDelete.textContent = 'Excluir';
    }
  }
}

/* ======================================================================
   DEFAULT VALUES
   ====================================================================== */
function applyDefaultValues() {
  setIfEmpty('#page_width_mm', '60');
  setIfEmpty('#page_height_mm', '30');
  setIfEmpty('#label_width_mm', '60');
  setIfEmpty('#label_height_mm', '30');
}

/* ======================================================================
   DESIGNER DEFAULT
   ====================================================================== */
function resetDesignerToDefault() {
  designerState.selectedId = null;

  designerState.layout = {
    version: 1,
    elements: [
      createNewDesignerElement('title', {
        x: 2,
        y: 2,
        w: 56,
        h: 8,
        fontSize: 7,
        text: '{{TITLE}}',
        align: 'left',
        weight: '700'
      }),
      createNewDesignerElement('code', {
        x: 2,
        y: 12,
        w: 18,
        h: 5,
        fontSize: 8,
        text: '{{CODE}}',
        align: 'left',
        weight: '600'
      }),
      createNewDesignerElement('barcode', {
        x: 10,
        y: 16,
        w: 40,
        h: 6,
        fontSize: 6,
        text: '{{BARCODE}}',
        align: 'center',
        weight: '400'
      }),
      createNewDesignerElement('barcodeText', {
        x: 10,
        y: 22.5,
        w: 40,
        h: 4,
        fontSize: 6,
        text: '{{BARCODE}}',
        align: 'center',
        weight: '400'
      }),
      createNewDesignerElement('price', {
        x: 34,
        y: 11,
        w: 24,
        h: 6,
        fontSize: 8,
        text: '{{PRICE}}',
        align: 'right',
        weight: '700'
      })
    ]
  };

  designerState.selectedId = designerState.layout.elements[0]?.id || null;

  syncLayoutJsonInput();
  syncDesignerPropertyPanel();
}

/* ======================================================================
   LOAD LAYOUT
   ====================================================================== */
function loadDesignerLayoutFromParam(param) {
  const layout = parseLayoutJson(param?.layout_json);

  if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) {
    resetDesignerToDefault();
    return;
  }

  designerState.layout = {
    version: layout.version || 1,
    elements: layout.elements.map(normalizeDesignerElement).filter(Boolean)
  };

  designerState.selectedId = designerState.layout.elements[0]?.id || null;

  autoClampAllDesignerElements();
  syncLayoutJsonInput();
  syncDesignerPropertyPanel();
}

/* ======================================================================
   CREATE DESIGNER ELEMENT
   ====================================================================== */
function createNewDesignerElement(type, overrides = {}) {
  const labelW = getLabelWidthMm();
  const labelH = getLabelHeightMm();

  const defaultsByType = {
    title: {
      text: '{{TITLE}}',
      x: 2,
      y: 2,
      w: Math.max(20, labelW - 4),
      h: 8,
      fontSize: 7,
      align: 'left',
      weight: '700',
      visible: true,
      key: 'title'
    },
    code: {
      text: '{{CODE}}',
      x: 2,
      y: 12,
      w: 20,
      h: 5,
      fontSize: 8,
      align: 'left',
      weight: '600',
      visible: true,
      key: 'code'
    },
    price: {
      text: '{{PRICE}}',
      x: Math.max(2, labelW - 24),
      y: 12,
      w: 22,
      h: 6,
      fontSize: 8,
      align: 'right',
      weight: '700',
      visible: true,
      key: 'price'
    },
    barcode: {
      text: '{{BARCODE}}',
      x: 10,
      y: 16,
      w: Math.max(24, labelW - 20),
      h: 8,
      fontSize: 6,
      align: 'center',
      weight: '400',
      visible: true,
      key: 'barcode'
    },
    barcodeText: {
      text: '{{BARCODE}}',
      x: 10,
      y: Math.max(2, labelH - 8),
      w: Math.max(20, labelW - 20),
      h: 5,
      fontSize: 6,
      align: 'center',
      weight: '400',
      visible: true,
      key: 'barcodeText'
    },
    custom: {
      text: 'Texto livre',
      x: 2,
      y: 18,
      w: 26,
      h: 5,
      fontSize: 6,
      align: 'left',
      weight: '400',
      visible: true,
      key: 'custom'
    }
  };

  const base = defaultsByType[type] || defaultsByType.custom;

  return normalizeDesignerElement({
    id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    ...base,
    ...overrides
  });
}

/* ======================================================================
   ADD / REMOVE / DUPLICATE / SELECT
   ====================================================================== */
function addDesignerElement(element) {
  designerState.layout.elements.push(element);
  designerState.selectedId = element.id;

  syncLayoutJsonInput();
  renderDesigner();
}

function removeSelectedDesignerElement() {
  if (!designerState.selectedId) {
    toast.warn('Nenhum elemento selecionado', 'Selecione um elemento na etiqueta para remover.');
    return;
  }

  designerState.layout.elements = designerState.layout.elements.filter(
    (el) => el.id !== designerState.selectedId
  );

  designerState.selectedId = designerState.layout.elements[0]?.id || null;

  syncLayoutJsonInput();
  renderDesigner();
}

function duplicateSelectedDesignerElement() {
  const selected = getSelectedDesignerElement();

  if (!selected) {
    toast.warn('Nenhum elemento selecionado', 'Selecione um elemento na etiqueta para duplicar.');
    return;
  }

  const duplicated = normalizeDesignerElement({
    ...selected,
    id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    x: roundMm(selected.x + 2),
    y: roundMm(selected.y + 2)
  });

  autoClampDesignerElement(duplicated);

  designerState.layout.elements.push(duplicated);
  designerState.selectedId = duplicated.id;

  syncLayoutJsonInput();
  renderDesigner();
}

function setSelectedDesignerElement(elementId) {
  designerState.selectedId = elementId || null;
  syncDesignerPropertyPanel();
  renderElementsList();
  highlightPreviewSelectionOnly();
}

/* ======================================================================
   RENDER DESIGNER
   ====================================================================== */
function renderDesigner() {
  const canvas = $('#labelPreviewCanvas');
  const sizeInfo = $('#previewSizeInfo');

  if (!canvas) return;

  const labelWidthMm = getLabelWidthMm();
  const labelHeightMm = getLabelHeightMm();

  canvas.style.width = `${Math.max(120, mmToPx(labelWidthMm))}px`;
  canvas.style.height = `${Math.max(60, mmToPx(labelHeightMm))}px`;

  if (sizeInfo) {
    sizeInfo.textContent = `Etiqueta: ${formatMm(labelWidthMm)} × ${formatMm(labelHeightMm)} mm`;
  }

  autoClampAllDesignerElements();
  syncLayoutJsonInput();

  const html = designerState.layout.elements
    .filter((el) => el.visible)
    .map((el) => {
      const selectedClass = designerState.selectedId === el.id ? 'is-selected' : '';
      const draggingClass = designerState.drag.active && designerState.drag.elementId === el.id ? 'is-dragging' : '';

      return `
        <div
          class="lp-preview-element ${selectedClass} ${draggingClass}"
          data-element-id="${escapeHtml(el.id)}"
          data-type="${escapeHtml(el.type)}"
          style="
            left:${mmToPx(el.x)}px;
            top:${mmToPx(el.y)}px;
            width:${mmToPx(el.w)}px;
            height:${mmToPx(el.h)}px;
            font-size:${ptToPx(el.fontSize)}px;
            text-align:${escapeHtml(el.align)};
            font-weight:${escapeHtml(String(el.weight || '400'))};
          "
          title="${escapeHtml(getElementDisplayName(el))}"
        >${renderElementPreviewContent(el)}</div>
      `;
    })
    .join('');

  canvas.innerHTML = html;

  renderElementsList();
  syncDesignerPropertyPanel();
}

/* ======================================================================
   PREVIEW CONTENT
   ====================================================================== */
function renderElementPreviewContent(element) {
  if (element.type === 'barcode') {
    return `<div class="lp-barcode-placeholder"></div>`;
  }

  return escapeHtml(resolvePreviewText(element)).replace(/\n/g, '<br>');
}

function resolvePreviewText(element) {
  let text = String(element.text || '');

  const tokens = {
    '{{TITLE}}': 'DESCRIÇÃO DO PRODUTO',
    '{{CODE}}': 'SKU 12345',
    '{{PRICE}}': 'R$ 19,90',
    '{{BARCODE}}': '7891234567890'
  };

  Object.entries(tokens).forEach(([token, value]) => {
    text = text.replaceAll(token, value);
  });

  return text;
}

/* ======================================================================
   ELEMENTS LIST
   ====================================================================== */
function renderElementsList() {
  const listEl = $('#designerElementsList');
  if (!listEl) return;

  if (!designerState.layout.elements.length) {
    listEl.innerHTML = `
      <div class="lp-empty-state" style="display:block;padding:0.6rem 0;">
        Nenhum elemento adicionado.
      </div>
    `;
    return;
  }

  listEl.innerHTML = designerState.layout.elements.map((el, index) => {
    const selected = designerState.selectedId === el.id ? 'is-selected' : '';

    return `
      <div class="lp-element-item ${selected}" data-list-element-id="${escapeHtml(el.id)}">
        <div class="lp-element-main">
          <div class="lp-element-name">${index + 1}. ${escapeHtml(getElementDisplayName(el))}</div>
          <div class="lp-element-meta">
            X:${formatMm(el.x)} • Y:${formatMm(el.y)} • ${formatMm(el.w)}×${formatMm(el.h)} mm
          </div>
        </div>
        <div class="lp-element-badge">${escapeHtml(el.type)}</div>
      </div>
    `;
  }).join('');

  $$('#designerElementsList .lp-element-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-list-element-id');
      setSelectedDesignerElement(id);
    });
  });
}

/* ======================================================================
   PROPERTY PANEL
   ====================================================================== */
function bindDesignerPropertyInputs() {
  const map = {
    '#designerElementText': 'text',
    '#designerElementX': 'x',
    '#designerElementY': 'y',
    '#designerElementW': 'w',
    '#designerElementH': 'h',
    '#designerElementFontSize': 'fontSize',
    '#designerElementAlign': 'align',
    '#designerElementWeight': 'weight',
    '#designerElementVisible': 'visible'
  };

  Object.entries(map).forEach(([selector, prop]) => {
    const input = $(selector);
    if (!input) return;

    const handler = () => {
      const el = getSelectedDesignerElement();
      if (!el) return;

      if (['x', 'y', 'w', 'h', 'fontSize'].includes(prop)) {
        el[prop] = toFiniteNumber(input.value, el[prop]);
      } else if (prop === 'visible') {
        el[prop] = String(input.value) === 'true';
      } else {
        el[prop] = input.value;
      }

      normalizeDesignerElementInPlace(el);
      autoClampDesignerElement(el);
      syncLayoutJsonInput();
      renderDesigner();
    };

    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  });
}

function syncDesignerPropertyPanel() {
  const el = getSelectedDesignerElement();

  const inputs = {
    type: $('#designerElementType'),
    key: $('#designerElementKey'),
    text: $('#designerElementText'),
    x: $('#designerElementX'),
    y: $('#designerElementY'),
    w: $('#designerElementW'),
    h: $('#designerElementH'),
    fontSize: $('#designerElementFontSize'),
    align: $('#designerElementAlign'),
    weight: $('#designerElementWeight'),
    visible: $('#designerElementVisible')
  };

  if (!el) {
    Object.values(inputs).forEach((input) => {
      if (!input) return;
      input.value = '';
      if (input.id !== 'designerElementType' && input.id !== 'designerElementKey') {
        input.disabled = true;
      }
    });
    return;
  }

  Object.values(inputs).forEach((input) => {
    if (!input) return;
    input.disabled = false;
  });

  inputs.type.value = el.type || '';
  inputs.key.value = el.key || '';
  inputs.text.value = el.text || '';
  inputs.x.value = formatInputNumber(el.x);
  inputs.y.value = formatInputNumber(el.y);
  inputs.w.value = formatInputNumber(el.w);
  inputs.h.value = formatInputNumber(el.h);
  inputs.fontSize.value = formatInputNumber(el.fontSize);
  inputs.align.value = el.align || 'left';
  inputs.weight.value = String(el.weight || '400');
  inputs.visible.value = el.visible ? 'true' : 'false';

  inputs.type.readOnly = true;
  inputs.key.readOnly = true;
}

/* ======================================================================
   POINTER DRAG
   ====================================================================== */
function onCanvasPointerDown(event) {
  const target = event.target.closest('.lp-preview-element');
  if (!target) return;

  const elementId = target.getAttribute('data-element-id');
  const element = designerState.layout.elements.find((el) => el.id === elementId);
  if (!element) return;

  setSelectedDesignerElement(elementId);

  const canvasRect = $('#labelPreviewCanvas')?.getBoundingClientRect();
  if (!canvasRect) return;

  const pointerXmm = pxToMm(event.clientX - canvasRect.left);
  const pointerYmm = pxToMm(event.clientY - canvasRect.top);

  designerState.drag.active = true;
  designerState.drag.elementId = elementId;
  designerState.drag.pointerOffsetXmm = pointerXmm - element.x;
  designerState.drag.pointerOffsetYmm = pointerYmm - element.y;

  target.setPointerCapture?.(event.pointerId);
}

function onWindowPointerMove(event) {
  if (!designerState.drag.active || !designerState.drag.elementId) return;

  const canvasRect = $('#labelPreviewCanvas')?.getBoundingClientRect();
  if (!canvasRect) return;

  const element = designerState.layout.elements.find((el) => el.id === designerState.drag.elementId);
  if (!element) return;

  const pointerXmm = pxToMm(event.clientX - canvasRect.left);
  const pointerYmm = pxToMm(event.clientY - canvasRect.top);

  element.x = roundMm(pointerXmm - designerState.drag.pointerOffsetXmm);
  element.y = roundMm(pointerYmm - designerState.drag.pointerOffsetYmm);

  autoClampDesignerElement(element);
  syncLayoutJsonInput();
  renderDesigner();
}

function onWindowPointerUp() {
  if (!designerState.drag.active) return;

  designerState.drag.active = false;
  designerState.drag.elementId = null;
  designerState.drag.pointerOffsetXmm = 0;
  designerState.drag.pointerOffsetYmm = 0;

  syncLayoutJsonInput();
  renderDesigner();
}

/* ======================================================================
   SELECTION HIGHLIGHT
   ====================================================================== */
function highlightPreviewSelectionOnly() {
  $$('#labelPreviewCanvas .lp-preview-element').forEach((node) => {
    const id = node.getAttribute('data-element-id');
    node.classList.toggle('is-selected', id === designerState.selectedId);
  });
}

/* ======================================================================
   CLAMP
   ====================================================================== */
function autoClampAllDesignerElements() {
  designerState.layout.elements.forEach(autoClampDesignerElement);
}

function autoClampDesignerElement(el) {
  const labelW = getLabelWidthMm();
  const labelH = getLabelHeightMm();

  el.w = clamp(roundMm(el.w), 2, labelW);
  el.h = clamp(roundMm(el.h), 2, labelH);
  el.x = clamp(roundMm(el.x), 0, Math.max(0, labelW - el.w));
  el.y = clamp(roundMm(el.y), 0, Math.max(0, labelH - el.h));
  el.fontSize = clamp(roundMm(el.fontSize), 3, 72);
}

/* ======================================================================
   LAYOUT JSON
   ====================================================================== */
function syncLayoutJsonInput() {
  const input = $('#layout_json');
  if (!input) return;

  input.value = JSON.stringify({
    version: designerState.layout.version || 1,
    elements: designerState.layout.elements.map((el) => ({
      id: el.id,
      type: el.type,
      key: el.key,
      text: el.text,
      x: roundMm(el.x),
      y: roundMm(el.y),
      w: roundMm(el.w),
      h: roundMm(el.h),
      fontSize: roundMm(el.fontSize),
      align: el.align,
      weight: String(el.weight || '400'),
      visible: !!el.visible
    }))
  });
}

function parseLayoutJson(raw) {
  if (!raw) return null;

  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.warn('[labelParameters] layout_json inválido:', err);
    return null;
  }
}

/* ======================================================================
   DESIGNER HELPERS
   ====================================================================== */
function getSelectedDesignerElement() {
  return designerState.layout.elements.find((el) => el.id === designerState.selectedId) || null;
}

function getElementDisplayName(el) {
  const map = {
    title: 'Título',
    code: 'Código',
    price: 'Preço',
    barcode: 'Código de barras',
    barcodeText: 'Texto barras',
    custom: 'Texto livre'
  };

  return map[el.type] || el.type || 'Elemento';
}

function normalizeDesignerElement(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    id: String(raw.id || `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    type: String(raw.type || 'custom'),
    key: String(raw.key || raw.type || 'custom'),
    text: String(raw.text ?? ''),
    x: toFiniteNumber(raw.x, 0),
    y: toFiniteNumber(raw.y, 0),
    w: Math.max(2, toFiniteNumber(raw.w, 20)),
    h: Math.max(2, toFiniteNumber(raw.h, 5)),
    fontSize: Math.max(3, toFiniteNumber(raw.fontSize, 6)),
    align: ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left',
    weight: String(raw.weight || '400'),
    visible: raw.visible !== false
  };
}

function normalizeDesignerElementInPlace(el) {
  Object.assign(el, normalizeDesignerElement(el));
}

function getLabelWidthMm() {
  return Math.max(10, getInputNumber('#label_width_mm', 60));
}

function getLabelHeightMm() {
  return Math.max(10, getInputNumber('#label_height_mm', 30));
}

function getInputNumber(selector, fallback = 0) {
  return toFiniteNumber($(selector)?.value, fallback);
}

/* ======================================================================
   MATH / FORMAT
   ====================================================================== */
function mmToPx(mm) {
  return Number(mm || 0) * DESIGNER_SCALE_PX_PER_MM;
}

function pxToMm(px) {
  return Number(px || 0) / DESIGNER_SCALE_PX_PER_MM;
}

function ptToPx(pt) {
  return Number(pt || 0) * 1.3333;
}

function roundMm(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function formatMm(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatInputNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10) / 10);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/* ======================================================================
   GENERIC HELPERS
   ====================================================================== */
function setIfEmpty(selector, value) {
  const el = $(selector);
  if (!el) return;
  if (!String(el.value ?? '').trim()) el.value = value;
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toNumber(value) {
  const val = String(value ?? '').trim();
  if (val === '') return null;
  const n = Number(val.replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function toInputNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  return String(n);
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return '-';
  return String(n);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}