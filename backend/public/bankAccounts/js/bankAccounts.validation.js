'use strict';
const PROVIDERS = new Set(['ASAAS', 'MANUAL', 'OTHER_API']);
const MODES = new Set(['AUTOMATIC', 'MANUAL', 'NONE']);
export function validateBankAccount(data) {
  if (!Number.isInteger(Number(data.bank_id)) || Number(data.bank_id) <= 0) throw new Error('Selecione o banco.');
  if (!String(data.name || '').trim()) throw new Error('Informe o nome da conta.');
  if (!PROVIDERS.has(data.integration_provider)) throw new Error('Provedor inválido.');
  if (!MODES.has(data.boleto_mode)) throw new Error('Modo de boleto inválido.');
  if (data.integration_provider === 'ASAAS' && data.boleto_mode !== 'AUTOMATIC') throw new Error('A conta Asaas deve usar boleto automático.');
  return true;
}
