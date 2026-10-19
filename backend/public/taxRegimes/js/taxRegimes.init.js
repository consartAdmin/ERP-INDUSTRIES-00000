// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: taxRegimes.init.js                                            ║
// ║ MODULE: Regime Tributário — Page controller                         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import {
  createTaxRegime,
  getOptions,
  listTaxRegimes,
  setTaxRegimeActive,
  updateTaxRegime,
} from './taxRegimes.api.js';
import { renderBrackets, renderTable } from './taxRegimes.render.js';

const NUMERIC_FIELDS = [
  'rbt12',
  'mei_monthly_das',
  'irpj_presumption_pct',
  'csll_presumption_pct',
  'irpj_rate',
  'irpj_additional_rate',
  'irpj_additional_monthly_threshold',
  'csll_rate',
  'pis_rate',
  'cofins_rate',
  'estimated_profit_margin_pct',
];

const state = {
  options: { regimes: {}, defaults: {}, simplesAnnexes: {} },
  rows: [],
  loading: false,
};

const $ = (id) => document.getElementById(id);

const dom = {
  listPage: $('painel-lista'),
  formPage: $('painel-form'),
  tableBody: $('tableBody'),
  tableInfo: $('tableInfo'),
  showInactive: $('mostrarInativos'),
  newButton: $('btnNovo'),
  backButton: $('btnVoltarLista'),
  defaultsButton: $('btnPadrao'),
  form: $('formTaxRegime'),
  title: $('formTitulo'),
  bracketsBody: $('bracketsBody'),
  id: $('tax_regime_id'),
  regime: $('regime'),
  crt: $('crt'),
  validFrom: $('valid_from'),
  validTo: $('valid_to'),
  description: $('description'),
  annex: $('simples_annex'),
  isActive: $('is_active'),
};

const toast = {
  success: (title, message) => showCenterModal({ variant: 'success', title, message, timeoutMs: 4200 }),
  warn: (title, message) => showCenterModal({ variant: 'warning', title, message }),
  error: (title, message) => showCenterModal({ variant: 'error', title, message }),
};


// ======================================================================
// VIEW SWITCH
// ======================================================================

