// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modal.newCard.js                                              ║
// ║ MODULE: CRM Deals (PRODNEX ERP)                                     ║
// ║ DESCRIPTION: Modal de Novo Card + Edição de Card                    ║
// ║                                                                      ║
// ║ ✅ Suporta CREATE e EDIT no mesmo modal                              ║
// ║ ✅ Inclui lead_source_id                                             ║
// ║ ✅ Evita duplicação de listeners                                     ║
// ║ ✅ Usa apiCreateDeal / apiUpdateDeal padronizados                    ║
// ║ ✅ Preenche vendedor automaticamente conforme usuário/filtro         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './dom.js';
import { Modal } from '/public/includes/js/modal.js';
import { state } from './state.js';
import { apiCreateDeal, apiUpdateDeal } from './api.js';
import { renderDeals } from './render.deals.js';
import { loadDeals, loadOutcomesSummary } from './loaders.js';
import { API_ORIGIN, apiBase } from './config.js';

import {
  openCrmCustomerSearchModal,
  openCrmSellerSearchModal
} from '/public/modalsSearch/crmConsartModalsSearch.js';

/* --------------------------------------------------------------------- */
/* Estado interno                                                        */
/* --------------------------------------------------------------------- */

let MODAL_MODE = 'create';
let EDIT_DEAL_ID = null;
let IS_SAVING = false;

/* --------------------------------------------------------------------- */
/* apiBase dos modais globais                                            */
/* --------------------------------------------------------------------- */

