// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.form.js — Filtros, formulário e date-range          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $ } from './invoicesIssued.utils.js';
import { state } from './invoicesIssued.state.js';
import { listNfeStatusMap } from './invoicesIssued.api.js';
import { normalizeNfeStatusCode, validateInvoicePayload } from './invoicesIssued.validation.js';

const template = document.createElement('template');

template.innerHTML = `
  <div class="date-range-field-root">
    <span class="date-range-field-label"></span>
    <button class="date-range-field-trigger" type="button" aria-haspopup="dialog" aria-expanded="false">
      <span class="date-range-field-display"></span>
      <span class="date-range-field-icon" aria-hidden="true">📅</span>
    </button>
    <dialog class="date-range-field-panel">
      <div class="date-range-field-dates">
        <label class="date-range-field-date">
          <span class="date-range-field-start-label"></span>
          <input class="date-range-field-start" type="date">
        </label>
        <label class="date-range-field-date">
          <span class="date-range-field-end-label"></span>
          <input class="date-range-field-end" type="date">
        </label>
      </div>
      <p class="date-range-field-error" role="alert"></p>
      <div class="date-range-field-actions">
        <button class="date-range-field-action date-range-field-clear" type="button"></button>
        <button class="date-range-field-action date-range-field-apply" type="button"></button>
      </div>
    </dialog>
  </div>
`;

export class DateRangeField extends HTMLElement {
  static formAssociated = true;
  static componentCounter = 0;

  static get observedAttributes() {
    return ['label', 'locale', 'start-date', 'end-date', 'min', 'max', 'disabled', 'required'];
  }

  constructor() {
    super();
    this.append(template.content.cloneNode(true));
    this._internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    this._committed = { startDate: '', endDate: '' };
    this._componentId = `date-range-field-${++DateRangeField.componentCounter}`;
  }

  connectedCallback() {
    this._cacheElements();
    this._configureAccessibility();
    this._renderText();
    this._syncFromAttributes();
    this._bindEvents();
    this._render();
  }

  attributeChangedCallback() {
    if (!this.isConnected || !this._trigger) return;
    this._renderText();
    this._syncFromAttributes();
    this._render();
  }

  formResetCallback() {
    this.value = {
      startDate: this.getAttribute('start-date') || '',
      endDate: this.getAttribute('end-date') || '',
    };
  }

  formDisabledCallback(disabled) {
    this.toggleAttribute('disabled', disabled);
  }

  get value() {
    return { ...this._committed };
  }

  set value(range = {}) {
    this._committed = {
      startDate: range.startDate || '',
      endDate: range.endDate || '',
    };
    if (this._start && this._end) {
      this._start.value = this._committed.startDate;
      this._end.value = this._committed.endDate;
      this._render();
    }
  }

  clear() {
    this.value = { startDate: '', endDate: '' };
    this._error.textContent = '';
    this._emitChange();
  }

  open() {
    if (this.hasAttribute('disabled')) return;
    this._start.value = this._committed.startDate;
    this._end.value = this._committed.endDate;
    if (!this._panel.open) this._panel.showModal();
    this._trigger.setAttribute('aria-expanded', 'true');
    this._start.focus();
  }

  close() {
    if (!this._panel?.open) return;
    this._panel.close();
    this._trigger.setAttribute('aria-expanded', 'false');
  }

  _cacheElements() {
    const select = (selector) => this.querySelector(selector);
    this._label = select('.date-range-field-label');
    this._trigger = select('.date-range-field-trigger');
    this._display = select('.date-range-field-display');
    this._panel = select('.date-range-field-panel');
    this._start = select('.date-range-field-start');
    this._end = select('.date-range-field-end');
    this._startLabel = select('.date-range-field-start-label');
    this._endLabel = select('.date-range-field-end-label');
    this._error = select('.date-range-field-error');
    this._apply = select('.date-range-field-apply');
    this._clear = select('.date-range-field-clear');
  }

