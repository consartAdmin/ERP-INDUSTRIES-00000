'use strict';
export const $ = (selector, root = document) => root.querySelector(selector);
export function setBusy(element, busy, text = 'Salvando...') {
  if (!element) return;
  if (busy) { element.dataset.oldText = element.textContent; element.textContent = text; }
  else if (element.dataset.oldText) { element.textContent = element.dataset.oldText; delete element.dataset.oldText; }
  element.disabled = busy;
}
export function notify(type, title, message) {
  if (typeof window.showCenterModal === 'function') return window.showCenterModal({ type, title, message });
  window.alert(`${title}\n\n${message}`);
}
