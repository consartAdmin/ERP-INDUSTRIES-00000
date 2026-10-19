'use strict';

import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';
import { openCashDocumentTypesModal } from '/public/cashDocumentTypes/cashDocumentTypesModal.js';
import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';
import * as api from './accountsPayable.api.js';
import { state } from './accountsPayable.state.js';
import { renderAttachments } from './accountsPayable.render.js';
import { localDateTimeValue, qs, toInputDate, toInt } from './accountsPayable.utils.js';

function bankAccountLabel(account = {}) {
  const name = String(account.name || '').trim();
  const bank = String(account.bank_name || '').trim();
  const number = [account.agency, account.account_number]
    .filter(Boolean)
    .join('/');
  return [name || bank || `Conta #${account.id}`, bank && bank !== name ? bank : '', number]
    .filter(Boolean)
    .join(' — ');
}

async function populateBankAccountSelect(select, selectedId = null) {
  if (!select) return [];
  const wanted = selectedId == null || selectedId === '' ? '' : String(selectedId);
  select.disabled = true;
  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    const rows = (await api.listBankAccounts())
      .filter((account) => account?.is_active !== false);
    select.innerHTML = '<option value="">Selecione...</option>';
    rows.forEach((account) => {
      const option = new Option(bankAccountLabel(account), String(account.id));
      option.dataset.accountName = String(account.name || account.bank_name || '').trim();
      option.dataset.bankName = String(account.bank_name || '').trim();
      option.dataset.isDefault = account.is_default ? 'true' : 'false';
      select.add(option);
    });

    if (wanted && [...select.options].some((option) => option.value === wanted)) {
      select.value = wanted;
    } else {
      const defaultAccount = rows.find((account) => account.is_default);
      if (defaultAccount) select.value = String(defaultAccount.id);
    }
    return rows;
  } catch (error) {
    console.error('[accountsPayable] bank accounts:', error);
    select.innerHTML = '<option value="">Erro ao carregar contas</option>';
    throw error;
  } finally {
    select.disabled = false;
  }
}

/* ==========================================================================
 * Modal individual — Nova / Editar Conta a Pagar
 * Incorporado de editAccountsPayableModal.js
 * ========================================================================== */

