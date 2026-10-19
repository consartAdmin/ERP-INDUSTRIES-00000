// Adaptador local do modal central do ERP para o módulo Contas a Receber.
// - Usa o centerAlertModal real (antes dependia de window.showCenterModal,
//   que nenhuma página define, e sempre caía no alert() do navegador).
// - Aceita `type` (usado nas chamadas antigas) como sinônimo de `variant`.
// - O centerAlertModal insere title/message como HTML: aqui o texto é
//   escapado, a menos que a chamada passe `html: true` com HTML já seguro.
import { showCenterModal as centerModal } from '/public/includes/js/centerAlertModal.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[c]));

export function showCenterModal(options = {}) {
  const { type, html, ...rest } = options;
  const variant = rest.variant || type;

  const normalized = {
    ...rest,
    ...(variant ? { variant } : {}),
    title: html ? rest.title : escapeHtml(rest.title),
    message: html ? rest.message : escapeHtml(rest.message).replace(/\n/g, '<br>'),
  };

  try {
    return centerModal(normalized);
  } catch (error) {
    console.error('[AR] centerAlertModal indisponível:', error);
    const title = options.title ? `${options.title}\n\n` : '';
    window.alert(`${title}${html ? '' : options.message || ''}`);
    return Promise.resolve(null);
  }
}
