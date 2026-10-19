'use strict';
import { $ } from './banks.utils.js';
let escapeHandler = null;
export function openModal() {
  const modal = $('#banksModal'); if (!modal) return;
  modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
  escapeHandler = (event) => { if (event.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escapeHandler); $('#bankName')?.focus();
}
export function closeModal() {
  const modal = $('#banksModal'); if (!modal) return;
  modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
  if (escapeHandler) document.removeEventListener('keydown', escapeHandler); escapeHandler = null;
}
export function bindModal() { document.querySelectorAll('#banksModal [data-modal-close]').forEach((el) => el.addEventListener('click', closeModal)); }