const editAccountsPayableModalModule = (() => {
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ editAccountsPayableModal.js — Modal de Nova/Editar Conta a Pagar      ║
  // ║ PRODNEX ERP | Frontend (ESM)                                         ║
  // ║ - Criação dinâmica do modal                                          ║
  // ║ - Reutilizável para NOVO e EDIÇÃO                                    ║
  // ║ - Fecha por ESC / backdrop / botões                                  ║
  // ║ - Normaliza payload para API /api/accounts-payable                   ║
  // ║ - Suporte a anexo por clique e drag & drop                           ║
  // ║ - Exibe anexos já salvos em /api/accounts-payable/:id/anexos         ║
  // ║ - Permite remover anexos salvos diretamente no modal                 ║
  // ╚══════════════════════════════════════════════════════════════════════╝



  const MODAL_ID = 'new-accounts-payable-modal-consart';

  function qs(sel, el = document) {
    return el.querySelector(sel);
  }

  function qsa(sel, el = document) {
    return [...el.querySelectorAll(sel)];
  }

  function toInt(v) {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  function toFloat(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number.parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  function safeStr(v) {
    return v == null ? '' : String(v);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatInputDate(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function statusLabel(status) {
    const s = String(status || 'PENDING').toUpperCase();
    if (s === 'PAID') return 'Pago';
    if (s === 'OVERDUE') return 'Vencido';
    if (s === 'CANCELLED') return 'Cancelado';
    return 'Pendente';
  }

  function formatBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function buildPayloadFromForm(form) {
    return {
      supplier_id: toInt(form.supplier_id.value),
      invoice_number: form.invoice_number.value.trim() || null,
      issue_date: form.elements.namedItem('issue_date')?.value || null,
      due_date: form.due_date.value || null,
      payment_date: form.payment_date.value || null,
      bank_account_id: toInt(form.bank_account_id.value),
      chart_account_id: toInt(form.chart_account_id.value),
      category_id: toInt(form.category_id.value),
      subcategory_id: toInt(form.subcategory_id.value),
      document_type_id: toInt(form.document_type_id.value),
      document_number: form.document_number.value.trim() || null,
      total_value: toFloat(form.total_value.value),
      amount_paid: toFloat(form.amount_paid.value) ?? 0,
      status: form.status.value || 'PENDING',
      description: form.description.value.trim() || null,
      notes: form.notes.value.trim() || null,
      attachment_url: null,
    };
  }

  function validatePayload(payload) {
    if (!payload.supplier_id) {
      return 'Informe o ID do fornecedor.';
    }
    if (!payload.issue_date) {
      return 'Informe a data de emissão.';
    }
    if (!payload.due_date) {
      return 'Informe a data de vencimento.';
    }
    if (payload.total_value == null || Number.isNaN(payload.total_value)) {
      return 'Informe o valor total.';
    }
    if (payload.total_value < 0) {
      return 'O valor total não pode ser negativo.';
    }
    if (payload.amount_paid != null && payload.amount_paid < 0) {
      return 'O valor pago não pode ser negativo.';
    }
    return null;
  }

  function createFieldGroup(label, inputHtml, extraClass = '') {
    return `
      <div class="apm-field ${extraClass}">
        <label class="apm-label">${label}</label>
        ${inputHtml}
      </div>
    `;
  }

  function buildModalHTML({ mode = 'create', data = {} } = {}) {
    const isEdit = mode === 'edit';
    const title = isEdit
      ? `Editar Conta a Pagar #${safeStr(data.id)}`
      : 'Nova Conta a Pagar';

    const issueDate = formatInputDate(data.issue_date) || todayISO();
    const dueDate = formatInputDate(data.due_date) || todayISO();
    const paymentDate = formatInputDate(data.payment_date) || '';
    const status = safeStr(data.status || 'PENDING').toUpperCase();

    return `
      <div class="modal__backdrop" data-modal-close="backdrop"></div>
  
      <div class="modal__dialog">
        <section class="modal__panel modal__panel--lg" role="document">
          
          <header class="modal__header">
            <h2 id="apmTitle" class="modal__title">${title}</h2>
            <button
              type="button"
              class="modal__close"
              data-close="button"
              aria-label="Fechar modal"
              title="Fechar"
            >
              &times;
            </button>
          </header>
  
          <form
            id="apmForm"
            class="apm-form"
            novalidate
            autocomplete="off"
            style="display:flex; flex:1 1 auto; min-height:0; flex-direction:column;"
          >
            <input type="hidden" name="id" value="${safeStr(data.id)}" />
            <input type="hidden" name="issue_date" value="${issueDate}" />
  
            <div class="modal__body modal-section">

            <div class="ap-modal-section-title">Informações da Conta</div>

            <div class="fields-inline fields-gap-3">
                <div class="fields fields-h-6 fields-w-20 fields-font-3">
                <label for="apmSupplierDisplay">Fornecedor *</label>
                <div
                  class="apm-supplier-picker"
                  style="display:flex; flex-wrap:nowrap; align-items:stretch; gap:4px; width:100%; min-width:0;"
                >
                  <input
                    type="hidden"
                    name="supplier_id"
                    value="${safeStr(data.supplier_id)}"
                    required
                  />
  
                  <input
                    type="text"
                    id="apmSupplierDisplay"
                    name="supplier_display"
                    value="${safeStr(data.supplier_name || '')}"
                    placeholder="Clique para pesquisar o fornecedor"
                    readonly
                    class="apm-supplier-display"
                    style="box-sizing:border-box; flex:1 1 auto; width:auto; min-width:0;"
                  />
  
                  <button
                    type="button"
                    class="apm-supplier-btn"
                    data-action="pick-supplier"
                    aria-label="Pesquisar fornecedor"
                    title="Pesquisar fornecedor"
                    style="box-sizing:border-box; display:inline-flex; flex:0 0 30px; align-items:center; justify-content:center; width:30px; min-width:30px; max-width:30px; height:100%; min-height:30px; padding:0; margin:0;"
                  >
                    🔎
                  </button>
                </div>
              </div>
  
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmDocumentTypeId">Tipo de Doc.</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <select
                    id="apmDocumentTypeId"
                    name="document_type_id"
                    style="flex:1 1 auto; min-width:0;"
                  >
                    <option value="">Selecione...</option>
                  </select>
  
                  <button
                    type="button"
                    id="apmCashDocumentTypesButton"
                    class="btn btn-icon"
                    title="Cadastrar tipos de documento"
                    aria-label="Cadastrar tipos de documento"
                    style="flex:0 0 auto; width:auto; min-width:0; height:auto; padding:0 4px; border:0; background:transparent; box-shadow:none; color:#2c609f; font-size:22px; font-weight:700; line-height:1;"
                  >
                    ＋
                  </button>
                </div>
              </div>
  
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmInvoiceNumber">Nº Fatura</label>
                <input
                  type="text"
                  id="apmInvoiceNumber"
                  name="invoice_number"
                  value="${safeStr(data.invoice_number)}"
                  placeholder="Número da fatura/conta"
                />
              </div>
  
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmDueDate">Data Vencimento *</label>
                <input
                  type="date"
                  id="apmDueDate"
                  name="due_date"
                  value="${dueDate}"
                  required
                />
              </div>

            </div>

            <div class="ap-modal-section-title">Pagamento</div>

            <div class="fields-inline fields-gap-3">

                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmPaymentDate">Data Pagamento</label>
                <input
                  type="date"
                  id="apmPaymentDate"
                  name="payment_date"
                  value="${paymentDate}"
                />
              </div>
  
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
<label for="apmBankAccountId">Conta de Caixa</label>
<select
  id="apmBankAccountId"
  name="bank_account_id"
>
                  <option value="">Selecione...</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmTotalValue">Valor Total *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="apmTotalValue"
                  name="total_value"
                  value="${safeStr(data.total_value)}"
                  placeholder="0,00"
                  inputmode="decimal"
                  required
                />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmAmountPaid">Valor Pago</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="apmAmountPaid"
                  name="amount_paid"
                  value="${safeStr(data.amount_paid)}"
                  placeholder="0,00"
                  inputmode="decimal"
                />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmStatus">Status *</label>
                <select id="apmStatus" name="status" required>
                  <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>Pendente</option>
                  <option value="PAID" ${status === 'PAID' ? 'selected' : ''}>Pago</option>
                  <option value="OVERDUE" ${status === 'OVERDUE' ? 'selected' : ''}>Vencido</option>
                  <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>Cancelado</option>
                </select>
              </div>
            </div>

            <div class="ap-modal-section-title">Classificação Financeira</div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-20 fields-font-3 ap-chart-account-field">
                <label for="apmChartAccountDisplay">Conta Contábil</label>
                <input
                  type="hidden"
                  id="apmChartAccountId"
                  name="chart_account_id"
                  value="${safeStr(data.chart_account_id)}"
                />
                <div class="ap-chart-account-picker">
                  <input
                    type="text"
                    id="apmChartAccountDisplay"
                    name="chart_account_display"
                    readonly
                    placeholder="Selecione..."
                    title="Clique para buscar uma conta contábil"
                  />
                  <button type="button" id="apmSearchChartAccount" class="btn btn-toolbar btn-sm"
                    aria-label="Buscar conta contábil" title="Buscar conta contábil">🔍</button>
                  <button type="button" id="apmClearChartAccount" class="btn btn-toolbar btn-sm"
                    aria-label="Limpar conta contábil" title="Limpar conta contábil">✕</button>
                </div>
              </div>

                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmCategoryId">Categoria</label>
                <select
                  id="apmCategoryId"
                  name="category_id"
                >
                  <option value="">(opcional)</option>
                </select>
              </div>
  
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="apmSubcategoryId">Subcategoria</label>
                <select
                  id="apmSubcategoryId"
                  name="subcategory_id"
                >
                  <option value="">(opcional)</option>
                </select>
              </div>
  
                <div class="fields fields-h-6 fields-w-20 fields-font-3">
                <label for="apmDocumentNumber">Nº Documento</label>
                <input
                  type="text"
                  id="apmDocumentNumber"
                  name="document_number"
                  value="${safeStr(data.document_number)}"
                  placeholder="Ex: boleto, NF, duplicata..."
                />
              </div>
            </div>
  
  
            <div class="apm-mini-summary">
              <div class="apm-mini-summary__item">
                <span class="apm-mini-summary__label">Status atual</span>
                <strong id="apmStatusPreview">${statusLabel(status)}</strong>
              </div>
              <div class="apm-mini-summary__item">
                <span class="apm-mini-summary__label">Saldo previsto</span>
                <strong id="apmBalancePreview">R$ 0,00</strong>
              </div>
            </div>
  
            <div class="fields">
                <label for="apmDescription">Descrição</label>
                <textarea
                  id="apmDescription"
                  name="description"
                  rows="2"
                  placeholder="Descrição da conta a pagar..."
                >${safeStr(data.description)}</textarea>
            </div>
  
              <div class="modal-divider"></div>

            <div class="ap-modal-section-title">Anexos e Observações</div>
  
            <div
              class="modal-payment-files-layout"
              style="display:grid; grid-template-columns:210px max-content; gap:12px; align-items:start; width:100%; min-width:0;"
            >
              <div class="modal-box-column" style="width:210px; min-width:210px;">
                <label for="apmAttachmentFile" class="modal-box-title">
                  Anexo da conta (opcional)
                </label>
  
                <div class="apm-upload">
                  <input
                    type="file"
                    id="apmAttachmentFile"
                    name="attachment_file"
                    class="apm-upload__input"
                    accept=".pdf,.xml,.png,.jpg,.jpeg,.webp"
                    hidden
                  />
  
                  <div
                    class="modal-dropzone apm-dropzone"
                    data-role="dropzone"
                    tabindex="0"
                    role="button"
                    aria-label="Selecionar ou arrastar um arquivo"
                    style="box-sizing:border-box; width:210px; min-width:210px; max-width:210px; height:100px; min-height:100px; max-height:100px; padding:12px; overflow:hidden;"
                  >
                    <div class="apm-dropzone__content modal-dropzone-font-10" data-role="dropzone-content">
                      <strong>📎 Arraste o arquivo aqui</strong>
                      <span>ou clique para selecionar</span>
                    </div>
                  </div>
  
                  <div class="apm-upload__meta" data-role="file-meta">
                    <span>Nenhum arquivo selecionado.</span>
                  </div>
  
                </div>
              </div>
  
              <div class="modal-box-column" style="min-width:0;">
                <div
                  class="modal-box-titles-grid"
                  style="display:grid; grid-template-columns:repeat(3, 210px); gap:12px; align-items:end;"
                >
                  <span class="modal-box-title modal-box-title--attachments">
                    Anexos da Conta
                  </span>
  
                  <label for="apmNotes" class="modal-box-title modal-box-title--observation">
                    Observações Internas
                  </label>
                </div>
  
                <div
                  class="pay-attachments-observation-grid"
                  style="display:grid; grid-template-columns:repeat(3, 210px); gap:12px; align-items:stretch;"
                >
                  <div
                    class="pay-attachments-inline apm-upload__saved"
                    data-role="saved-attachments"
                    role="list"
                    aria-live="polite"
                    style="display:contents;"
                  ></div>
  
                  <div
                    class="pay-observation-card pay-observation-card--clean"
                    style="box-sizing:border-box; grid-column:3; width:210px; min-width:210px; max-width:210px; height:100px; min-height:100px; max-height:100px; padding:0; overflow:hidden;"
                  >
                    <textarea
                      id="apmNotes"
                      name="notes"
                      rows="5"
                      maxlength="1000"
                      aria-label="Observações Internas"
                      placeholder="Digite uma observação..."
                      style="box-sizing:border-box; width:100%; height:100%; min-height:100%; max-height:100%; margin:0; padding:10px; resize:none;"
                    >${safeStr(data.notes)}</textarea>
                  </div>
                </div>
              </div>
            </div>
  
            </div>
  
            <footer class="modal__footer apm-footer-actions">
              <button
                type="button"
                class="btn btn-cancel btn-sm"
                data-close="cancel"
              >
                Cancelar
              </button>
  
              <button
                type="submit"
                class="btn btn-save btn-sm"
              >
                ${isEdit ? 'Salvar Alterações' : 'Salvar'}
              </button>
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function openNewAccountsPayableModal(options = {}) {
    const {
      mode = 'create',
      data = {},
      onSubmit = null,
      onClose = null,
    } = options;

    const old = document.getElementById(MODAL_ID);
    if (old) old.remove();

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'modal apm-root is-open';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'apmTitle');
    root.setAttribute('aria-hidden', 'false');
    root.innerHTML = buildModalHTML({ mode, data });

    document.body.appendChild(root);
    document.body.classList.add('apm-body-lock');

    const backdrop = qs('.modal__backdrop', root);
    const form = qs('#apmForm', root);
    const paymentDateInput = qs('[name="payment_date"]', root);

    if (paymentDateInput && !paymentDateInput.value) {
      paymentDateInput.value = todayISO();
    }

    const totalInput = qs('[name="total_value"]', root);
    const amountPaidInput = qs('[name="amount_paid"]', root);
    const statusInput = qs('[name="status"]', root);
    const balancePreview = qs('#apmBalancePreview', root);
    const statusPreview = qs('#apmStatusPreview', root);

    const supplierIdInput = qs('[name="supplier_id"]', root);
    const supplierDisplayInput = qs('[name="supplier_display"]', root);
    const supplierPickBtn = qs('[data-action="pick-supplier"]', root);
    const documentTypeSelect = qs('[name="document_type_id"]', root);
    const documentTypesButton = qs('#apmCashDocumentTypesButton', root);

    const bankAccountSelect =
      qs('[name="bank_account_id"]', root);

    const chartAccountIdInput = qs('[name="chart_account_id"]', root);
    const chartAccountDisplayInput = qs('[name="chart_account_display"]', root);
    const chartAccountSearchBtn = qs('#apmSearchChartAccount', root);
    const chartAccountClearBtn = qs('#apmClearChartAccount', root);
    const categorySelect = qs('[name="category_id"]', root);
    const subcategorySelect = qs('[name="subcategory_id"]', root);

    const attachmentInput = qs('[name="attachment_file"]', root);
    const dropzone = qs('[data-role="dropzone"]', root);
    const dropzoneContent = qs('[data-role="dropzone-content"]', root);
    const fileMeta = qs('[data-role="file-meta"]', root);
    const savedAttachmentsBox = qs('[data-role="saved-attachments"]', root);

    let closed = false;
    let selectedFile = null;

    async function loadDocumentTypes(selectedId = null) {
      if (!documentTypeSelect) return;

      const valueToRestore = selectedId ?? documentTypeSelect.value ?? '';
      documentTypeSelect.disabled = true;
      documentTypeSelect.innerHTML = '<option value="">Carregando...</option>';

      try {
        const res = await fetch('/api/cash-document-types?activeOnly=true', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        const response = await res.json().catch(() => null);
        if (!res.ok || response?.ok === false) {
          throw new Error(response?.error || `HTTP ${res.status}`);
        }

        const rows = response?.data || response?.rows || response?.items || [];
        documentTypeSelect.innerHTML = '<option value="">Selecione...</option>';

        rows
          .filter((item) => item.is_active !== false)
          .forEach((item) => {
            const option = document.createElement('option');
            option.value = String(item.id);
            option.textContent = item.name;
            documentTypeSelect.appendChild(option);
          });

        if (valueToRestore != null && valueToRestore !== '') {
          documentTypeSelect.value = String(valueToRestore);
        }
      } catch (err) {
        console.error('[newAccountsPayableModal] loadDocumentTypes error:', err);
        documentTypeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
      } finally {
        documentTypeSelect.disabled = false;
      }
    }

    function setChartAccount(account = null) {
      const id = account?.id ?? account?.chart_account_id ?? null;
      const code = account?.code ?? account?.chart_account_code ?? '';
      const description = account?.description ?? account?.chart_account_description ?? '';

      if (chartAccountIdInput) chartAccountIdInput.value = id ? String(id) : '';
      if (chartAccountDisplayInput) {
        chartAccountDisplayInput.value = id
          ? [code, description].filter(Boolean).join(' - ') || `Conta #${id}`
          : '';
      }
    }

    async function searchChartAccount() {
      try {
        const selected = await openChartAccountsModalSearch({
          query: chartAccountDisplayInput?.value || '',
          onlyPosting: true,
          onlyActive: true,
        });
        if (selected) setChartAccount(selected);
      } catch (err) {
        console.error('[newAccountsPayableModal] searchChartAccount error:', err);
        alert('Erro ao pesquisar conta contábil.');
      }
    }

    async function loadSubcategories(categoryId = null, selectedId = null) {
      if (!subcategorySelect) return;
      subcategorySelect.replaceChildren(new Option('(opcional)', ''));
      if (!categoryId) return;

      try {
        let rows = state.cashSubcategoriesByCategory[String(categoryId)];
        if (!Array.isArray(rows)) {
          rows = await api.listCashSubcategories(categoryId);
          state.cashSubcategoriesByCategory[String(categoryId)] = rows;
        }
        rows
          .filter((item) => item.is_active !== false)
          .forEach((item) => subcategorySelect.add(new Option(item.nome, String(item.id))));
        if (selectedId != null && selectedId !== '') {
          subcategorySelect.value = String(selectedId);
        }
      } catch (err) {
        console.error('[newAccountsPayableModal] loadSubcategories error:', err);
      }
    }

    async function loadCategories(selectedCategoryId = null, selectedSubcategoryId = null) {
      if (!categorySelect) return;
      categorySelect.disabled = true;
      categorySelect.replaceChildren(new Option('Carregando...', ''));
      try {
        const rows = state.cashCategories.length
          ? state.cashCategories
          : await api.listCashCategories();
        state.cashCategories = rows;
        categorySelect.replaceChildren(new Option('(opcional)', ''));
        rows
          .filter((item) => item.is_active !== false)
          .forEach((item) => categorySelect.add(new Option(item.nome, String(item.id))));
        if (selectedCategoryId != null && selectedCategoryId !== '') {
          categorySelect.value = String(selectedCategoryId);
        }
        await loadSubcategories(selectedCategoryId, selectedSubcategoryId);
      } catch (err) {
        console.error('[newAccountsPayableModal] loadCategories error:', err);
        categorySelect.replaceChildren(new Option('Erro ao carregar', ''));
      } finally {
        categorySelect.disabled = false;
      }
    }

    async function initializeFinancialClassification(source = {}) {
      let supplier = null;
      const supplierId = source?.supplier_id;
      if (supplierId) {
        try {
          supplier = await api.getSupplier(supplierId);
        } catch (err) {
          console.error('[newAccountsPayableModal] supplier defaults error:', err);
        }
      }

      setChartAccount({
        id: source?.chart_account_id ?? supplier?.chart_account_id,
        code: source?.chart_account_code ?? supplier?.chart_account_code,
        description: source?.chart_account_description ?? supplier?.chart_account_description,
      });
      await loadCategories(
        source?.cash_category_id ?? source?.category_id ?? supplier?.cash_category_id,
        source?.cash_subcategory_id ?? source?.subcategory_id ?? supplier?.cash_subcategory_id,
      );
    }

    function money(v) {
      const n = Number(v || 0);
      return n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
    }

    function getAttachmentId(att) {
      return (
        att?.id ??
        att?.attachment_id ??
        att?.anexo_id ??
        att?.file_id ??
        null
      );
    }

    function renderSavedAttachments(items = []) {
      if (!savedAttachmentsBox) return;

      if (!items.length) {
        savedAttachmentsBox.innerHTML = `
          <div
            class="apm-upload__saved-empty"
            style="box-sizing:border-box; grid-column:1 / 3; display:flex; align-items:center; justify-content:center; width:432px; height:100px; padding:12px; color:#64748b; font-size:12px; text-align:center; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;"
          >Nenhum anexo salvo.</div>
        `;
        return;
      }

      savedAttachmentsBox.innerHTML = items.map((att) => {
        const attachmentId = getAttachmentId(att);
        const fileName = att.file_name || 'Arquivo';
        const fileType = att.file_type || 'OUTRO';

        return `
          <div
            class="modal-attachment-card"
            role="listitem"
            style="box-sizing:border-box; position:relative; display:flex; flex-direction:column; align-items:flex-start; width:210px; min-width:210px; max-width:210px; height:100px; min-height:100px; max-height:100px; padding:10px; margin:0; overflow:hidden; background:#fff; border:1px solid #d1d5db; border-radius:8px;"
          >
            <span class="modal-attachment-card__icon" style="font-size:15px; line-height:1;">📄</span>
  
            <div class="modal-attachment-card__content" style="width:100%; min-width:0; overflow:hidden;">
              <strong class="modal-attachment-card__type" style="display:block; font-size:11px; line-height:1.2;">${escapeHtml(fileType)}</strong>
              <span class="modal-attachment-card__name" style="display:block; overflow:hidden; font-size:10px; line-height:1.2; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(fileName)}</span>
            </div>
  
            <button
              type="button"
              class="modal-attachment-card__open"
              data-action="open-saved-attachment"
              data-attachment-id="${escapeHtml(attachmentId ?? '')}"
              title="Abrir ${escapeHtml(fileName)}"
              ${attachmentId == null ? 'disabled' : ''}
              style="display:inline-flex; align-items:center; justify-content:center; min-height:20px; padding:2px 7px; margin-top:auto; color:#1d4ed8; font-size:10px; text-decoration:none; background:#eff6ff; border:1px solid #bfdbfe; border-radius:5px;"
            >Abrir</button>
  
            <button
              type="button"
              class="apm-upload__remove-btn"
              data-action="remove-saved-attachment"
              data-attachment-id="${escapeHtml(attachmentId ?? '')}"
              data-file-name="${escapeHtml(fileName)}"
              ${attachmentId == null ? 'disabled title="Anexo sem ID para remoção"' : `title="Remover ${escapeHtml(fileName)}"`}
              style="position:absolute; align-self:flex-end; padding:2px 5px; color:#991b1b; font-size:9px; background:#fef2f2; border:1px solid #fecaca; border-radius:5px; cursor:pointer;"
            >
              Remover
            </button>
          </div>
        `;
      }).join('');
    }

    async function loadSavedAttachments() {
      const recordId = toInt(data?.id);

      if (!recordId) {
        renderSavedAttachments([]);
        return;
      }

      try {
        renderSavedAttachments(await api.listAttachments(recordId));
      } catch (err) {
        console.error('[newAccountsPayableModal] loadSavedAttachments error:', err);
        renderSavedAttachments([]);
      }
    }

    async function openSavedAttachment(attachmentId) {
      const recordId = toInt(data?.id);
      if (!recordId || !attachmentId) {
        alert('Não foi possível identificar o anexo.');
        return;
      }

      const previewWindow = window.open('', '_blank');
      if (previewWindow) previewWindow.opener = null;

      try {
        const url = await api.getAttachmentDownloadUrl(recordId, attachmentId);
        if (previewWindow) previewWindow.location.replace(url);
        else window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        if (previewWindow) previewWindow.close();
        console.error('[newAccountsPayableModal] openSavedAttachment error:', err);
        alert(err?.message || 'Erro ao abrir anexo.');
      }
    }

    async function removeSavedAttachment(attachmentId, fileName = 'este anexo') {
      const recordId = toInt(data?.id);

      if (!recordId) {
        alert('Não foi possível identificar a conta a pagar.');
        return;
      }

      if (!attachmentId) {
        alert('Não foi possível identificar o anexo a remover.');
        return;
      }

      const confirmed = window.confirm(`Deseja remover o anexo "${fileName}"?`);
      if (!confirmed) return;

      try {
        const btn = qs(`[data-action="remove-saved-attachment"][data-attachment-id="${CSS.escape(String(attachmentId))}"]`, root);
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Removendo...';
        }

        await api.removeAttachment(recordId, attachmentId);

        await loadSavedAttachments();
      } catch (err) {
        console.error('[newAccountsPayableModal] removeSavedAttachment error:', err);
        alert(err?.message || 'Erro ao remover anexo.');
        await loadSavedAttachments();
      }
    }

    function updateSelectedFileUI(file = null) {
      if (!dropzoneContent || !fileMeta) return;

      if (file) {
        dropzoneContent.innerHTML = `
          <strong>Arquivo selecionado</strong>
          <span>${escapeHtml(file.name)}</span>
        `;

        fileMeta.innerHTML = `
          <span>${escapeHtml(file.name)} • ${formatBytes(file.size)}</span>
        `;

        dropzone.classList.add('has-file');
        return;
      }

      dropzoneContent.innerHTML = `
        <strong>Arraste um arquivo aqui</strong>
        <span>ou clique para selecionar</span>
      `;

      fileMeta.innerHTML = `<span>Nenhum arquivo selecionado.</span>`;

      dropzone.classList.remove('has-file');
    }

    function assignSelectedFile(file) {
      selectedFile = file || null;
      updateSelectedFileUI(selectedFile);
    }

    function syncPreview() {
      const total = toFloat(totalInput?.value) ?? 0;
      const paid = toFloat(amountPaidInput?.value) ?? 0;
      const balance = total - paid;

      if (balancePreview) {
        balancePreview.textContent = money(balance);
      }

      if (statusInput && statusPreview) {
        const current = String(statusInput.value || 'PENDING').toUpperCase();

        if (current !== 'CANCELLED' && current !== 'OVERDUE') {
          if (paid > 0 && paid >= total && total > 0) {
            statusInput.value = 'PAID';
          } else if (paid <= 0) {
            statusInput.value = 'PENDING';
          }
        }

        statusPreview.textContent = statusLabel(statusInput.value);
      }
    }

    async function handlePickSupplier() {
      try {
        const selected = await openSuppliersModalSearch();
        if (!selected) return;

        const supplierId =
          selected.supplier_id ??
          selected.id ??
          null;

        const supplierName =
          selected.name ??
          selected.supplier_name ??
          '';

        if (supplierIdInput) {
          supplierIdInput.value = supplierId ?? '';
        }

        if (supplierDisplayInput) {
          supplierDisplayInput.value = supplierName || '';
          supplierDisplayInput.title = supplierName || '';
        }

        await initializeFinancialClassification({ ...selected, supplier_id: supplierId });
      } catch (err) {
        console.error('[newAccountsPayableModal] handlePickSupplier error:', err);
        alert('Erro ao pesquisar fornecedor.');
      }
    }

    function close(reason = 'close') {
      if (closed) return;
      closed = true;

      document.removeEventListener('keydown', handleKeydown);
      document.body.classList.remove('apm-body-lock');
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      root.remove();

      if (typeof onClose === 'function') {
        onClose({ reason });
      }
    }

    function handleKeydown(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        close('escape');
      }
    }

    async function handleSubmit(ev) {
      ev.preventDefault();

      const payload = buildPayloadFromForm(form);
      const error = validatePayload(payload);

      if (error) {
        alert(error);
        return;
      }

      try {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = 'Salvando...';
        }

        if (typeof onSubmit === 'function') {
          await onSubmit({
            mode,
            id: toInt(form.id.value),
            payload,
            selectedFile,
            close,
            form,
            root,
          });
        } else {
          close('submit');
        }
      } catch (err) {
        console.error('[newAccountsPayableModal] handleSubmit error:', err);
        alert(err?.message || 'Erro ao salvar conta a pagar.');
      } finally {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || 'Salvar';
        }
      }
    }

    function setupDropzone() {
      if (!dropzone || !attachmentInput) return;

      dropzone.addEventListener('click', () => {
        attachmentInput.click();
      });

      dropzone.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          attachmentInput.click();
        }
      });

      attachmentInput.addEventListener('change', () => {
        const file = attachmentInput.files?.[0] || null;
        assignSelectedFile(file);
      });

      dropzone.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        dropzone.classList.add('is-dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
      });

      dropzone.addEventListener('drop', (ev) => {
        ev.preventDefault();
        dropzone.classList.remove('is-dragover');

        const file = ev.dataTransfer?.files?.[0] || null;
        if (!file) return;

        assignSelectedFile(file);

        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          attachmentInput.files = dt.files;
        } catch {
          // fallback silencioso
        }
      });
    }

    root.addEventListener('click', (ev) => {
      const openBtn = ev.target.closest('[data-action="open-saved-attachment"]');
      if (openBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        openSavedAttachment(openBtn.getAttribute('data-attachment-id'));
        return;
      }

      const removeBtn = ev.target.closest('[data-action="remove-saved-attachment"]');
      if (removeBtn) {
        ev.preventDefault();
        ev.stopPropagation();

        const attachmentId = removeBtn.getAttribute('data-attachment-id');
        const fileName = removeBtn.getAttribute('data-file-name') || 'este anexo';

        removeSavedAttachment(attachmentId, fileName);
        return;
      }

      const closer = ev.target.closest('[data-close="button"], [data-close="cancel"]');

      if (closer) {
        const why = closer.getAttribute('data-close') || 'close';
        close(why);
        return;
      }

      if (ev.target === backdrop) {
        close('backdrop');
      }
    });

    form.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeydown);

    if (supplierPickBtn) {
      supplierPickBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        handlePickSupplier();
      });
    }

    if (documentTypesButton) {
      documentTypesButton.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const currentId = documentTypeSelect?.value || data?.document_type_id || null;

        openCashDocumentTypesModal({
          onChange: () => loadDocumentTypes(currentId),
          onClose: () => loadDocumentTypes(currentId),
        });
      });
    }

    if (supplierDisplayInput) {
      supplierDisplayInput.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        handlePickSupplier();
      });
    }

    chartAccountSearchBtn?.addEventListener('click', searchChartAccount);
    chartAccountDisplayInput?.addEventListener('click', searchChartAccount);
    chartAccountClearBtn?.addEventListener('click', () => setChartAccount(null));

    categorySelect?.addEventListener('change', () => {
      loadSubcategories(categorySelect.value, null);
    });

    [totalInput, amountPaidInput, statusInput].forEach((el) => {
      if (el) el.addEventListener('input', syncPreview);
      if (el) el.addEventListener('change', syncPreview);
    });

    setupDropzone();
    loadDocumentTypes(data?.document_type_id ?? null);
    populateBankAccountSelect(
      bankAccountSelect,
      data?.bank_account_id ?? data?.cash_account_id ?? null,
    ).catch(() => { });
    initializeFinancialClassification(data);
    syncPreview();
    updateSelectedFileUI(null);
    loadSavedAttachments();

    setTimeout(() => {
      const first = form.querySelector('[name="supplier_display"]');
      if (first) first.focus();
    }, 30);

    return {
      root,
      form,
      close,
      setData(nextData = {}) {
        qsa('input, select, textarea', form).forEach((field) => {
          const name = field.name;
          if (!name || !(name in nextData)) return;

          const value = nextData[name];
          if (field.type === 'date') {
            field.value = formatInputDate(value);
          } else if (field.type !== 'file') {
            field.value = value ?? '';
          }
        });

        if (supplierIdInput && 'supplier_id' in nextData) {
          supplierIdInput.value = nextData.supplier_id ?? '';
        }

        if (supplierDisplayInput) {
          supplierDisplayInput.value =
            nextData.supplier_name ??
            nextData.name ??
            '';
        }

        if (bankAccountSelect && (
          'bank_account_id' in nextData ||
          'cash_account_id' in nextData
        )) {
          populateBankAccountSelect(
            bankAccountSelect,
            nextData.bank_account_id ?? nextData.cash_account_id ?? null,
          ).catch(() => { });
        }

        initializeFinancialClassification(nextData);

        selectedFile = null;
        updateSelectedFileUI(null);
        syncPreview();
        loadSavedAttachments();
      },
      getPayload() {
        return buildPayloadFromForm(form);
      },
      getSelectedFile() {
        return selectedFile;
      },
      refreshAttachments() {
        return loadSavedAttachments();
      },
    };
  }

  // Alias dedicado para o arquivo editAccountsPayableModal.js.
  const openEditAccountsPayableModal = openNewAccountsPayableModal;



  return { openNewAccountsPayableModal, openEditAccountsPayableModal };
})();

