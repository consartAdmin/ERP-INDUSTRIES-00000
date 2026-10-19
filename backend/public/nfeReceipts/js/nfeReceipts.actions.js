// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.actions.js — Ações do Canhoto Digital (mobile)          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getPageElements } from './nfeReceipts.config.js';
import { getReceipt, signReceipt, refuseReceipt } from './nfeReceipts.api.js';
import { state, resetReceiptState } from './nfeReceipts.state.js';
import { readReceiptForm, clearReceiptForm, readNfeNumber, focusField } from './nfeReceipts.form.js';
import { validateReceiptForm, validateNfeNumber } from './nfeReceipts.validation.js';
import {
  renderSearch,
  renderLoading,
  renderError,
  renderReceipt,
  renderSubmitting,
  renderSignatureHint,
  markSignatureInvalid
} from './nfeReceipts.render.js';
import { askRefuseReason } from './nfeReceipts.modal.js';

let signaturePad = null;

export function setSignaturePad(pad) {
  signaturePad = pad;
}

const ERROR_MESSAGES = {
  NFE_NOT_FOUND: 'NF-e não encontrada.',
  INVALID_NFE_NUMBER: 'Número da NF-e inválido.',
  INVALID_ACCESS_KEY: 'Chave da NF-e inválida.',
  INVALID_NFE_ACCESS_KEY: 'Esta NF-e ainda não possui chave de acesso válida.',
  RECEIPT_NOT_FOUND: 'Canhoto não encontrado.',
  RECEIPT_NOT_FOUND_OR_INVALID_STATUS: 'Este canhoto já foi assinado, recusado ou cancelado.',
  INVALID_SIGNATURE_DATA_URL: 'A assinatura não pôde ser lida. Limpe e assine novamente.'
};

function friendlyError(error, fallback) {
  return ERROR_MESSAGES[error?.message] || fallback;
}

// ──────────────────────────────────────────────────────────────────────
// Localização (opcional — o canhoto funciona sem GPS)
// ──────────────────────────────────────────────────────────────────────

export function requestLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location.latitude = pos.coords.latitude;
      state.location.longitude = pos.coords.longitude;
    },
    () => {
      state.location.latitude = null;
      state.location.longitude = null;
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

// ──────────────────────────────────────────────────────────────────────
// Carregar NF-e
// ──────────────────────────────────────────────────────────────────────

export async function loadReceipt(identifier) {
  state.identifier = identifier;
  renderLoading();

  try {
    const json = await getReceipt(identifier);
    state.receipt = json.data;

    clearReceiptForm();
    signaturePad?.clear();
    renderReceipt(json.data);

    // O canvas acabou de ficar visível: ajusta a resolução ao tamanho real
    // agora e de novo no próximo frame (depois de fontes/layout assentarem).
    signaturePad?.resize();
    requestAnimationFrame(() => signaturePad?.resize());
  } catch (error) {
    console.error('[nfeReceipts] loadReceipt error:', error);
    renderError(friendlyError(error, 'Não foi possível carregar o canhoto digital.'));
    if (identifier.type === 'number') {
      getPageElements().searchBox?.classList.remove('hidden');
    }
  }
}

export function searchReceipt() {
  const number = readNfeNumber();
  const error = validateNfeNumber(number);

  if (error) {
    renderError(error);
    getPageElements().searchBox?.classList.remove('hidden');
    return;
  }

  loadReceipt({ type: 'number', value: number });
}

export function newSearch() {
  resetReceiptState();
  clearReceiptForm();
  signaturePad?.clear();

  const els = getPageElements();
  if (els.nfeNumberInput) els.nfeNumberInput.value = '';
  renderSearch();
  els.nfeNumberInput?.focus();
}

// ──────────────────────────────────────────────────────────────────────
// Assinatura
// ──────────────────────────────────────────────────────────────────────

export function clearSignature() {
  signaturePad?.clear();
}

export function handleSignatureChange() {
  renderSignatureHint(signaturePad?.isEmpty() ?? true);
}

export async function submitReceipt(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  if (!state.identifier) {
    alert('Busque a NF-e antes de confirmar.');
    return;
  }

  const values = readReceiptForm();
  const problem = validateReceiptForm(values, signaturePad);

  if (problem) {
    if (problem.field === 'signatureWrap') markSignatureInvalid();
    alert(problem.message);
    focusField(problem.field);
    return;
  }

  const payload = {
    receiverName: values.receiverName,
    receiverDocument: values.receiverDocument,
    receiverPhone: values.receiverPhone,
    notes: values.notes,
    signatureDataUrl: signaturePad.toDataUrl(),
    latitude: state.location.latitude,
    longitude: state.location.longitude
  };

  state.isSubmitting = true;
  renderSubmitting(true);

  try {
    const json = await signReceipt(state.identifier, payload);
    state.receipt = { ...state.receipt, ...json.data, status: 'SIGNED' };
    renderReceipt(state.receipt);
  } catch (error) {
    console.error('[nfeReceipts] submitReceipt error:', error);
    alert(friendlyError(error, 'Erro ao confirmar recebimento. Verifique a conexão e tente novamente.'));
  } finally {
    state.isSubmitting = false;
    renderSubmitting(false);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Recusa
// ──────────────────────────────────────────────────────────────────────

export async function refuseCurrentReceipt() {
  if (state.isSubmitting) return;

  if (!state.identifier) {
    alert('Busque a NF-e antes de recusar.');
    return;
  }

  const reason = await askRefuseReason();
  if (!reason) return;

  state.isSubmitting = true;
  renderSubmitting(true);

  try {
    const json = await refuseReceipt(state.identifier, reason);
    state.receipt = { ...state.receipt, ...json.data, status: 'REFUSED' };
    renderReceipt(state.receipt);
  } catch (error) {
    console.error('[nfeReceipts] refuseCurrentReceipt error:', error);
    alert(friendlyError(error, 'Erro ao recusar recebimento. Verifique a conexão e tente novamente.'));
  } finally {
    state.isSubmitting = false;
    renderSubmitting(false);
  }
}