function showPanel(panel) {
  const isForm = panel === 'form';

  dom.listPage.hidden = isForm;
  dom.formPage.hidden = !isForm;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ======================================================================
// FORM
// ======================================================================

function fillSelects() {
  dom.regime.innerHTML = Object.entries(state.options.regimes)
    .map(([key, regime]) => `<option value="${key}">${regime.label}</option>`)
    .join('');

  dom.annex.innerHTML = Object.entries(state.options.simplesAnnexes)
    .map(([key, annex]) => `<option value="${key}">${annex.label}</option>`)
    .join('');
}

function syncRegimeView() {
  const regime = dom.regime.value;

  dom.crt.value = state.options.regimes[regime]?.crt ?? '';

  dom.form.querySelectorAll('[data-regime-group]').forEach((element) => {
    const groups = element.dataset.regimeGroup.split(/\s+/);
    element.hidden = !groups.includes(regime);
  });

  syncBrackets();
}

function syncBrackets() {
  renderBrackets(
    dom.bracketsBody,
    state.options.simplesAnnexes[dom.annex.value],
    $('rbt12').value,
  );
}

function applyDefaults() {
  const defaults = state.options.defaults[dom.regime.value] || {};

  NUMERIC_FIELDS.forEach((field) => {
    if (field === 'rbt12') return;
    $(field).value = defaults[field] ?? '';
  });

  if (defaults.simples_annex && !dom.annex.value) {
    dom.annex.value = defaults.simples_annex;
  }

  syncBrackets();
}

function resetForm() {
  dom.form.reset();
  dom.id.value = '';
  dom.title.textContent = 'Novo Regime Tributário';
  dom.regime.value = 'SIMPLES';
  dom.annex.value = 'I';
  dom.isActive.checked = true;
  dom.validFrom.value = `${new Date().getFullYear()}-01-01`;

  syncRegimeView();
  applyDefaults();
}

function fillForm(row) {
  dom.form.reset();
  dom.id.value = row.tax_regime_id;
  dom.title.textContent = `Editar Regime #${row.tax_regime_id}`;
  dom.regime.value = row.regime;
  dom.validFrom.value = row.valid_from || '';
  dom.validTo.value = row.valid_to || '';
  dom.description.value = row.description || '';
  dom.annex.value = row.simples_annex || 'I';
  dom.isActive.checked = Boolean(row.is_active);

  NUMERIC_FIELDS.forEach((field) => {
    $(field).value = row[field] ?? '';
  });

  syncRegimeView();
}

function readForm() {
  const payload = {
    regime: dom.regime.value,
    valid_from: dom.validFrom.value,
    valid_to: dom.validTo.value || null,
    description: dom.description.value.trim(),
    simples_annex: dom.annex.value,
    is_active: dom.isActive.checked,
  };

  // Hidden fields belong to another regime, so they are not saved.
  NUMERIC_FIELDS.forEach((field) => {
    const input = $(field);
    const visible = !input.closest('[hidden]');
    payload[field] = visible && input.value !== '' ? Number(input.value) : null;
  });

  return { id: dom.id.value, payload };
}


// ======================================================================
// ACTIONS
// ======================================================================

async function loadList() {
  if (state.loading) return;
  state.loading = true;
  dom.tableInfo.textContent = 'Carregando...';

  try {
    const response = await listTaxRegimes({ includeInactive: dom.showInactive.checked });
    state.rows = response.data || [];

    renderTable(dom.tableBody, state.rows, { onEdit: editRow, onToggle: toggleRow });
    dom.tableInfo.textContent = `${state.rows.length} ${state.rows.length === 1 ? 'registro' : 'registros'}`;
  } catch (error) {
    console.error('[taxRegimes] Erro ao listar', error);
    dom.tableInfo.textContent = 'Erro ao carregar';
    toast.error('Erro ao carregar', error.message || 'Não foi possível carregar os regimes.');
  } finally {
    state.loading = false;
  }
}

function editRow(row) {
  fillForm(row);
  showPanel('form');
}

async function toggleRow(row) {
  const activate = !row.is_active;
  const verb = activate ? 'ativar' : 'desativar';

  if (!window.confirm(`Deseja ${verb} o regime "${row.regime_label}" (ID ${row.tax_regime_id})?`)) return;

  try {
    await setTaxRegimeActive(row.tax_regime_id, activate);
    await loadList();
    toast.success('Regime atualizado', `Regime ${activate ? 'ativado' : 'desativado'} com sucesso.`);
  } catch (error) {
    toast.error(`Erro ao ${verb}`, error.message);
  }
}

async function submitForm(event) {
  event.preventDefault();

  const { id, payload } = readForm();

  if (!payload.valid_from) {
    toast.warn('Campo obrigatório', 'Informe o início da vigência.');
    dom.validFrom.focus();
    return;
  }

  try {
    if (id) {
      await updateTaxRegime(id, payload);
    } else {
      await createTaxRegime(payload);
    }

    resetForm();
    showPanel('list');
    await loadList();
    toast.success('Regime salvo', 'Regime tributário salvo com sucesso.');
  } catch (error) {
    console.error('[taxRegimes] Erro ao salvar', error);
    toast.error('Erro ao salvar', error.message || 'Não foi possível salvar o regime.');
  }
}


// ======================================================================
// INIT
// ======================================================================

async function init() {
  dom.newButton.addEventListener('click', () => {
    resetForm();
    showPanel('form');
  });
  dom.backButton.addEventListener('click', () => showPanel('list'));
  dom.defaultsButton.addEventListener('click', applyDefaults);
  dom.showInactive.addEventListener('change', loadList);
  dom.form.addEventListener('submit', submitForm);

  dom.regime.addEventListener('change', () => {
    syncRegimeView();
    applyDefaults();
  });
  dom.annex.addEventListener('change', syncBrackets);
  $('rbt12').addEventListener('input', syncBrackets);

  try {
    state.options = await getOptions();
  } catch (error) {
    toast.error('Erro ao carregar', error.message || 'Não foi possível carregar as opções de regime.');
  }

  fillSelects();
  resetForm();
  showPanel('list');
  loadList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