const { openNewAccountsPayableModal } = editAccountsPayableModalModule;

/* ==========================================================================
 * Modal de criação em lote
 * Incorporado de batchAccountsPayableModal.js
 * ========================================================================== */

const batchAccountsPayableModalModule = (() => {
  const MODAL_ID = 'batch-accounts-payable-modal-consart';

  const qs = (sel, el = document) => el.querySelector(sel);

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function toInt(v) {
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }

  function toFloat(v) {
    if (v === '' || v == null) return null;
    const n = Number.parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  function moneyBR(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function addMonthsISO(dateISO, monthsToAdd) {
    const d = new Date(`${dateISO}T12:00:00`);
    d.setMonth(d.getMonth() + monthsToAdd);
    return d.toISOString().slice(0, 10);
  }

  function buildModalHTML() {
    return `
      <div class="bapm-backdrop">
        <div class="bapm-window" role="dialog" aria-modal="true">
          <header class="bapm-header">
            <div>
              <div class="bapm-badge">LOTE</div>
              <h2 class="bapm-title">Gerar Contas a Pagar em Lote</h2>
              <p class="bapm-subtitle">Gere várias parcelas automaticamente para o mesmo fornecedor.</p>
            </div>
  
            <button type="button" class="bapm-close" data-close>&times;</button>
          </header>
  
          <form id="bapmForm" class="bapm-form" autocomplete="off">
            <section class="bapm-section">
              <h3>Dados principais</h3>
  
              <div class="bapm-grid bapm-grid--main">
                <div class="bapm-field">
                  <label>Fornecedor *</label>
                  <div class="bapm-supplier-picker">
                    <input type="hidden" name="supplier_id" required />
                    <input type="text" name="supplier_display" readonly placeholder="Clique para pesquisar o fornecedor" />
                    <button type="button" data-action="pick-supplier">🔎</button>
                  </div>
                </div>
  
                <div class="bapm-field">
                  <label>Nº Fatura Base</label>
                  <input type="text" name="invoice_number" placeholder="Ex.: NF 12345" />
                </div>
  
                <div class="bapm-field">
                  <label>Nº Documento Base</label>
                  <input type="text" name="document_number" placeholder="Ex.: Boleto 12345" />
                </div>
  
                <div class="bapm-field">
                  <label>Emissão *</label>
                  <input type="date" name="issue_date" value="${todayISO()}" required />
                </div>
  
                <div class="bapm-field">
                  <label>1º Vencimento *</label>
                  <input type="date" name="first_due_date" value="${todayISO()}" required />
                </div>
  
                <div class="bapm-field">
                  <label>Status *</label>
                  <select name="status" required>
                    <option value="PENDING" selected>Pendente</option>
                    <option value="PAID">Pago</option>
                    <option value="OVERDUE">Vencido</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>
              </div>
            </section>
  
            <section class="bapm-section">
              <h3>Parcelamento</h3>
  
              <div class="bapm-grid bapm-grid--finance">
                <div class="bapm-field">
                  <label>Valor Total *</label>
                  <input type="number" step="0.01" min="0" name="total_batch_value" placeholder="0,00" required />
                </div>
  
                <div class="bapm-field">
                  <label>Quantidade de Parcelas *</label>
                  <input type="number" min="1" max="250" name="installments" value="1" required />
                </div>
  
                <div class="bapm-field">
                  <label>Intervalo</label>
                  <select name="interval_type">
                    <option value="MONTHLY" selected>Mensal</option>
                    <option value="DAYS">A cada X dias</option>
                  </select>
                </div>
  
                <div class="bapm-field">
                  <label>Dias de intervalo</label>
                  <input type="number" min="1" name="interval_days" value="30" />
                </div>
  
                <div class="bapm-field">
                  <label>Conta de Caixa</label>
                  <select name="bank_account_id">
  <option value="">Selecione...</option>
</select>
                </div>
  
                <div class="bapm-field">
                  <label>Categoria (ID)</label>
                  <input type="number" name="category_id" />
                </div>
  
                <div class="bapm-field">
                  <label>Subcategoria (ID)</label>
                  <input type="number" name="subcategory_id" />
                </div>
              </div>
  
              <div class="bapm-summary">
                <span>Total do lote: <strong id="bapmTotalPreview">R$ 0,00</strong></span>
                <span>Valor por parcela: <strong id="bapmInstallmentPreview">R$ 0,00</strong></span>
              </div>
            </section>
  
            <section class="bapm-section">
              <h3>Detalhes</h3>
  
              <div class="bapm-grid bapm-grid--details">
                <div class="bapm-field">
                  <label>Descrição</label>
                  <textarea name="description" rows="3" placeholder="Descrição padrão das parcelas..."></textarea>
                </div>
  
                <div class="bapm-field">
                  <label>Observações</label>
                  <textarea name="notes" rows="3" placeholder="Observações internas..."></textarea>
                </div>
              </div>
            </section>
  
            <section class="bapm-section">
              <div class="bapm-section-head">
                <h3>Prévia das parcelas</h3>
                <button type="button" class="btn btn-toolbar btn-sm" data-action="preview">
                  Atualizar Prévia
                </button>
              </div>
  
              <div class="bapm-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Fatura</th>
                      <th>Documento</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody id="bapmPreviewBody"></tbody>
                </table>
              </div>
            </section>
  
            <footer class="bapm-footer">
              <span>As contas serão criadas como registros individuais.</span>
  
              <div>
                <button type="button" class="btn btn-flat" data-close>Cancelar</button>
                <button type="submit" class="btn btn-toolbar btn-sm">Gerar Lote</button>
              </div>
            </footer>
          </form>
        </div>
      </div>
    `;
  }

  function openBatchAccountsPayableModal({ onSubmit = null, onClose = null } = {}) {
    document.getElementById(MODAL_ID)?.remove();

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'bapm-root';
    root.innerHTML = buildModalHTML();

    document.body.appendChild(root);
    document.body.classList.add('bapm-body-lock');

    const form = qs('#bapmForm', root);
    const backdrop = qs('.bapm-backdrop', root);
    const supplierIdInput = qs('[name="supplier_id"]', root);
    const supplierDisplayInput = qs('[name="supplier_display"]', root);
    const previewBody = qs('#bapmPreviewBody', root);

    function close(reason = 'close') {
      document.body.classList.remove('bapm-body-lock');
      root.remove();

      if (typeof onClose === 'function') {
        onClose({ reason });
      }
    }

    async function pickSupplier() {
      const selected = await openSuppliersModalSearch();
      if (!selected) return;

      supplierIdInput.value = selected.supplier_id ?? selected.id ?? '';
      supplierDisplayInput.value = selected.name ?? selected.supplier_name ?? '';
    }

    function buildRows() {
      const total = toFloat(form.total_batch_value.value) ?? 0;
      const installments = toInt(form.installments.value) || 1;
      const firstDueDate = form.first_due_date.value;
      const intervalType = form.interval_type.value;
      const intervalDays = toInt(form.interval_days.value) || 30;

      const baseInvoice = form.invoice_number.value.trim();
      const baseDoc = form.document_number.value.trim();

      const installmentValue = Number((total / installments).toFixed(2));
      const rows = [];

      let accumulated = 0;

      for (let i = 1; i <= installments; i++) {
        let value = installmentValue;

        if (i === installments) {
          value = Number((total - accumulated).toFixed(2));
        }

        accumulated += value;

        let dueDate = firstDueDate;

        if (intervalType === 'MONTHLY') {
          dueDate = addMonthsISO(firstDueDate, i - 1);
        } else {
          const d = new Date(`${firstDueDate}T12:00:00`);
          d.setDate(d.getDate() + ((i - 1) * intervalDays));
          dueDate = d.toISOString().slice(0, 10);
        }

        rows.push({
          installment_number: i,
          invoice_number: baseInvoice ? `${baseInvoice}/${i}-${installments}` : null,
          document_number: baseDoc ? `${baseDoc}/${i}-${installments}` : null,
          due_date: dueDate,
          total_value: value,
        });
      }

      return rows;
    }

    function renderPreview() {
      const total = toFloat(form.total_batch_value.value) ?? 0;
      const installments = toInt(form.installments.value) || 1;
      const installmentValue = installments > 0 ? total / installments : 0;

      qs('#bapmTotalPreview', root).textContent = moneyBR(total);
      qs('#bapmInstallmentPreview', root).textContent = moneyBR(installmentValue);

      const rows = buildRows();

      previewBody.innerHTML = rows.map((r) => `
        <tr>
          <td>${r.installment_number}</td>
          <td>${r.invoice_number ?? ''}</td>
          <td>${r.document_number ?? ''}</td>
          <td>${r.due_date}</td>
          <td>${moneyBR(r.total_value)}</td>
        </tr>
      `).join('');
    }

    async function submit(ev) {
      ev.preventDefault();

      const supplierId = toInt(form.supplier_id.value);
      const issueDate = form.issue_date.value;
      const firstDueDate = form.first_due_date.value;
      const total = toFloat(form.total_batch_value.value);
      const installments = toInt(form.installments.value);

      if (!supplierId) return alert('Informe o fornecedor.');
      if (!issueDate) return alert('Informe a data de emissão.');
      if (!firstDueDate) return alert('Informe o primeiro vencimento.');
      if (!total || total <= 0) return alert('Informe o valor total do lote.');
      if (!installments || installments <= 0) return alert('Informe a quantidade de parcelas.');

      const rows = buildRows();

      const payloads = rows.map((row) => ({
        supplier_id: supplierId,
        invoice_number: row.invoice_number,
        issue_date: issueDate,
        due_date: row.due_date,
        payment_date: null,
        bank_account_id: toInt(form.bank_account_id.value),
        category_id: toInt(form.category_id.value),
        subcategory_id: toInt(form.subcategory_id.value),
        document_number: row.document_number,
        total_value: row.total_value,
        amount_paid: 0,
        status: form.status.value || 'PENDING',
        description: form.description.value.trim() || null,
        notes: form.notes.value.trim() || null,
        attachment_url: null,
      }));

      if (typeof onSubmit === 'function') {
        await onSubmit({
          payloads,
          close,
          form,
          root,
        });
      }
    }

    root.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-close]')) {
        close('cancel');
        return;
      }

      if (ev.target === backdrop) {
        close('backdrop');
        return;
      }

      if (ev.target.closest('[data-action="pick-supplier"]') || ev.target === supplierDisplayInput) {
        ev.preventDefault();
        pickSupplier();
        return;
      }

      if (ev.target.closest('[data-action="preview"]')) {
        ev.preventDefault();
        renderPreview();
      }
    });

    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', esc);
        close('escape');
      }
    });

    form.addEventListener('submit', submit);

    [
      'total_batch_value',
      'installments',
      'first_due_date',
      'interval_type',
      'interval_days',
      'invoice_number',
      'document_number',
    ].forEach((name) => {
      qs(`[name="${name}"]`, root)?.addEventListener('input', renderPreview);
      qs(`[name="${name}"]`, root)?.addEventListener('change', renderPreview);
    });

    populateBankAccountSelect(
      qs('[name="bank_account_id"]', root),
      null,
    ).catch(() => { });

    renderPreview();

    setTimeout(() => supplierDisplayInput?.focus(), 30);

    return {
      root,
      form,
      close,
    };
  }

  return { openBatchAccountsPayableModal };
})();

