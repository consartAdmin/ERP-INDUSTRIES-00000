import { DESIGNER_SCALE_PX_PER_MM } from './labelParameters.config.js';
import { toast } from './labelParameters.modal.js';
import { state } from './labelParameters.state.js';
import {
  $, $$, clamp, escapeHtml, formatMm, mmToPx, parseLayoutJson, ptToPx,
  pxToMm, roundMm, toFiniteNumber,
} from './labelParameters.utils.js';

const designer = state.designer;

function getPreviewScale(widthMm, heightMm) {
  const stage = $('#labelPreviewStage');
  const availableWidth = Math.min(760, Math.max(280, (stage?.clientWidth || 760) - 40));
  const availableHeight = 420;
  return clamp(
    Math.min(availableWidth / widthMm, availableHeight / heightMm),
    DESIGNER_SCALE_PX_PER_MM,
    24,
  );
}

export const getLabelWidthMm = () =>
  Math.max(10, toFiniteNumber($('#label_width_mm')?.value, 60));
export const getLabelHeightMm = () =>
  Math.max(10, toFiniteNumber($('#label_height_mm')?.value, 30));

export function normalizeElement(raw) {
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
    visible: raw.visible !== false,
  };
}

export function createElement(type, overrides = {}) {
  const width = getLabelWidthMm();
  const height = getLabelHeightMm();
  const defaults = {
    title: { text: '{{TITLE}}', x: 2, y: 2, w: width - 4, h: 8, fontSize: 7, align: 'left', weight: '700' },
    code: { text: '{{CODE}}', x: 2, y: 12, w: 20, h: 5, fontSize: 8, align: 'left', weight: '600' },
    price: { text: '{{PRICE}}', x: Math.max(2, width - 24), y: 12, w: 22, h: 6, fontSize: 8, align: 'right', weight: '700' },
    barcode: { text: '{{BARCODE}}', x: 10, y: 16, w: Math.max(24, width - 20), h: 8, fontSize: 6, align: 'center', weight: '400' },
    barcodeText: { text: '{{BARCODE}}', x: 10, y: Math.max(2, height - 8), w: Math.max(20, width - 20), h: 5, fontSize: 6, align: 'center', weight: '400' },
    custom: { text: 'Texto livre', x: 2, y: 18, w: 26, h: 5, fontSize: 6, align: 'left', weight: '400' },
  };
  return normalizeElement({ type, key: type, visible: true, ...(defaults[type] || defaults.custom), ...overrides });
}

export function clampElement(element) {
  const width = getLabelWidthMm();
  const height = getLabelHeightMm();
  element.w = clamp(roundMm(element.w), 2, width);
  element.h = clamp(roundMm(element.h), 2, height);
  element.x = clamp(roundMm(element.x), 0, Math.max(0, width - element.w));
  element.y = clamp(roundMm(element.y), 0, Math.max(0, height - element.h));
  element.fontSize = clamp(roundMm(element.fontSize), 3, 72);
}

export function clampAll() {
  designer.layout.elements.forEach(clampElement);
}

export function syncLayoutInput() {
  const input = $('#layout_json');
  if (!input) return;
  input.value = JSON.stringify({
    version: designer.layout.version || 1,
    elements: designer.layout.elements.map((element) => ({
      ...element,
      x: roundMm(element.x), y: roundMm(element.y),
      w: roundMm(element.w), h: roundMm(element.h),
      fontSize: roundMm(element.fontSize),
      visible: !!element.visible,
    })),
  });
}

export function resetDesigner() {
  designer.layout = {
    version: 1,
    elements: [
      createElement('title'),
      createElement('code'),
      createElement('barcode', { h: 6 }),
      createElement('barcodeText'),
      createElement('price'),
    ],
  };
  designer.selectedId = designer.layout.elements[0]?.id || null;
  renderDesigner();
}

export function loadDesigner(raw) {
  const layout = parseLayoutJson(raw);
  if (!layout?.elements?.length) return resetDesigner();
  designer.layout = {
    version: layout.version || 1,
    elements: layout.elements.map(normalizeElement).filter(Boolean),
  };
  designer.selectedId = designer.layout.elements[0]?.id || null;
  renderDesigner();
}

