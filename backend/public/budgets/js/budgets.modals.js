// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.modals.js — Modais locais                           ║
// ║ ✅ Modal de observação                                      ║
// ║ ✅ Modal de prévia da Nota Fiscal                           ║
// ╚══════════════════════════════════════════════════════════════╝

import { state } from './budgets.core.js';
import { Modal } from '/public/includes/js/modal.js';

export function setupObsModal() {
  const obsInput = document.getElementById('obs');
  const btnOpen = document.getElementById('btnObsModal');
  const preview = document.getElementById('obsPreview');
  const modal = document.getElementById('obsModal');
  const txt = document.getElementById('obsModalText');
  const btnSave = document.getElementById('btnObsSave');

  if (!obsInput || !btnOpen || !modal || !txt || !btnSave) {
    return;
  }

  /*
   * Prevents duplicated event listeners.
   */
  if (modal.dataset.bound === '1') {
    return;
  }

  modal.dataset.bound = '1';

  // modal.js cuida do X, Cancelar, backdrop e ESC (data-modal-close)
  Modal.setup();

  const open = () => {
    txt.value = obsInput.value || '';
    Modal.open(modal, { focusSelector: '#obsModalText' });
  };

  const applyPreview = () => {
    const value = (obsInput.value || '').trim();

    if (!preview) {
      return;
    }

    preview.textContent = value
      ? value.replace(/\s+/g, ' ')
      : 'Sem observação';
  };

  btnOpen.addEventListener('click', open);

  btnSave.addEventListener('click', () => {
    obsInput.value = (txt.value || '').trim();

    obsInput.dispatchEvent(new Event('input', { bubbles: true }));
    obsInput.dispatchEvent(new Event('change', { bubbles: true }));

    applyPreview();
    Modal.close(modal);
  });

  obsInput.addEventListener('input', applyPreview);

  applyPreview();
}

/* =========================================================
   Modal de prévia da Nota Fiscal
========================================================= */

