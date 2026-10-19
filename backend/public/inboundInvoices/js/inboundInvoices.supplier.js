/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.supplier.js — Cadastro rápido de fornecedor      ║
   ║ PRODNEX ERP | Frontend (ESM)                                     ║
   ║                                                                  ║
   ║ O markup de #supplierModal já existia no HTML, mas nenhum        ║
   ║ módulo o controlava. Este arquivo liga o modal e devolve o       ║
   ║ fornecedor criado para quem o abriu (importação de XML/DF-e).    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatTaxId(value) {
  const digits = onlyDigits(value);

  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }

  if (digits.length === 11) {
    return digits.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      '$1.$2.$3-$4'
    );
  }

  return String(value || '');
}

export function initQuickSupplier({ core, ROUTES, state, refs }) {
  const {
    supplierModal: modal,
    supplierForm: form,
    supplierTaxId: fldTaxId,
    supplierName: fldName,
    supplierFantasy: fldFantasy,
    supplierEmail: fldEmail,
    supplierPhone: fldPhone,
    supplierBackdrop: backdrop,
    supplierClose: btnClose,
    supplierCancel: btnCancel,
    supplierSave: btnSave,
    supplierWarning: warning,
    btnOpenSupplierModal: btnOpenWarning,
  } = refs;

  if (!modal || !form) {
    console.warn('[INBOUND][SUPPLIER] Modal de fornecedor ausente no HTML.');
    return;
  }

  // Quem abriu o modal fica esperando o resultado.
  let pendingResolve = null;

  function settle(result) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve?.(result);
  }

  // modals.css controla a visibilidade por .is-open.
  function closeModal(result = { ok: false }) {
    modal.classList.remove('is-open');

    const editorOpen = document.querySelector('#tab-form')?.hidden === false;
    if (!editorOpen) document.body.classList.remove('inbound-modal-open');

    settle(result);
  }

  /**
   * Abre o cadastro rápido e resolve com { ok, supplier }.
   *
   * @param {{preset?: {tax_id?: string, name?: string}}} options
   * @returns {Promise<{ok: boolean, supplier?: object}>}
   */
  function openQuickSupplierModal({ preset = {} } = {}) {
    // Se já havia alguém esperando, encerra a espera anterior.
    settle({ ok: false });

    form.reset();

    if (fldTaxId) fldTaxId.value = formatTaxId(preset.tax_id || '');
    if (fldName) fldName.value = preset.name || '';

    modal.classList.add('is-open');
    document.body.classList.add('inbound-modal-open');

    // Com o CNPJ já preenchido pelo XML, o foco útil é a razão social.
    (fldName?.value ? fldFantasy : fldName)?.focus();

    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  async function submitSupplier(event) {
    event?.preventDefault();

    const taxId = onlyDigits(fldTaxId?.value);
    const name = String(fldName?.value || '').trim();

    if (taxId.length !== 11 && taxId.length !== 14) {
      core?.toast?.error?.(
        'CNPJ/CPF inválido',
        'Informe 11 dígitos para CPF ou 14 para CNPJ.'
      );
      fldTaxId?.focus();
      return;
    }

    if (!name) {
      core?.toast?.error?.(
        'Razão social obrigatória',
        'Informe o nome do fornecedor.'
      );
      fldName?.focus();
      return;
    }

    const payload = {
      tax_id: taxId,
      name,
      fantasy_name: String(fldFantasy?.value || '').trim() || null,
      email: String(fldEmail?.value || '').trim() || null,
      phone: String(fldPhone?.value || '').trim() || null,
    };

    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = 'Salvando…';
    }

    try {
      const response = await fetch(ROUTES.suppliers(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || json?.ok === false || json?.success === false) {
        throw new Error(
          json?.message || json?.error || `Erro HTTP ${response.status}.`
        );
      }

      // Confirma pela busca: garante que o backend indexou o tax_id
      // exatamente como a importação vai procurá-lo depois.
      let supplier =
        json?.data?.supplier ||
        json?.supplier ||
        json?.data ||
        null;

      try {
        const check = await fetch(ROUTES.suppliersSearch(taxId));
        const checkJson = await check.json().catch(() => ({}));
        const found = checkJson?.data?.rows?.[0];
        if (found) supplier = found;
      } catch {
        // busca de confirmação é best-effort
      }

      core?.toast?.success?.(
        'Fornecedor cadastrado',
        `${name} foi incluído no cadastro.`
      );

      hideSupplierWarning();
      closeModal({ ok: true, supplier });
    } catch (error) {
      console.error('[INBOUND][SUPPLIER][SAVE]', error);

      core?.toast?.error?.(
        'Erro ao cadastrar fornecedor',
        error?.message || 'Não foi possível salvar o fornecedor.'
      );
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = 'Salvar Fornecedor';
      }
    }
  }

  function showSupplierWarning(preset = {}) {
    if (!warning) return;

    warning.style.display = '';
    warning.dataset.taxId = onlyDigits(preset.tax_id || '');
    warning.dataset.name = preset.name || '';
  }

  function hideSupplierWarning() {
    if (!warning) return;

    warning.style.display = 'none';
    delete warning.dataset.taxId;
    delete warning.dataset.name;
  }

  form.addEventListener('submit', submitSupplier);
  btnClose?.addEventListener('click', () => closeModal());
  btnCancel?.addEventListener('click', () => closeModal());

  // .modal__dialog tem pointer-events: none, então o clique fora do
  // painel chega ao backdrop.
  backdrop?.addEventListener('click', () => closeModal());

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Botão do aviso amarelo dentro do formulário da nota.
  btnOpenWarning?.addEventListener('click', () => {
    void openQuickSupplierModal({
      preset: {
        tax_id: warning?.dataset.taxId || refs.fldIssuer?.value || '',
        name: warning?.dataset.name || '',
      },
    });
  });

  hideSupplierWarning();

  state.actions.openQuickSupplierModal = openQuickSupplierModal;
  state.actions.showSupplierWarning = showSupplierWarning;
  state.actions.hideSupplierWarning = hideSupplierWarning;
}