function displayName(element) {
  return ({ title: 'Título', code: 'Código', price: 'Preço', barcode: 'Código de barras', barcodeText: 'Texto barras', custom: 'Texto livre' })[element.type] || element.type;
}

function previewText(element) {
  if (element.type === 'barcode') return '<div class="lp-barcode-placeholder"></div>';
  const tokens = { '{{TITLE}}': 'DESCRIÇÃO DO PRODUTO', '{{CODE}}': 'SKU 12345', '{{PRICE}}': 'R$ 19,90', '{{BARCODE}}': '7891234567890' };
  let text = element.text;
  Object.entries(tokens).forEach(([token, value]) => { text = text.replaceAll(token, value); });
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function renderList() {
  const list = $('#designerElementsList');
  if (!list) return;
  list.innerHTML = designer.layout.elements.map((element, index) => `
    <div class="lp-element-item ${designer.selectedId === element.id ? 'is-selected' : ''}" data-list-element-id="${escapeHtml(element.id)}">
      <div class="lp-element-main"><div class="lp-element-name">${index + 1}. ${escapeHtml(displayName(element))}</div>
      <div class="lp-element-meta">X:${formatMm(element.x)} • Y:${formatMm(element.y)} • ${formatMm(element.w)}×${formatMm(element.h)} mm</div></div>
      <div class="lp-element-badge">${escapeHtml(element.type)}</div>
    </div>`).join('') || '<div class="lp-empty-state">Nenhum elemento adicionado.</div>';
  $$('.lp-element-item', list).forEach((node) => node.addEventListener('click', () => selectElement(node.dataset.listElementId)));
}

function selectedElement() {
  return designer.layout.elements.find((element) => element.id === designer.selectedId) || null;
}

function syncProperties() {
  const element = selectedElement();
  const map = {
    designerElementType: 'type', designerElementKey: 'key', designerElementText: 'text',
    designerElementX: 'x', designerElementY: 'y', designerElementW: 'w',
    designerElementH: 'h', designerElementFontSize: 'fontSize',
    designerElementAlign: 'align', designerElementWeight: 'weight',
    designerElementVisible: 'visible',
  };
  Object.entries(map).forEach(([id, property]) => {
    const input = $(`#${id}`);
    if (!input) return;
    input.disabled = !element;
    input.value = !element ? '' : property === 'visible' ? String(element.visible) : element[property] ?? '';
  });
}

export function selectElement(id) {
  designer.selectedId = id || null;
  renderList();
  syncProperties();
  $$('.lp-preview-element', $('#labelPreviewCanvas') || document).forEach((node) =>
    node.classList.toggle('is-selected', node.dataset.elementId === designer.selectedId));
}

export function renderDesigner() {
  const canvas = $('#labelPreviewCanvas');
  if (!canvas) return;
  clampAll();
  syncLayoutInput();
  const width = getLabelWidthMm();
  const height = getLabelHeightMm();
  const previewScale = getPreviewScale(width, height);
  designer.previewScale = previewScale;
  canvas.style.width = `${mmToPx(width, previewScale)}px`;
  canvas.style.height = `${mmToPx(height, previewScale)}px`;
  if ($('#previewSizeInfo')) $('#previewSizeInfo').textContent = `Etiqueta: ${formatMm(width)} × ${formatMm(height)} mm`;
  canvas.innerHTML = designer.layout.elements.filter((element) => element.visible).map((element) => `
    <div class="lp-preview-element ${designer.selectedId === element.id ? 'is-selected' : ''}"
      data-element-id="${escapeHtml(element.id)}" data-type="${escapeHtml(element.type)}"
      style="left:${mmToPx(element.x, previewScale)}px;top:${mmToPx(element.y, previewScale)}px;width:${mmToPx(element.w, previewScale)}px;height:${mmToPx(element.h, previewScale)}px;font-size:${ptToPx(element.fontSize) * (previewScale / DESIGNER_SCALE_PX_PER_MM)}px;text-align:${escapeHtml(element.align)};font-weight:${escapeHtml(element.weight)}"
      title="${escapeHtml(displayName(element))}">${previewText(element)}</div>`).join('');
  renderList();
  syncProperties();
}

function add(type) {
  const element = createElement(type);
  designer.layout.elements.push(element);
  designer.selectedId = element.id;
  renderDesigner();
}

function remove() {
  if (!designer.selectedId) return toast.warn('Nenhum elemento selecionado', 'Selecione um elemento para remover.');
  designer.layout.elements = designer.layout.elements.filter((element) => element.id !== designer.selectedId);
  designer.selectedId = designer.layout.elements[0]?.id || null;
  renderDesigner();
}

function duplicate() {
  const source = selectedElement();
  if (!source) return toast.warn('Nenhum elemento selecionado', 'Selecione um elemento para duplicar.');
  const copy = normalizeElement({ ...source, id: null, x: source.x + 2, y: source.y + 2 });
  clampElement(copy);
  designer.layout.elements.push(copy);
  designer.selectedId = copy.id;
  renderDesigner();
}

export function bindDesigner() {
  const buttons = {
    btnAddTitle: 'title', btnAddCode: 'code', btnAddPrice: 'price',
    btnAddBarcode: 'barcode', btnAddBarcodeText: 'barcodeText',
    btnAddCustomText: 'custom',
  };
  Object.entries(buttons).forEach(([id, type]) => $(`#${id}`)?.addEventListener('click', () => add(type)));
  $('#btnDuplicateSelectedElement')?.addEventListener('click', duplicate);
  $('#btnRemoveSelectedElement')?.addEventListener('click', remove);

  const properties = {
    designerElementText: 'text', designerElementX: 'x', designerElementY: 'y',
    designerElementW: 'w', designerElementH: 'h', designerElementFontSize: 'fontSize',
    designerElementAlign: 'align', designerElementWeight: 'weight', designerElementVisible: 'visible',
  };
  Object.entries(properties).forEach(([id, property]) => {
    const input = $(`#${id}`);
    const update = () => {
      const element = selectedElement();
      if (!element) return;
      if (['x', 'y', 'w', 'h', 'fontSize'].includes(property)) element[property] = toFiniteNumber(input.value, element[property]);
      else if (property === 'visible') element.visible = input.value === 'true';
      else element[property] = input.value;
      Object.assign(element, normalizeElement(element));
      renderDesigner();
    };
    input?.addEventListener('input', update);
    input?.addEventListener('change', update);
  });

  const canvas = $('#labelPreviewCanvas');
  canvas?.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('.lp-preview-element');
    if (!node) return;
    selectElement(node.dataset.elementId);
    const element = selectedElement();
    const rect = canvas.getBoundingClientRect();
    const previewScale = designer.previewScale || DESIGNER_SCALE_PX_PER_MM;
    designer.drag = {
      active: true, elementId: element.id,
      pointerOffsetXmm: pxToMm(event.clientX - rect.left, previewScale) - element.x,
      pointerOffsetYmm: pxToMm(event.clientY - rect.top, previewScale) - element.y,
    };
  });
  window.addEventListener('pointermove', (event) => {
    if (!designer.drag.active) return;
    const element = selectedElement();
    const rect = canvas?.getBoundingClientRect();
    if (!element || !rect) return;
    const previewScale = designer.previewScale || DESIGNER_SCALE_PX_PER_MM;
    element.x = roundMm(pxToMm(event.clientX - rect.left, previewScale) - designer.drag.pointerOffsetXmm);
    element.y = roundMm(pxToMm(event.clientY - rect.top, previewScale) - designer.drag.pointerOffsetYmm);
    clampElement(element);
    renderDesigner();
  });
  window.addEventListener('pointerup', () => {
    if (!designer.drag.active) return;
    designer.drag.active = false;
    designer.drag.elementId = null;
    syncLayoutInput();
  });
  ['#label_width_mm', '#label_height_mm', '#page_width_mm', '#page_height_mm'].forEach((selector) =>
    $(selector)?.addEventListener('input', renderDesigner));
}
