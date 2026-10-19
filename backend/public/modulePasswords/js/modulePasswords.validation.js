// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.validation.js                                 ║
// ║ MODULE: Senhas dos Módulos — Validation                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { PASSWORD_MIN_LENGTH } from './modulePasswords.config.js';

const CODE_RE = /^[A-Z0-9_]{2,60}$/;

/** Retorna a mensagem de erro ou '' quando válido */
export function validateForm(data, { isNew }) {
  if (isNew) {
    if (!CODE_RE.test(data.module_code)) {
      return 'Módulo inválido. Use letras, números e "_" (ex.: CUSTOMERS).';
    }
    if (!CODE_RE.test(data.action_code)) {
      return 'Ação inválida. Use letras, números e "_" (ex.: EXPORT).';
    }
  }

  if (data.password || data.password_confirm) {
    if (data.password.trim().length < PASSWORD_MIN_LENGTH) {
      return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    }
    if (data.password !== data.password_confirm) {
      return 'A confirmação não confere com a nova senha.';
    }
  }

  return '';
}
