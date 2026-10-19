'use strict';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
export const $ = (selector, root = document) => root.querySelector(selector);
export function setBusy(element, busy, text = 'Salvando...') { if (!element) return; if (busy) { element.dataset.oldText = element.textContent; element.textContent = text; } else if (element.dataset.oldText) { element.textContent = element.dataset.oldText; delete element.dataset.oldText; } element.disabled = busy; }
const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
// centerAlertModal insere title/message via innerHTML: escapa textos vindos da API.
export function notify(variant, title, message) { return showCenterModal({ variant, title: escapeHtml(title), message: escapeHtml(message) }); }
