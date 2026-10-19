/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.actions.js — Ações, abas e importação XML               ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ║ ✅ Preserva nf_product_code do XML                              ║
   ║ ✅ Usa product_code/product_id resolvidos pelo backend           ║
   ║ ✅ Diagnóstico completo de productsLmRef                         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { clearLotsCaches } from './inboundInvoices.api.js';

function getPanels() {
  return {
    list: document.querySelector('#tab-list'),
    form: document.querySelector('#tab-form'),
  };
}

function activatePanel(key) {
  const panels = getPanels();

  // The list remains visible behind the editor. The form is a modal layer.
  if (panels.list) {
    panels.list.hidden = false;
    panels.list.classList.add('ativa');
  }

  const formActive = key === 'form';
  if (panels.form) {
    panels.form.toggleAttribute('hidden', !formActive);
    panels.form.classList.toggle('ativa', formActive);
  }

  document.body.classList.toggle('inbound-modal-open', formActive);

  document.querySelectorAll('.tabs .tab[data-tab]').forEach((button) => {
    button.classList.toggle('ativa', button.dataset.tab === key);
  });
}

export function initTabs({ core } = {}) {
  const tabs = core?.qsa
    ? core.qsa('.tabs .tab[data-tab]')
    : [...document.querySelectorAll('.tabs .tab[data-tab]')];

  tabs.forEach((button) => {
    button.addEventListener('click', () => activatePanel(button.dataset.tab));
  });

  const form = document.querySelector('#tab-form');
  const list = document.querySelector('#tab-list');

  if (form?.hidden || !form?.classList.contains('ativa')) activatePanel('list');
  else if (list && !list.hidden) activatePanel('list');
}

export function switchTab(key) {
  if (!['list', 'form'].includes(key)) {
    console.warn('[INBOUND][TABS] Aba inválida:', key);
    return;
  }
  activatePanel(key);
}