export function setupInvoicePreviewModal() {
  const openButton =
    document.getElementById(
      'btnGenerateInvoice'
    );

  const modal =
    document.getElementById(
      'invoicePreviewModal'
    );

  const backdrop =
    document.getElementById(
      'invoicePreviewBackdrop'
    );

  const closeButton =
    document.getElementById(
      'btnCloseInvoicePreview'
    );

  const cancelButton =
    document.getElementById(
      'btnCancelInvoicePreview'
    );

  if (
    !openButton ||
    !modal ||
    !backdrop ||
    !closeButton ||
    !cancelButton
  ) {
    console.warn(
      '[budgets] Elementos do modal de NF-e não encontrados.'
    );

    return;
  }

  /*
   * Prevents duplicated event listeners.
   */
  if (modal.dataset.bound === '1') {
    return;
  }

  modal.dataset.bound = '1';

  function setTextContent(
    elementId,
    value,
    fallback = '—'
  ) {
    const element =
      document.getElementById(elementId);

    if (!element) {
      return;
    }

    const normalizedValue =
      String(value ?? '').trim();

    element.textContent =
      normalizedValue || fallback;
  }

  function getFieldValue(elementId) {
    return (
      document.getElementById(elementId)
        ?.value || ''
    ).trim();
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatMoney(value) {
    return toNumber(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function createCell(value, missingText = '') {
    const cell = document.createElement('td');
    const text = String(value ?? '').trim();
    cell.textContent = text || missingText || '—';
    if (!text && missingText) cell.classList.add('invoice-field-missing');
    return cell;
  }

  function renderItems(items) {
    const tbody = document.getElementById('invoiceItemsPreviewBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 10;
      cell.textContent = 'Nenhum item informado no orçamento.';
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    items.forEach((item) => {
      const quantity = toNumber(item?.quantity);
      const unitPrice = toNumber(item?.unit_price);
      const discount = toNumber(item?.discount_value);
      const total = Math.max(0, quantity * unitPrice - discount);
      const row = document.createElement('tr');

      row.appendChild(createCell(item?.sku));
      row.appendChild(createCell(item?.description));
      row.appendChild(createCell(
        item?.ncm ?? item?.ncm_code ?? item?.fiscal?.ncm,
        '⚠ Não informado'
      ));
      row.appendChild(createCell(
        item?.cest ?? item?.cest_code ?? item?.fiscal?.cest
      ));
      row.appendChild(createCell(
        item?.unit ?? item?.unit_display ?? item?.unidade ?? 'UN'
      ));
      row.appendChild(createCell(quantity.toLocaleString('pt-BR', {
        maximumFractionDigits: 3,
      })));
      row.appendChild(createCell(formatMoney(unitPrice)));
      row.appendChild(createCell(formatMoney(discount)));
      row.appendChild(createCell(formatMoney(total)));
      row.appendChild(createCell(
        item?.fiscal_profile ?? item?.fiscal_profile_name ??
        item?.classification_name ?? item?.fiscal?.name,
        '⚠ Não informado'
      ));
      tbody.appendChild(row);
    });
  }

  function renderPayments(payments, installments) {
    const container = document.getElementById('invoicePaymentsPreview');
    if (!container) return;
    container.innerHTML = '';

    if (!payments.length && !installments.length) {
      container.textContent = 'Nenhuma forma de pagamento informada.';
      return;
    }

    payments.forEach((payment, index) => {
      const line = document.createElement('div');
      const name = payment?.name ?? payment?.payment_method_name ??
        payment?.method_name ?? payment?.description ?? `Pagamento ${index + 1}`;
      const value = payment?.amount ?? payment?.value ?? payment?.payment_value ?? 0;
      line.textContent = `${name} — ${formatMoney(value)}`;
      container.appendChild(line);
    });

    installments.forEach((installment, index) => {
      const line = document.createElement('div');
      const dueDate = installment?.due_date ?? installment?.date ??
        installment?.vencimento ?? 'Sem vencimento';
      const value = installment?.amount ?? installment?.value ?? 0;
      line.textContent = `Parcela ${String(index + 1).padStart(3, '0')} — ${dueDate} — ${formatMoney(value)}`;
      container.appendChild(line);
    });
  }

  function updatePreview() {
    const editing = state.editing || {};
    const header = editing.header || {};
    const items = Array.isArray(editing.items) ? editing.items : [];
    const payments = Array.isArray(editing.payments) ? editing.payments : [];
    const installments = Array.isArray(editing.installments) ? editing.installments : [];
    const documentNumber = header.budget_id ?? header.id ??
      getFieldValue('numero') ?? 'Novo';

    setTextContent('invoicePreviewTitle',
      `Prévia da Nota Fiscal — Orçamento #${documentNumber || 'Novo'}`);
    setTextContent('invoiceCustomerName',
      header.customer_name ?? header.trade_name ?? getFieldValue('cliNome'));
    setTextContent('invoiceCustomerTaxId',
      header.customer_tax_id ?? header.cnpj_cpf ?? getFieldValue('cliDoc'));
    setTextContent('invoiceCustomerStateRegistration', header.state_registration);
    setTextContent('invoiceCustomerAddress', [
      header.street_name,
      header.street_number,
      header.neighborhood,
    ].filter(Boolean).join(', '));
    setTextContent('invoiceCustomerCityState', [header.city, header.state]
      .filter(Boolean).join(' / '));
    setTextContent('invoiceCustomerIbge', header.ibge_code ?? header.city_ibge_code);
    setTextContent('invoiceCustomerPostalCode', header.postal_code);
    setTextContent('invoiceCustomerContact', [
      header.phone ?? getFieldValue('cliTel'),
      header.email ?? getFieldValue('cliEmail'),
    ].filter(Boolean).join(' | '));
    setTextContent('invoiceAdditionalInformation',
      header.notes ?? getFieldValue('obs'), 'Sem informações complementares.');

    renderItems(items);
    renderPayments(payments, installments);

    const subtotal = items.reduce((sum, item) =>
      sum + toNumber(item?.quantity) * toNumber(item?.unit_price), 0);
    const discounts = items.reduce((sum, item) =>
      sum + toNumber(item?.discount_value), 0);
    const freight = toNumber(header.freight_value ?? header.freight ?? getFieldValue('frete'));
    const total = Math.max(0, subtotal - discounts + freight);

    setTextContent('invoicePreviewSubtotal', formatMoney(subtotal));
    setTextContent('invoicePreviewDiscount', formatMoney(discounts));
    setTextContent('invoicePreviewFreight', formatMoney(freight));
    setTextContent('invoicePreviewTotal', formatMoney(total));
  }

  function openModal() {
    updatePreview();

    modal.classList.remove('hidden');
    backdrop.classList.remove('hidden');

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    backdrop.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    setTimeout(
      () => closeButton.focus(),
      0
    );
  }

  function closeModal() {
    modal.classList.add('hidden');
    backdrop.classList.add('hidden');

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    backdrop.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow = '';

    setTimeout(
      () => openButton.focus(),
      0
    );
  }

  openButton.addEventListener(
    'click',
    openModal
  );

  closeButton.addEventListener(
    'click',
    closeModal
  );

  cancelButton.addEventListener(
    'click',
    closeModal
  );

  backdrop.addEventListener(
    'click',
    closeModal
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key === 'Escape' &&
        !modal.classList.contains('hidden')
      ) {
        closeModal();
      }
    }
  );
}
