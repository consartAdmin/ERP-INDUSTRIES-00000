// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.settings.js — Parâmetros da etiqueta (⚙️)    ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  getLabelSettings,
  previewLabelSettings,
  saveLabelSettings
} from './deliveryLabels.api.js';
import { getField, reportError } from './deliveryLabels.utils.js';
import {
  hideModal,
  isBackdropClick,
  isModalOpen,
  showModal
} from './deliveryLabels.modal.js';

const PREVIEW_DEBOUNCE_MS = 450;

let els;
let defaults = {};
let previewTimer = null;
let previewSeq = 0;

export function initializeLabelSettings() {
  els = {
    button: getField('btnConfigEtiqueta'),
    modal: getField('modalConfigEtiqueta'),
    form: getField('formConfigEtiqueta'),
    preview: getField('configPreviewFrame'),
    btnClose: getField('btnFecharConfig'),
    btnCancel: getField('btnConfigCancelar'),
    btnPreview: getField('btnConfigPreview'),
    btnDefaults: getField('btnConfigPadrao')
  };

  const missing = Object.entries(els).filter(([, element]) => !element).map(([name]) => name);

  if (missing.length) {
    console.warn('[deliveryLabels] Elementos de configuração não encontrados:', missing.join(', '));
    return;
  }

  els.button.addEventListener('click', openSettingsModal);
  els.btnClose.addEventListener('click', closeSettingsModal);
  els.btnCancel.addEventListener('click', closeSettingsModal);
  els.btnPreview.addEventListener('click', () => void refreshPreview());
  els.btnDefaults.addEventListener('click', restoreDefaults);
  els.form.addEventListener('submit', submitSettings);
  els.form.addEventListener('input', schedulePreview);
  els.form.addEventListener('change', () => {
    syncFieldRules();
    schedulePreview();
  });
  els.modal.addEventListener('click', (event) => {
    if (isBackdropClick(event)) closeSettingsModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) closeSettingsModal();
  });
}

function isOpen() {
  return isModalOpen(els.modal);
}

async function openSettingsModal() {
  try {
    const result = await getLabelSettings();
    defaults = result.defaults || {};
    fillForm(result.settings || {});

    showModal(els.modal);
    await refreshPreview();
  } catch (error) {
    reportError('openSettingsModal', error, 'Erro ao carregar configuração da etiqueta');
  }
}

function closeSettingsModal() {
  clearTimeout(previewTimer);
  previewSeq += 1;
  hideModal(els.modal);
  els.preview.replaceChildren();
}

function fillForm(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const input = els.form.elements.namedItem(key);
    if (!input) continue;

    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  }

  // Select sem valor válido (ex.: parâmetro ainda não salvo) volta para a 1ª opção
  for (const select of els.form.querySelectorAll('select[name]')) {
    if (select.selectedIndex === -1) select.selectedIndex = 0;
  }

  syncFieldRules();
}

/* ──────────────────────────────────────────────────────────
   Regras da tabela "Campos da etiqueta":
   - campo oculto  → título e negritos desabilitados
   - título oculto → "Título em negrito" desabilitado
   (os valores marcados são preservados e voltam a valer ao reativar)
────────────────────────────────────────────────────────── */

function syncFieldRules() {
  for (const row of els.form.querySelectorAll('.dl-fields-table tr[data-field]')) {
    const field = row.dataset.field;
    const showInput = row.dataset.show ? els.form.elements.namedItem(row.dataset.show) : null;
    const visible = showInput ? showInput.checked : true;

    const labelInput = els.form.elements.namedItem(`label_${field}`);
    const boldLabel = els.form.elements.namedItem(`bold_label_${field}`);
    const boldValue = els.form.elements.namedItem(`bold_value_${field}`);
    const align = els.form.elements.namedItem(`align_${field}`);

    row.classList.toggle('is-hidden', !visible);
    if (labelInput) labelInput.disabled = !visible;
    if (boldLabel) boldLabel.disabled = !visible || !labelInput?.checked;
    if (boldValue) boldValue.disabled = !visible;
    if (align) align.disabled = !visible;
  }
}

function readForm() {
  const data = {};

  for (const input of els.form.querySelectorAll('input[name], select[name]')) {
    if (input.type === 'checkbox') data[input.name] = input.checked;
    else if (input.type === 'number') data[input.name] = input.value === '' ? null : Number(input.value);
    else data[input.name] = input.value.trim();
  }

  return data;
}

/* ──────────────────────────────────────────────────────────
   Pré-visualização (páginas renderizadas em PNG pelo servidor)
────────────────────────────────────────────────────────── */

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void refreshPreview(), PREVIEW_DEBOUNCE_MS);
}

async function refreshPreview() {
  clearTimeout(previewTimer);
  const seq = ++previewSeq;
  els.preview.classList.add('is-loading');

  try {
    const { pages = [] } = await previewLabelSettings(readForm());
    if (seq === previewSeq) els.preview.replaceChildren(...buildPageNodes(pages));
  } catch (error) {
    if (seq === previewSeq) reportError('refreshPreview', error, 'Erro ao gerar pré-visualização');
  } finally {
    if (seq === previewSeq) els.preview.classList.remove('is-loading');
  }
}

function buildPageNodes(pages) {
  return pages.flatMap((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `Etiqueta — página ${index + 1}`;

    const caption = document.createElement('div');
    caption.className = 'dl-preview-caption';
    caption.textContent = `Página ${index + 1} de ${pages.length}`;

    return [img, caption];
  });
}

async function restoreDefaults() {
  fillForm(defaults);
  await refreshPreview();
}

async function submitSettings(event) {
  event.preventDefault();

  try {
    const result = await saveLabelSettings(readForm());
    fillForm(result.settings || {});
    closeSettingsModal();
    window.alert('Configuração da etiqueta salva.');
  } catch (error) {
    reportError('submitSettings', error, 'Erro ao salvar configuração da etiqueta');
  }
}