function apiBaseForGlobalModals() {
  const origin = String(API_ORIGIN || '').trim();
  if (origin) return origin.replace(/\/$/, '');

  const base = String(apiBase || '').trim();
  return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function parseMoneyToNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumberForInputBR(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(2).replace('.', ',');
}

function getDealIdFromAny(deal) {
  const id =
    deal?.id ??
    deal?.deal_id ??
    deal?.dealId ??
    deal?.dealID ??
    deal?.crm_deal_id ??
    null;

  return id != null ? String(id) : null;
}

function getCustomerIdFromAny(customer) {
  const id =
    customer?.customer_id ??
    customer?.customerId ??
    customer?.id ??
    customer?.customerID ??
    null;

  return id != null ? String(id) : '';
}

function getSellerIdFromAny(seller) {
  const id =
    seller?.seller_id ??
    seller?.sellerId ??
    seller?.id ??
    seller?.sellerID ??
    null;

  return id != null ? String(id) : '';
}

function getCustomerNameFromAny(source) {
  return String(
    source?.trade_name ||
    source?.nome_fantasia ||
    source?.razao_social ||
    source?.legal_name ||
    source?.customer_name ||
    source?.name ||
    ''
  ).trim();
}

function getSellerLabelFromAny(source) {
  const name =
    source?.name ||
    source?.nome ||
    source?.seller_name ||
    source?.sellerName ||
    '';

  const nick =
    source?.nickname ||
    source?.apelido ||
    source?.seller_nickname ||
    source?.sellerNickname ||
    '';

  if (name && nick) return `${String(name).trim()} (${String(nick).trim()})`;
  if (name) return String(name).trim();
  if (nick) return String(nick).trim();
  return '';
}

function resolveSellerLabelById(sellerId) {
  if (sellerId == null) return '';

  const seller = (state.sellers || []).find((item) => {
    const id = item?.id ?? item?.seller_id ?? item?.sellerId;
    return String(id) === String(sellerId);
  });

  return seller ? getSellerLabelFromAny(seller) : '';
}

function findSellerById(sellerId) {
  if (sellerId == null || sellerId === '') return null;

  return (
    (state.sellers || []).find((item) => {
      const id = item?.id ?? item?.seller_id ?? item?.sellerId;
      return String(id) === String(sellerId);
    }) || null
  );
}

function getAvailableSellers() {
  return Array.isArray(state.sellers) ? state.sellers : [];
}

function resolveDefaultSellerForModal() {
  const currentSeller =
    state?.currentSeller != null ? String(state.currentSeller).trim() : '';

  if (currentSeller && currentSeller !== 'all') {
    const seller = findSellerById(currentSeller);

    if (seller) {
      return {
        sellerId: String(seller.id ?? seller.seller_id ?? seller.sellerId ?? ''),
        label: getSellerLabelFromAny(seller),
        locked: true,
        source: 'currentSeller',
      };
    }

    return {
      sellerId: currentSeller,
      label: resolveSellerLabelById(currentSeller),
      locked: true,
      source: 'currentSeller-fallback',
    };
  }

  const sellers = getAvailableSellers();

  if (sellers.length === 1) {
    const only = sellers[0];
    return {
      sellerId: String(only.id ?? only.seller_id ?? only.sellerId ?? ''),
      label: getSellerLabelFromAny(only),
      locked: true,
      source: 'singleSeller',
    };
  }

  return {
    sellerId: '',
    label: '',
    locked: false,
    source: 'manual',
  };
}

function applyDefaultSellerToModal() {
  if (!dom.modalSeller) return;

  const resolved = resolveDefaultSellerForModal();

  dom.modalSeller.value = resolved.label || '';
  dom.modalSeller.dataset.sellerId = resolved.sellerId || '';

  if (resolved.locked) {
    dom.modalSeller.readOnly = true;
    dom.modalSeller.classList.add('crm-input--locked');
    dom.modalSeller.title = 'Vendedor preenchido automaticamente conforme o usuário/filtro.';
  } else {
    dom.modalSeller.readOnly = false;
    dom.modalSeller.classList.remove('crm-input--locked');
    dom.modalSeller.title = 'Dê duplo clique para buscar um vendedor.';
  }
}

function resolveStageCodeFromDeal(deal) {
  return (
    deal?.stage_code ??
    deal?.stageCode ??
    deal?.stage ??
    deal?.column_code ??
    deal?.columnCode ??
    null
  );
}

function resolveStatusTypeIdFromDeal(deal) {
  return (
    deal?.status_type_id ??
    deal?.statusTypeId ??
    deal?.status_type ??
    deal?.status_id ??
    null
  );
}

function resolveLeadSourceIdFromDeal(deal) {
  return (
    deal?.lead_source_id ??
    deal?.leadSourceId ??
    null
  );
}

function setModalTitleAndButton() {
  if (dom.modalNewCardTitle) {
    dom.modalNewCardTitle.textContent =
      MODAL_MODE === 'edit' ? 'Editar Card' : 'Novo Card';
  }

  const btn =
    dom.btnSaveNewCard ||
    dom.btnModalSave ||
    document.querySelector('[data-action="crm-save-card"]') ||
    document.getElementById('btnSalvarCard') ||
    null;

  if (btn) {
    btn.textContent =
      MODAL_MODE === 'edit' ? 'Salvar Alterações' : 'Salvar Card';
  }
}

function setSaveButtonLoading(loading) {
  const btn =
    dom.btnSaveNewCard ||
    dom.btnModalSave ||
    document.querySelector('[data-action="crm-save-card"]') ||
    document.getElementById('btnSalvarCard') ||
    null;

  if (!btn) return;

  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent || 'Salvar';
  }

  btn.disabled = !!loading;
  btn.textContent = loading
    ? (MODAL_MODE === 'edit' ? 'Salvando...' : 'Criando...')
    : btn.dataset.originalText;
}

function clearModalFields() {
  if (dom.modalCustomer) {
    dom.modalCustomer.value = '';
    delete dom.modalCustomer.dataset.customerId;
  }

  if (dom.modalSeller) {
    dom.modalSeller.value = '';
    delete dom.modalSeller.dataset.sellerId;
    dom.modalSeller.readOnly = false;
    dom.modalSeller.classList.remove('crm-input--locked');
    dom.modalSeller.title = 'Dê duplo clique para buscar um vendedor.';
  }

  if (dom.modalLeadSource) dom.modalLeadSource.value = '';
  if (dom.modalValue) dom.modalValue.value = '';
  if (dom.modalTagStatus) dom.modalTagStatus.value = '';
  if (dom.modalTag) dom.modalTag.value = '';
  if (dom.modalNextStep) dom.modalNextStep.value = '';
  // Começa na primeira etapa (antes ficava vazio porque não existe opção '')
  if (dom.modalStageSelect) dom.modalStageSelect.selectedIndex = dom.modalStageSelect.options.length ? 0 : -1;

  setSaveButtonLoading(false);
}

function resetModalState() {
  MODAL_MODE = 'create';
  EDIT_DEAL_ID = null;
  IS_SAVING = false;
}

/* --------------------------------------------------------------------- */
/* Select de Status Types                                                */
/* --------------------------------------------------------------------- */

