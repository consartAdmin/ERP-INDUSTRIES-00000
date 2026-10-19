import { loadDesigner, resetDesigner, syncLayoutInput } from './labelParameters.designer.js';
import { closeDesignerModal, openDesignerModal } from './labelParameters.modal.js';
import { state } from './labelParameters.state.js';
import { $, toInputNumber, toNumber } from './labelParameters.utils.js';

function getDesignerContainer() {
  return (
    $('#labelParameterEditor') ||
    $('#labelParametersForm')?.closest('article') ||
    $('#labelDesignerSection') ||
    $('#labelPreviewCanvas')?.closest('fieldset') ||
    $('#labelPreviewCanvas')?.parentElement
  );
}

export function showDesignerSection() {
  const container = getDesignerContainer();
  if (!container) return;
  container.hidden = false;
  container.removeAttribute('aria-hidden');
}

export function hideDesignerSection() {
  const container = getDesignerContainer();
  if (!container) return;
  container.hidden = true;
  container.setAttribute('aria-hidden', 'true');
}

export function applyDefaults() {
  const defaults = {
    page_width_mm: 60,
    page_height_mm: 30,
    label_width_mm: 60,
    label_height_mm: 30,
  };
  Object.entries(defaults).forEach(([id, value]) => {
    const input = $(`#${id}`);
    if (input && !String(input.value ?? '').trim()) input.value = String(value);
  });
}

export function fillForm(parameter, { openDesigner = true } = {}) {
  state.currentEditId = parameter.id ?? null;

  if ($('#formTitle')) $('#formTitle').textContent = 'Editar parâmetro';
  if ($('#formSubtitle')) $('#formSubtitle').textContent = 'Ajuste os dados e o layout visual da etiqueta.';
  const values = {
    paramId: parameter.id,
    name: parameter.name,
    page_width_mm: toInputNumber(parameter.page_width_mm),
    page_height_mm: toInputNumber(parameter.page_height_mm),
    label_width_mm: toInputNumber(parameter.label_width_mm),
    label_height_mm: toInputNumber(parameter.label_height_mm),
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = $(`#${id}`);
    if (input) input.value = value ?? '';
  });
  if ($('#active')) $('#active').checked = !!parameter.active;
  if ($('#btnDeleteParameter')) $('#btnDeleteParameter').disabled = false;
  loadDesigner(parameter.layout_json);
  if (openDesigner) openDesignerModal();
}

export function resetForm() {
  $('#labelParametersForm')?.reset();
  state.currentEditId = null;
  if ($('#paramId')) $('#paramId').value = '';
  if ($('#layout_json')) $('#layout_json').value = '';
  if ($('#formTitle')) $('#formTitle').textContent = 'Novo parâmetro';
  if ($('#formSubtitle')) $('#formSubtitle').textContent = 'Preencha os dados básicos e monte o layout visual da etiqueta.';
  if ($('#btnDeleteParameter')) $('#btnDeleteParameter').disabled = true;
  applyDefaults();
  resetDesigner();
  hideDesignerSection();
  closeDesignerModal();
}

export function collectPayload() {
  syncLayoutInput();
  const id = $('#paramId')?.value?.trim();
  return {
    ...(id ? { id: Number(id) || id } : {}),
    name: $('#name')?.value?.trim() || '',
    page_width_mm: toNumber($('#page_width_mm')?.value),
    page_height_mm: toNumber($('#page_height_mm')?.value),
    label_width_mm: toNumber($('#label_width_mm')?.value),
    label_height_mm: toNumber($('#label_height_mm')?.value),
    active: !!$('#active')?.checked,
    layout_json: $('#layout_json')?.value || JSON.stringify(state.designer.layout),
  };
}