  _configureAccessibility() {
    const labelId = `${this._componentId}-label`;
    const panelId = `${this._componentId}-panel`;
    const errorId = `${this._componentId}-error`;
    this._label.id = labelId;
    this._panel.id = panelId;
    this._error.id = errorId;
    this._trigger.setAttribute('aria-labelledby', labelId);
    this._trigger.setAttribute('aria-controls', panelId);
    this._trigger.setAttribute('aria-describedby', errorId);
    this._panel.setAttribute('aria-labelledby', labelId);
  }

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    this._trigger.addEventListener('click', () => this._panel.open ? this.close() : this.open());
    this._start.addEventListener('input', () => this._validateDraft());
    this._end.addEventListener('input', () => this._validateDraft());
    this._apply.addEventListener('click', () => this._applyDraft());
    this._clear.addEventListener('click', () => {
      this.clear();
      this.close();
      this._trigger.focus();
    });
    this._panel.addEventListener('close', () => this._trigger.setAttribute('aria-expanded', 'false'));
    this._panel.addEventListener('click', (event) => {
      if (event.target === this._panel) this.close();
    });
  }

  _syncFromAttributes() {
    if (this.hasAttribute('start-date')) this._committed.startDate = this.getAttribute('start-date') || '';
    if (this.hasAttribute('end-date')) this._committed.endDate = this.getAttribute('end-date') || '';
    this._start.value = this._committed.startDate;
    this._end.value = this._committed.endDate;
    const min = this.getAttribute('min') || '';
    const max = this.getAttribute('max') || '';
    const disabled = this.hasAttribute('disabled');
    for (const input of [this._start, this._end]) {
      input.min = min;
      input.max = max;
      input.disabled = disabled;
    }
    this._trigger.disabled = disabled;
    this._apply.disabled = disabled;
    this._clear.disabled = disabled;
    if (disabled) this.close();
  }

  _renderText() {
    const portuguese = (this.getAttribute('locale') || 'pt-BR').toLowerCase().startsWith('pt');
    this._label.textContent = this.getAttribute('label') || (portuguese ? 'Intervalo' : 'Date range');
    this._startLabel.textContent = portuguese ? 'De' : 'From';
    this._endLabel.textContent = portuguese ? 'Até' : 'To';
    this._clear.textContent = portuguese ? 'Limpar' : 'Clear';
    this._apply.textContent = portuguese ? 'Aplicar' : 'Apply';
  }

  _validateDraft() {
    const portuguese = (this.getAttribute('locale') || 'pt-BR').toLowerCase().startsWith('pt');
    const startDate = this._start.value;
    const endDate = this._end.value;
    let message = '';
    if (startDate && endDate && endDate < startDate) {
      message = portuguese ? 'A data final deve ser igual ou posterior à inicial.' : 'The end date must be on or after the start date.';
    } else if (this.hasAttribute('required') && (!startDate || !endDate)) {
      message = portuguese ? 'Selecione as duas datas.' : 'Select both dates.';
    }
    this._error.textContent = message;
    this._apply.disabled = Boolean(message) || this.hasAttribute('disabled');
    return !message;
  }

  _applyDraft() {
    if (!this._validateDraft()) return;
    this._committed = { startDate: this._start.value, endDate: this._end.value };
    this._render();
    this._emitChange();
    this.close();
    this._trigger.focus();
  }

  _render() {
    const { startDate, endDate } = this._committed;
    const hasRange = Boolean(startDate || endDate);
    const locale = this.getAttribute('locale') || 'pt-BR';
    const portuguese = locale.toLowerCase().startsWith('pt');
    if (hasRange) {
      this._display.textContent = `${this._formatDate(startDate, locale) || '…'} – ${this._formatDate(endDate, locale) || '…'}`;
    } else {
      this._display.textContent = portuguese ? 'Selecione um intervalo' : 'Select a date range';
    }
    this._display.classList.toggle('placeholder', !hasRange);
    this._updateFormValue();
  }

  _formatDate(isoDate, locale) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat(locale).format(new Date(year, month - 1, day));
  }

  _updateFormValue() {
    const { startDate, endDate } = this._committed;
    const formData = new FormData();
    formData.append(this.getAttribute('name-start') || 'dateFrom', startDate);
    formData.append(this.getAttribute('name-end') || 'dateTo', endDate);
    this._internals?.setFormValue(formData);
    const invalid = this.hasAttribute('required') && (!startDate || !endDate);
    const message = invalid ? 'Complete o intervalo de datas.' : '';
    this._internals?.setValidity(invalid ? { valueMissing: true } : {}, message, this._trigger);
    this._trigger.setAttribute('aria-invalid', String(invalid));
  }

  _emitChange() {
    this.dispatchEvent(new CustomEvent('range-change', {
      bubbles: true,
      composed: true,
      detail: this.value,
    }));
  }
}