export function fillStatusTypesSelect(isError = false) {
  if (!dom.modalTagStatus) return;

  dom.modalTagStatus.innerHTML = isError
    ? '<option value="">(Erro ao carregar status)</option>'
    : '<option value="">Selecione o status</option>';

  if (isError) return;

  (state.statusTypes || []).forEach((statusType) => {
    const option = document.createElement('option');
    option.value = String(statusType.id);
    option.textContent =
      statusType.name_pt ||
      statusType.status_name_pt ||
      statusType.name ||
      statusType.label ||
      statusType.internal_code ||
      statusType.code ||
      `Status #${statusType.id}`;

    option.dataset.color =
      statusType.color_hex ||
      statusType.status_color_hex ||
      '';

    dom.modalTagStatus.appendChild(option);
  });
}

/* --------------------------------------------------------------------- */
/* Select de Lead Sources                                                */
/* --------------------------------------------------------------------- */

export function fillLeadSourcesSelect(isError = false) {
  if (!dom.modalLeadSource) return;

  dom.modalLeadSource.innerHTML = isError
    ? '<option value="">(Erro ao carregar origens)</option>'
    : '<option value="">Selecione a origem</option>';

  if (isError) return;

  (state.leadSources || []).forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = [item.icon || '', item.name || `Origem #${item.id}`]
      .filter(Boolean)
      .join(' ');

    dom.modalLeadSource.appendChild(option);
  });
}

/* --------------------------------------------------------------------- */
/* Select de stages                                                      */
/* --------------------------------------------------------------------- */

function populateStageSelect() {
  if (!dom.modalStageSelect) return;

  dom.modalStageSelect.innerHTML = '';

  (state.stages || [])
    .filter((stage) => Boolean(stage.active ?? stage.is_active ?? true))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((stage) => {
      const option = document.createElement('option');
      option.value = stage.code;
      option.textContent = stage.name;
      dom.modalStageSelect.appendChild(option);
    });
}

/* --------------------------------------------------------------------- */
/* Open create modal                                                     */
/* --------------------------------------------------------------------- */

export function openNewCardModal() {
  if (!dom.modalNewCard) return;

  MODAL_MODE = 'create';
  EDIT_DEAL_ID = null;

  populateStageSelect();
  fillStatusTypesSelect(false);
  fillLeadSourcesSelect(false);
  clearModalFields();
  applyDefaultSellerToModal();
  setModalTitleAndButton();

  Modal.setup();
  Modal.open(dom.modalNewCard, { focusSelector: '#crm-new-customer' });
}

/* --------------------------------------------------------------------- */
/* Open edit modal                                                       */
/* --------------------------------------------------------------------- */

export function openDealModal({ mode = 'edit', deal } = {}) {
  if (!dom.modalNewCard || !deal) return;

  MODAL_MODE = mode === 'create' ? 'create' : 'edit';
  EDIT_DEAL_ID = MODAL_MODE === 'edit' ? getDealIdFromAny(deal) : null;

  populateStageSelect();
  fillStatusTypesSelect(false);
  fillLeadSourcesSelect(false);
  clearModalFields();
  setModalTitleAndButton();

  if (dom.modalCustomer) {
    dom.modalCustomer.value = getCustomerNameFromAny(deal);

    const customerId =
      deal.customer_id ??
      deal.customerId ??
      deal.customer_id_fk ??
      deal.customerID ??
      null;

    dom.modalCustomer.dataset.customerId =
      customerId != null ? String(customerId) : '';
  }

  if (dom.modalSeller) {
    const sellerId =
      deal.seller_id ??
      deal.sellerId ??
      deal.sellerID ??
      null;

    dom.modalSeller.dataset.sellerId =
      sellerId != null ? String(sellerId) : '';

    const labelFromDeal = getSellerLabelFromAny(deal);
    const labelFromState = resolveSellerLabelById(sellerId);
    dom.modalSeller.value = labelFromDeal || labelFromState || '';

    const currentSeller =
      state?.currentSeller != null ? String(state.currentSeller).trim() : '';

    if (currentSeller && currentSeller !== 'all') {
      dom.modalSeller.readOnly = true;
      dom.modalSeller.classList.add('crm-input--locked');
      dom.modalSeller.title = 'Vendedor vinculado ao usuário/filtro atual.';
    } else {
      dom.modalSeller.readOnly = false;
      dom.modalSeller.classList.remove('crm-input--locked');
      dom.modalSeller.title = 'Dê duplo clique para buscar um vendedor.';
    }
  }

  if (dom.modalLeadSource) {
    const leadSourceId = resolveLeadSourceIdFromDeal(deal);
    dom.modalLeadSource.value = leadSourceId != null ? String(leadSourceId) : '';
  }

  if (dom.modalValue) {
    const value =
      deal.estimated_value ??
      deal.value ??
      deal.amount ??
      deal.total_value ??
      null;

    dom.modalValue.value = formatNumberForInputBR(value);
  }

  if (dom.modalTagStatus) {
    const statusTypeId = resolveStatusTypeIdFromDeal(deal);
    dom.modalTagStatus.value = statusTypeId != null ? String(statusTypeId) : '';
  }

  if (dom.modalTag) {
    dom.modalTag.value = String(deal.tag || '').trim();
  }

  if (dom.modalNextStep) {
    dom.modalNextStep.value = String(
      deal.next_step || deal.nextStep || ''
    ).trim();
  }

  if (dom.modalStageSelect) {
    const stageCode = resolveStageCodeFromDeal(deal);
    dom.modalStageSelect.value = stageCode != null ? String(stageCode) : '';
  }

  Modal.setup();
  Modal.open(dom.modalNewCard, { focusSelector: '#crm-new-customer' });
}

