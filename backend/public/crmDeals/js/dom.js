// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dom.js — CRM Deals (PRODNEX ERP)                                    ║
// ║ Cache dos elementos DOM                                              ║
// ║ ✅ Inclui campo de Origem do Lead                                    ║
// ║ ✅ Preparado para modal de Queda de Venda                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const dom = {
  selectSeller: null,
  btnAddCard: null,

  modalNewCard: null,
  modalNewCardTitle: null,
  modalStageSelect: null,
  modalCustomer: null,
  modalSeller: null,
  modalLeadSource: null,
  modalValue: null,
  modalTagStatus: null,
  modalTag: null,
  modalNextStep: null,
  btnModalSave: null,
  btnModalCancel: null,

  outcomeSummary: null,
  conclusionZones: null,
  counterFinal: null,

  formNewCard: null,

  // Modal futura de Queda de Venda
  modalLossReason: null,
  modalLossReasonSelect: null,
  modalLossReasonNotes: null,
  btnLossReasonConfirm: null,
  btnLossReasonCancel: null,
};

export function cacheDom() {
  dom.selectSeller = document.getElementById('crm-vendedor');
  dom.btnAddCard = document.getElementById('crm-btn-add-card');

  dom.modalNewCard = document.getElementById('crm-modal-new-card');
  dom.modalNewCardTitle = document.getElementById('crmModalTitle');
  dom.modalStageSelect = document.getElementById('crm-new-stage');
  dom.modalCustomer = document.getElementById('crm-new-customer');
  dom.modalSeller = document.getElementById('crm-new-seller');
  dom.modalLeadSource = document.getElementById('crm-new-lead-source');
  dom.modalValue = document.getElementById('crm-new-value');

  dom.modalTagStatus = document.getElementById('crm-new-tag-status');
  dom.modalTag = document.getElementById('crm-new-tag');
  dom.modalNextStep = document.getElementById('crm-new-nextstep');

  dom.btnModalSave = document.getElementById('crm-modal-save');
  dom.btnModalCancel = document.getElementById('crm-modal-cancel');

  dom.outcomeSummary = document.getElementById('crm-outcome-summary');
  dom.conclusionZones = document.getElementById('crm-lead-conclusion-zones');
  dom.counterFinal = document.getElementById('counter-final');

  dom.formNewCard =
    document.getElementById('formNewCard') ||
    document.querySelector('[data-role="crm-new-card-form"]') ||
    null;

  // Modal futura de perda
  dom.modalLossReason = document.getElementById('crm-modal-loss-reason');
  dom.modalLossReasonSelect = document.getElementById('crm-loss-reason-select');
  dom.modalLossReasonNotes = document.getElementById('crm-loss-reason-notes');
  dom.btnLossReasonConfirm = document.getElementById('crm-loss-reason-confirm');
  dom.btnLossReasonCancel = document.getElementById('crm-loss-reason-cancel');
}