export function initImportXml({ core, ROUTES, state, refs, switchTab }) {
  const API_INBOUND = ROUTES.inboundBase();

  /**
   * Garante que o emitente do XML existe em suppliers.
   *
   * Quando não existe, abre o cadastro rápido (#supplierModal) na hora,
   * com CNPJ e razão social já preenchidos pelo XML. Só retorna ok após
   * o fornecedor ser realmente gravado.
   */
  async function ensureSupplierExists(taxIdFromXml, supplierNameFromXml) {
    try {
      const url = ROUTES.suppliersSearch(taxIdFromXml);
      const res = await fetch(url);
      const js = await res.json().catch(() => ({}));
      const list = js?.data?.rows || [];

      if (list.length > 0) {
        state.actions.hideSupplierWarning?.();
        return { ok: true, supplier: list[0] };
      }
    } catch (err) {
      console.warn('[INBOUND] Falha ao buscar fornecedor:', err);
    }

    const preset = {
      tax_id: taxIdFromXml,
      name: supplierNameFromXml || '',
    };

    if (typeof state.actions.openQuickSupplierModal !== 'function') {
      state.actions.showSupplierWarning?.(preset);
      return { ok: false };
    }

    const result = await state.actions.openQuickSupplierModal({ preset });

    if (!result?.ok) {
      // Mantém o aviso no formulário para o usuário tentar de novo.
      state.actions.showSupplierWarning?.(preset);
    }

    return result || { ok: false };
  }

  function preencherFormularioFromXml(d) {
    if (!d) return;

    if (refs.fldKey) refs.fldKey.value = d.accessKey ?? refs.fldKey.value;
    if (refs.fldNum) refs.fldNum.value = d.invoiceNumber ?? refs.fldNum.value;
    if (refs.fldSeries) refs.fldSeries.value = d.series ?? refs.fldSeries.value;
    if (refs.fldIssuer) refs.fldIssuer.value = d.issuerCnpj ?? refs.fldIssuer.value;
    if (refs.fldRec) refs.fldRec.value = d.recipientCnpj ?? refs.fldRec.value;
    // datas do XML (dhEmi / dhSaiEnt): sem elas o Salvar gravava a nota com data de emissão vazia
    if (refs.fldIssueDate && d.issueDate) refs.fldIssueDate.value = String(d.issueDate).slice(0, 10);
    if (refs.fldEntryDate && d.entryDate) refs.fldEntryDate.value = String(d.entryDate).slice(0, 10);

    if (refs.fldTotal && d.totalAmount != null) {
      refs.fldTotal.value = Number(d.totalAmount).toFixed(2);
    }
  }

  function forceOpenFormTab() {
    switchTab?.('form');
  }

  /**
   * Pipeline único de importação de XML.
   * Usado pelo botão de arquivo e pela importação vinda do DF-e.
   *
   * @param {File|Blob} file XML da NF-e.
   */
  async function processXmlFile(file) {
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('xml', file);

        const resp = await fetch(`${API_INBOUND}/import-xml`, {
          method: 'POST',
          body: formData,
        });

        const json = await resp.json().catch(() => null);

        console.log('[INBOUND][IMPORT_XML][RAW_HTTP_RESPONSE]', json);
        console.table(
          (json?.data?.items || []).map((it) => ({
            nf_product_code: it.nf_product_code,
            product_code: it.product_code,
            product_id: it.product_id,
            product_stock_id: it.product_stock_id ?? null,
            product_lm_ref_id: it.product_lm_ref_id,
            lm_ref_found: it.lm_ref_found,
            lm_ref_status: it.lm_ref_status,
          }))
        );

        if (!resp.ok || !json?.ok) {
          return core.toast.error(
            'Erro ao importar',
            json?.error || json?.detail || 'Falha ao interpretar XML.'
          );
        }

        const supplierTaxId = json.data?.issuerCnpj;
        const supplierName = json.data?.issuerName;

        if (!supplierTaxId) {
          return core.toast.error('XML inválido', 'Fornecedor não identificado.');
        }

        const check = await ensureSupplierExists(supplierTaxId, supplierName);

        if (!check.ok) {
          return core.toast.warn(
            'Importação cancelada',
            'Cadastre o fornecedor para continuar.'
          );
        }

        // Every XML import must start as a new invoice. Without this reset,
        // the hidden invoiceId from the previous import causes a PUT against
        // the invoice that was already finalized.
        await state.actions.resetFormState?.();

        clearLotsCaches(state);
        preencherFormularioFromXml(json.data);

        state.currentItems = (json.data?.items || []).map((it) => ({
          ...it,

          // Sempre mantém o código original do fornecedor/XML.
          nf_product_code: it.nf_product_code ?? null,

          // Sempre usa o código interno devolvido pelo backend.
          // Nunca faz fallback para nf_product_code.
          product_code: it.product_code ?? null,
          product_description: it.product_description ?? null,
          product_id: it.product_id ?? null,
          product_stock_id: it.product_stock_id ?? null,
          product_lm_ref_id: it.product_lm_ref_id ?? null,
          barcode_id: it.barcode_id ?? null,
          barcode_unit: it.barcode_unit ?? null,
          xml_unit: it.xml_unit ?? it.unit ?? null,
          unit: it.barcode_unit ?? it.unit ?? null,
          conversion_factor: Number(it.conversion_factor) || 1,
          lm_ref_found: it.lm_ref_found === true,
          lm_ref_status: it.lm_ref_status ?? null,

          product_grade_id: it.product_grade_id ?? null,
          lot_id: it.lot_id ?? null,
          _lots: [],
          _grades: [],
        }));

        console.log('[INBOUND][IMPORT_XML][STATE_AFTER_MAP]', state.currentItems);
        console.table(
          state.currentItems.map((it) => ({
            nf_product_code: it.nf_product_code,
            product_code: it.product_code,
            product_id: it.product_id,
            product_stock_id: it.product_stock_id,
            product_lm_ref_id: it.product_lm_ref_id,
            lm_ref_found: it.lm_ref_found,
            lm_ref_status: it.lm_ref_status,
          }))
        );

        await state.actions.renderItemsTable?.(state.currentItems);

        state.currentInstallments = json.data?.installments || [];
        state.actions.renderInstallmentsTable?.(state.currentInstallments);

        forceOpenFormTab();

        const mapping = json.data?.productMapping || {};
        const mapped = Number(mapping.mapped || 0);
        const unmapped = Number(mapping.unmapped || 0);

        core.toast.success(
          'XML importado',
          unmapped === 0
            ? `${mapped} produto(s) vinculado(s) automaticamente.`
            : `${mapped} produto(s) vinculado(s). ${unmapped} item(ns) precisam de vínculo.`
        );

        if (unmapped > 0) {
          core.toast.warn(
            'Produtos sem vínculo',
            `${unmapped} item(ns) da NF-e ainda não possuem vínculo em productsLmRef.`
          );
        }
      } catch (err) {
        console.error('Erro inesperado ao importar XML:', err);

        core.toast.error(
          'Erro inesperado',
          err?.message || 'Falha inesperada ao importar XML.'
        );
      } finally {
        if (refs.xmlFileInput) refs.xmlFileInput.value = '';
      }
  }

  if (refs.btnImportXml && refs.xmlFileInput) {
    refs.btnImportXml.onclick = () => refs.xmlFileInput.click();

    refs.xmlFileInput.onchange = (ev) => {
      const file = ev.target.files?.[0];
      if (file) void processXmlFile(file);
    };
  }

  state.actions.ensureSupplierExists = ensureSupplierExists;

  // Exposto para o modal "Importar do DF-e" reaproveitar o mesmo fluxo.
  state.actions.importXmlFile = processXmlFile;
}