const { openBatchAccountsPayableModal } = batchAccountsPayableModalModule;

/* ==========================================================================
 * Coordenação dos modais do módulo
 * ========================================================================== */

export async function loadCashDocumentTypes(selectedId = null) {
  const select = qs('#pay_document_type_id');
  if (!select) return;
  const current = selectedId != null ? String(selectedId) : select.value;
  select.disabled = true;
  select.innerHTML = '<option value="">Carregando...</option>';
  try {
    const rows = await api.listDocumentTypes();
    select.innerHTML = '<option value="">Selecione...</option>';
    rows.filter((item) => item.is_active !== false)
      .forEach((item) => select.add(new Option(item.name || '', String(item.id))));
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  } catch (error) {
    console.error('[accountsPayable] tipos de documento:', error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  } finally {
    select.disabled = false;
  }
}

export function openDocumentTypesModal() {
  openCashDocumentTypesModal({ onChange: () => loadCashDocumentTypes() });
}

export function openAccountForm(record, onSaved) {
  const editing = Boolean(record?.id);
  openNewAccountsPayableModal({
    mode: editing ? 'edit' : 'create',
    data: record || {},
    onSubmit: async ({ mode, id, payload, selectedFile, close }) => {
      const response = mode === 'edit' && id
        ? await api.updateAccount(id, payload)
        : await api.createAccount(payload);
      const saved = response.data || response.item || response.row || response.account || response;
      const savedId = toInt(saved?.id) || toInt(id);
      if (!savedId) throw new Error('Conta salva, mas o ID retornado é inválido.');
      if (selectedFile) await api.uploadAttachment(savedId, selectedFile);
      close('submit');
      await onSaved();
    },
  });
}

export function openBatchForm(onSaved) {
  openBatchAccountsPayableModal({
    onSubmit: async ({ payloads, close }) => {
      if (!payloads.length) return alert('Nenhuma parcela gerada.');
      if (!confirm(`Deseja gerar ${payloads.length} contas a pagar?`)) return;
      for (const payload of payloads) await api.createAccount(payload);
      close('submit');
      await onSaved();
      alert('Lote gerado com sucesso.');
    },
  });
}

export async function openPayModal(record) {
  const modal = qs('#payModal');
  if (!modal) return;
  modal.hidden = false;
  modal.classList.add('is-open');
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  await populateBankAccountSelect(
    qs('#pay_conta_caixa'),
    record.bank_account_id ?? record.cash_account_id ?? null,
  ).catch(() => { });
  await loadCashDocumentTypes(record.document_type_id ?? record.cash_document_type_id);
  qs('#pay_account_id').value = record.id;
  qs('#pay_fornecedor').value = record.supplier_name || `Fornecedor #${record.supplier_id || ''}`;
  qs('#pay_documento').value =
    record.nfe_number || record.numero_nfe || record.invoice_number || record.document_number || '';
  qs('#pay_vencimento').value = toInputDate(record.due_date);
  qs('#pay_data_hora').value = localDateTimeValue();
  qs('#pay_valor_original').value =
    Number(record.balance ?? record.total_value ?? 0).toFixed(2);
  setPayChartAccount({
    id: record.chart_account_id,
    code: record.chart_account_code,
    description: record.chart_account_description,
  });

  if (record.supplier_id) {
    try {
      const supplier = await api.getSupplier(record.supplier_id);
      setPayChartAccount({
        id: record.chart_account_id ?? supplier?.chart_account_id,
        code: record.chart_account_code ?? supplier?.chart_account_code,
        description: record.chart_account_description ?? supplier?.chart_account_description,
      });
      await setPayCashClassification({
        categoryId: record.cash_category_id ?? record.category_id ?? supplier?.cash_category_id,
        subcategoryId: record.cash_subcategory_id ?? record.subcategory_id ?? supplier?.cash_subcategory_id,
      });
    } catch (error) {
      console.error('[accountsPayable] classificação financeira padrão do fornecedor:', error);
    }
  } else {
    await setPayCashClassification({
      categoryId: record.cash_category_id ?? record.category_id,
      subcategoryId: record.cash_subcategory_id ?? record.subcategory_id,
    });
  }
  const input = qs('#pay_anexoFile');
  const progress = qs('#pay_anexoProgress');
  if (input) input.value = '';
  state.payDroppedFile = null;
  qs('#pay_dropzone')?.resetPayAttachment?.();
  if (progress) { progress.value = 0; progress.style.display = 'none'; }
  if (qs('#pay_observacao')) qs('#pay_observacao').value = '';
  try { renderAttachments(await api.listAttachments(record.id)); }
  catch (error) { console.error('[accountsPayable] anexos:', error); renderAttachments([]); }
}

export function setPayChartAccount(account = {}) {
  const idInput = qs('#pay_chart_account_id');
  const displayInput = qs('#pay_chart_account_display');
  const id = account?.id ?? account?.chart_account_id ?? null;
  const code = account?.code ?? account?.chart_account_code ?? '';
  const description = account?.description ?? account?.chart_account_description ?? '';
  if (idInput) idInput.value = id ? String(id) : '';
  if (displayInput) {
    displayInput.value = id
      ? [code, description].filter(Boolean).join(' - ') || `Conta #${id}`
      : '';
  }
}

export async function searchPayChartAccount() {
  const selected = await openChartAccountsModalSearch({
    query: qs('#pay_chart_account_display')?.value || '',
    onlyPosting: true,
    onlyActive: true,
  });
  if (selected) setPayChartAccount(selected);
}

export function clearPayChartAccount() {
  setPayChartAccount(null);
}

export async function setPayCashClassification({ categoryId = null, subcategoryId = null } = {}) {
  const categorySelect = qs('#pay_categoria');
  const subcategorySelect = qs('#pay_subcategoria');
  if (!categorySelect || !subcategorySelect) return;

  categorySelect.value = categoryId ? String(categoryId) : '';
  subcategorySelect.replaceChildren(new Option('(opcional)', ''));

  if (!categoryId) return;

  let rows = state.cashSubcategoriesByCategory[String(categoryId)];
  if (!Array.isArray(rows)) {
    rows = await api.listCashSubcategories(categoryId);
    state.cashSubcategoriesByCategory[String(categoryId)] = rows;
  }

  rows
    .filter((item) => item.is_active !== false)
    .forEach((item) => {
      subcategorySelect.add(new Option(item.nome, String(item.id)));
    });

  subcategorySelect.value = subcategoryId ? String(subcategoryId) : '';
}

export function closePayModal() {
  const modal = document.getElementById('payModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;
}