if (!customElements.get('date-range-field')) {
  customElements.define('date-range-field', DateRangeField);
}

export function getQueryParams() {
  const params = new URLSearchParams();

  const q = $('searchInput')?.value?.trim() || '';
  const status = $('statusFilter')?.value || 'TODOS';

  const range = $('dateFilter')?.value || {};
  const dateFrom = range.startDate || '';
  const dateTo = range.endDate || '';

  if (q) {
    params.set('q', q);
  }

  if (status && status !== 'TODOS') {
    params.set('status', status);
  }

  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  params.set('limit', state.limit);
  params.set('offset', state.offset);

  return params.toString();
}

export function getDownloadXmlUrl() {
  return `/api/invoices-issued/downloads/xmls?${getQueryParams()}`;
}

export function getDownloadDanfeUrl() {
  return `/api/invoices-issued/downloads/danfes?${getQueryParams()}`;
}

// ======================================================================
// NF-e STATUS MAP -> SELECTS
// ======================================================================

function appendOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

export async function loadNfeStatusOptions() {
  const out = await listNfeStatusMap();
  const statuses = Array.isArray(out?.data) ? out.data : [];

  state.statusMap = statuses;
  state.statusByCode = new Map(
    statuses.map((item) => [String(item.code || '').toUpperCase(), item])
  );

  const filter = $('statusFilter');

  if (filter) {
    const current = normalizeNfeStatusCode(filter.value) || 'TODOS';
    filter.replaceChildren();
    appendOption(filter, 'TODOS', 'Todos os status');

    for (const status of statuses) {
      appendOption(
        filter,
        status.code,
        status.name || status.code,
      );
    }

    filter.value =
      current === 'TODOS' || state.statusByCode.has(current)
        ? current
        : 'TODOS';
  }

  const modalSelect = $('nfe_status');

  if (modalSelect) {
    const current = normalizeNfeStatusCode(modalSelect.value) || 'PENDENTE';
    modalSelect.replaceChildren();

    for (const status of statuses) {
      appendOption(
        modalSelect,
        status.code,
        status.name
          ? `${status.code} — ${status.name}`
          : status.code,
      );
    }

    if (!statuses.length) {
      appendOption(modalSelect, 'PENDENTE', 'PENDENTE');
    }

    modalSelect.value =
      state.statusByCode.has(current)
        ? current
        : (state.statusByCode.has('PENDENTE') ? 'PENDENTE' : modalSelect.options[0]?.value || '');
  }

  return statuses;
}

export function getInvoiceFormPayload() {
  const payload = {
    order_id: $('order_id')?.value ? Number($('order_id').value) : null,
    nfe_number: $('nfe_number')?.value ? Number($('nfe_number').value) : null,
    nfe_key: $('nfe_key')?.value?.trim() || null,
    nfe_status: normalizeNfeStatusCode($('nfe_status')?.value) || null,
    nfe_environment: $('nfe_environment')?.value?.trim() || null,
    nfe_protocol: $('nfe_protocol')?.value?.trim() || null,
    issued_date: $('issued_date')?.value || null,
    total_amount: $('total_amount')?.value ? Number($('total_amount').value) : 0,
    xml_url: $('xml_url')?.value?.trim() || null,
    danfe_url: $('danfe_url')?.value?.trim() || null,
  };

  return validateInvoicePayload(payload);
}
