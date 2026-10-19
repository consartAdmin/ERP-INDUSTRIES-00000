// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.render.js — Renderização da interface                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els } from './spedFiscal.state.js';
import { escapeHtml, intFmt, money } from './spedFiscal.utils.js';

export function setStatus(message, type = 'info') {
  if (!els.statusBox) return;

  const normalizedType = ['error', 'warning'].includes(type) ? type : 'info';
  const variant = normalizedType === 'error'
    ? 'read-only-text__value--danger'
    : normalizedType === 'warning'
      ? 'read-only-text__value--warning'
      : 'read-only-text__value--info';

  els.statusBox.innerHTML = `
    <div class="read-only-text read-only-text--inline read-only-fs-4">
      <div class="read-only-text__row">
        <span class="read-only-text__label">${normalizedType.toUpperCase()}:</span>
        <span class="read-only-text__value ${variant}">${escapeHtml(message)}</span>
      </div>
    </div>
  `;
}

function readOnlyField(label, value, options = {}) {
  const {
    variant = '',
    width = 'read-only-w-7',
    height = 'read-only-h-3',
    valueType = '',
    extraClass = '',
  } = options;

  return `
    <div class="read-only-field ${width} ${extraClass}">
      <span class="read-only-field__label">${escapeHtml(label)}</span>
      <span class="read-only-field__value ${height} ${variant} ${valueType}"
            title="${escapeHtml(value)}">${escapeHtml(value)}</span>
    </div>
  `;
}

export function renderPreview(data = {}) {
  if (!els.summaryBox) return;

  const totals = data.totals || {};
  const company = data.company || {};
  const period = data.period || {};
  const layout = data.layout || {};

  els.summaryBox.innerHTML = `
  <div class="sf-summary-split">

    <!-- LEFT SIDE -->
    <div class="sf-summary-side sf-summary-side--left">

      <div class="read-only-fields">
        ${readOnlyField('Empresa', company.razao_social || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-11',
  })}

        ${readOnlyField('CNPJ', company.cnpj || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-8',
  })}

        ${readOnlyField('UF', company.uf || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-2',
  })}

        ${readOnlyField(
    'Período',
    `${period.month || '-'} / ${period.year || '-'}`,
    {
      variant: 'read-only-field__value--info',
      valueType: 'read-only-field__value--date',
      width: 'read-only-w-5',
    },
  )}
      </div>

      <div class="read-only-fields">
        ${readOnlyField('Participantes', intFmt(totals.participants), {
    valueType: 'read-only-field__value--number',
  })}

        ${readOnlyField('Produtos', intFmt(totals.products), {
    valueType: 'read-only-field__value--number',
  })}

        ${readOnlyField('Documentos', intFmt(totals.documents), {
    valueType: 'read-only-field__value--number',
  })}

        ${readOnlyField('Inventário', intFmt(totals.inventoryItems), {
    valueType: 'read-only-field__value--number',
  })}
      </div>

      <div class="read-only-fields">
        ${readOnlyField('Leiaute', layout.code || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-6',
  })}

        ${readOnlyField('Guia Prático', layout.guiaPratico || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-8',
  })}

        ${readOnlyField('Versão', layout.layoutVersion || '-', {
    variant: 'read-only-field__value--info',
    width: 'read-only-w-6',
  })}
      </div>
    </div>

    <!-- VERTICAL DIVIDER -->
    <div class="sf-summary-divider" aria-hidden="true"></div>

    <!-- RIGHT SIDE -->
    <div class="sf-summary-side sf-summary-side--right">

      <div class="read-only-fields">
        ${readOnlyField('Entradas', intFmt(totals.inboundDocuments), {
    variant: 'read-only-field__value--success',
    valueType: 'read-only-field__value--number',
  })}

          ${readOnlyField('Valor Entradas', money(totals.inboundAmount), {
    variant: 'read-only-field__value--success',
    valueType: 'read-only-field__value--currency',
    width: 'read-only-w-7',
  })}

        ${readOnlyField('Saídas', intFmt(totals.outboundDocuments), {
    variant: 'read-only-field__value--warning',
    valueType: 'read-only-field__value--number',
  })}

        ${readOnlyField('Valor Saídas', money(totals.outboundAmount), {
    variant: 'read-only-field__value--warning',
    valueType: 'read-only-field__value--currency',
    width: 'read-only-w-7',
  })}
      </div>

      <div class="read-only-fields">
        ${readOnlyField('ICMS Débito', money(totals.icmsDebit), {
    variant: 'read-only-field__value--warning',
    valueType: 'read-only-field__value--currency',
    width: 'read-only-w-8',
  })}

        ${readOnlyField('ICMS Crédito', money(totals.icmsCredit), {
    variant: 'read-only-field__value--success',
    valueType: 'read-only-field__value--currency',
    width: 'read-only-w-8',
  })}

        ${readOnlyField('Saldo ICMS', money(totals.icmsBalance), {
    variant: Number(totals.icmsBalance || 0) < 0
      ? 'read-only-field__value--danger'
      : 'read-only-field__value--success',
    valueType: 'read-only-field__value--currency',
    width: 'read-only-w-8',
  })}
      </div>

      <div class="read-only-fields">
        ${readOnlyField('Alertas', intFmt(totals.warnings), {
    variant: Number(totals.warnings || 0) > 0
      ? 'read-only-field__value--warning'
      : 'read-only-field__value--muted',
    valueType: 'read-only-field__value--number',
  })}

        ${readOnlyField('Erros', intFmt(totals.errors), {
    variant: Number(totals.errors || 0) > 0
      ? 'read-only-field__value--danger'
      : 'read-only-field__value--success',
    valueType: 'read-only-field__value--number',
  })}
      </div>
    </div>
  </div>
`;
}

export function renderIssues(validation = {}) {
  if (!els.issuesTableBody) return;

  const issues = Array.isArray(validation.issues) ? validation.issues : [];

  if (!issues.length) {
    els.issuesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="sf-empty-row">Nenhuma inconsistência encontrada.</td>
      </tr>
    `;
    return;
  }

  els.issuesTableBody.innerHTML = issues.map(issue => {
    const type = String(issue.type || issue.tipo || '').toLowerCase();
    const typeClass = ['erro', 'error'].includes(type) ? 'error' : 'warning';
    const typeLabel = typeClass === 'error' ? 'ERRO' : 'ALERTA';

    return `
      <tr>
        <td><span class="sf-pill ${typeClass}">${typeLabel}</span></td>
        <td>${escapeHtml(issue.bloco || '-')}</td>
        <td>${escapeHtml(issue.registro || '-')}</td>
        <td>${escapeHtml(issue.chave_ref || issue.referencia || '-')}</td>
        <td>${escapeHtml(issue.mensagem || issue.message || '-')}</td>
      </tr>
    `;
  }).join('');
}
