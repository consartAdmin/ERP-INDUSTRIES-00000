// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.modal.js                                      ║
// ║ MODULE: Senhas dos Módulos — Modals                                 ║
// ║ Modal de cadastro/edição + alertas (centerAlertModal)                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { fillForm, resetForm } from './modulePasswords.form.js';
import { state } from './modulePasswords.state.js';
import { $ } from './modulePasswords.utils.js';

export function showError(title, message) {
  return showCenterModal({ variant: 'error', title, message });
}

export function showSuccess(title, message) {
  return showCenterModal({ variant: 'success', title, message });
}

export function showValidation(message) {
  return showCenterModal({ variant: 'warning', title: 'Verifique os campos', message });
}

export async function confirmAction(title, message, okText) {
  const ok = await showCenterModal({
    variant: 'warning',
    title,
    message,
    okText,
    closeText: 'Cancelar',
  });
  return ok === true;
}

function modalEl() {
  return $('#passwordModal');
}

function open() {
  const modal = modalEl();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const modal = modalEl();
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal.is-open')) {
    document.body.style.overflow = '';
  }
  state.editing = null;
}

export function openNewModal() {
  state.editing = null;
  resetForm();
  $('#passwordModalTitle').textContent = 'Nova Senha de Módulo';
  open();
  $('#module_code').focus();
}

export function openEditModal(row) {
  state.editing = row;
  fillForm(row);
  $('#passwordModalTitle').textContent = `Senha — ${row.module_code} / ${row.action_code}`;
  open();
  $('#password').focus();
}