export function closeNewCardModal() {
  if (!dom.modalNewCard) return;
  Modal.close(dom.modalNewCard);
}

/* --------------------------------------------------------------------- */
/* Customer picker                                                       */
/* --------------------------------------------------------------------- */

export function bindModalCustomerPicker() {
  if (!dom.modalCustomer) return;
  if (dom.modalCustomer.dataset.boundCustomerPicker === '1') return;

  dom.modalCustomer.dataset.boundCustomerPicker = '1';

  const openCustomerPicker = () => {
    openCrmCustomerSearchModal({
      apiBase: apiBaseForGlobalModals(),
      onPick(customer) {
        dom.modalCustomer.value = getCustomerNameFromAny(customer);
        dom.modalCustomer.dataset.customerId = getCustomerIdFromAny(customer) || '';
      }
    });
  };

  dom.modalCustomer.addEventListener('dblclick', openCustomerPicker);

  dom.modalCustomer.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    event.stopPropagation();

    openCustomerPicker();
  });
}

/* --------------------------------------------------------------------- */
/* Seller picker                                                         */
/* --------------------------------------------------------------------- */

export function bindModalSellerPicker() {
  if (!dom.modalSeller) return;
  if (dom.modalSeller.dataset.boundDblclickSellerPicker === '1') return;

  dom.modalSeller.dataset.boundDblclickSellerPicker = '1';

  dom.modalSeller.addEventListener('dblclick', () => {
    if (dom.modalSeller.readOnly) return;

    openCrmSellerSearchModal({
      apiBase: apiBaseForGlobalModals(),
      onPick(seller) {
        dom.modalSeller.value = getSellerLabelFromAny(seller);
        dom.modalSeller.dataset.sellerId = getSellerIdFromAny(seller) || '';
      }
    });
  });
}

/* --------------------------------------------------------------------- */
/* Build payload                                                         */
/* --------------------------------------------------------------------- */

function buildPayloadFromModal() {
  const customerName = String(dom.modalCustomer?.value || '').trim();

  const customerIdRaw = String(dom.modalCustomer?.dataset?.customerId || '').trim();
  const customerId = customerIdRaw ? Number(customerIdRaw) : null;

  const estimatedValue = parseMoneyToNumber(dom.modalValue?.value);

  const statusTypeIdRaw = String(dom.modalTagStatus?.value || '').trim();
  const statusTypeId = statusTypeIdRaw ? Number(statusTypeIdRaw) : null;

  const leadSourceIdRaw = String(dom.modalLeadSource?.value || '').trim();
  const leadSourceId = leadSourceIdRaw ? Number(leadSourceIdRaw) : null;

  const tagLegacy = String(dom.modalTag?.value || '').trim();
  const nextStep = String(dom.modalNextStep?.value || '').trim();
  const stageCode = String(dom.modalStageSelect?.value || '').trim();

  if (!stageCode) {
    alert('Selecione uma coluna para o card.');
    return null;
  }

  let sellerId = null;
  const sellerIdFromDataset = String(dom.modalSeller?.dataset?.sellerId || '').trim();

  if (sellerIdFromDataset) {
    sellerId = Number(sellerIdFromDataset);
  } else if (
    state.currentSeller !== 'all' &&
    state.currentSeller != null &&
    state.currentSeller !== ''
  ) {
    sellerId = Number(state.currentSeller);
  }

  const payload = {
    customer_id: Number.isFinite(customerId) ? customerId : null,
    customer_name: customerName || 'Cliente não informado',
    estimated_value: Number.isFinite(estimatedValue) ? estimatedValue : null,
    status_type_id: Number.isFinite(statusTypeId) ? statusTypeId : null,
    lead_source_id: Number.isFinite(leadSourceId) ? leadSourceId : null,
    tag: tagLegacy || null,
    next_step: nextStep || null,
    stageCode,
    stage_code: stageCode,
  };

  if (Number.isFinite(sellerId)) {
    payload.seller_id = sellerId;
    payload.sellerId = sellerId;
  }

  return payload;
}

