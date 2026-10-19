'use strict';

import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE,
} from './accountsPayable.config.js';
import { getFileExtension } from './accountsPayable.utils.js';

export function validateAttachment(file) {
  if (!file) return 'Nenhum arquivo selecionado.';
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name))) {
    return 'Tipo não permitido. Use PDF, XML, PNG, JPG, JPEG ou WEBP.';
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return 'O arquivo deve ter no máximo 20 MB.';
  }
  return null;
}

export function validatePayment({ accountId, cashAccount, amount }) {
  if (!accountId) return 'Conta não identificada.';
  if (!cashAccount) return 'Informe a Conta de Caixa (obrigatória).';
  if (!(Number(amount) > 0)) return 'Informe um valor de pagamento maior que zero.';
  return null;
}