/* --------------------------------------------------------------------- */
/* Refresh board                                                         */
/* --------------------------------------------------------------------- */

async function refreshBoardAfterSave() {
  await loadDeals();
  renderDeals();
  await loadOutcomesSummary();
}

/* --------------------------------------------------------------------- */
/* Save modal                                                            */
/* --------------------------------------------------------------------- */

export async function saveDealFromModal() {
  if (IS_SAVING) return;

  try {
    IS_SAVING = true;
    setSaveButtonLoading(true);

    const payload = buildPayloadFromModal();
    if (!payload) return;

    if (MODAL_MODE === 'edit') {
      const id = EDIT_DEAL_ID;

      if (!id) {
        alert('Não foi possível identificar o card para edição.');
        return;
      }

      const updated = await apiUpdateDeal(id, payload);

      if (!updated?.ok) {
        console.error('[CRM] Erro ao editar card:', updated?.error, updated);
        alert('Erro ao salvar alterações do card.');
        return;
      }

      closeNewCardModal();
      await refreshBoardAfterSave();
      return;
    }

    const created = await apiCreateDeal(payload);

    if (!created?.ok) {
      console.error('[CRM] Erro ao criar card:', created?.error, created);
      alert('Erro ao criar card.');
      return;
    }

    closeNewCardModal();
    await refreshBoardAfterSave();
  } catch (error) {
    console.error('[CRM] Exceção ao salvar card:', error);
    alert('Erro inesperado ao salvar card.');
  } finally {
    IS_SAVING = false;
    setSaveButtonLoading(false);
  }
}

export async function saveNewCard() {
  MODAL_MODE = 'create';
  EDIT_DEAL_ID = null;
  return saveDealFromModal();
}

/* --------------------------------------------------------------------- */
/* Save button / form binds                                              */
/* --------------------------------------------------------------------- */

function getSaveButtonElement() {
  return (
    dom.btnSaveNewCard ||
    dom.btnModalSave ||
    document.querySelector('[data-action="crm-save-card"]') ||
    document.getElementById('btnSalvarCard') ||
    null
  );
}

function getModalFormElement() {
  return (
    dom.formNewCard ||
    dom.modalNewCardForm ||
    document.getElementById('formNewCard') ||
    document.querySelector('[data-role="crm-new-card-form"]') ||
    null
  );
}

export function initNewCardModalBinds() {
  const saveButton = getSaveButtonElement();
  const form = getModalFormElement();

  if (saveButton && saveButton.dataset.boundSaveDealFromModal !== '1') {
    saveButton.dataset.boundSaveDealFromModal = '1';

    saveButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await saveDealFromModal();
    });
  }

  if (form && form.dataset.boundSubmitDealFromModal !== '1') {
    form.dataset.boundSubmitDealFromModal = '1';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await saveDealFromModal();
    });
  }
}

/* --------------------------------------------------------------------- */
/* Init                                                                  */
/* --------------------------------------------------------------------- */

export function initNewCardModal() {
  initNewCardModalBinds();
  bindModalCustomerPicker();
  bindModalSellerPicker();
}

/* --------------------------------------------------------------------- */
/* Reset                                                                 */
/* --------------------------------------------------------------------- */

export function resetNewCardModal() {
  clearModalFields();
  resetModalState();
  setModalTitleAndButton();
}