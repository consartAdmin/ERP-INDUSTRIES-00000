// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.validation.js                                   ║
// ║ MODULE: Customers List — Validation                                 ║
// ║ PRODNEX ERP                                                         ║
// ║ Export-key collection and validation                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { ROUTES } from './customersList.config.js';

// Senha configurada em Configurações › Senhas dos Módulos (CUSTOMERS / EXPORT).
// Se a consulta falhar, pede a chave por segurança.
export async function isExportKeyRequired() {
  try {
    const json = await apiFetch(ROUTES.exportPasswordStatus);
    return json?.data?.required !== false;
  } catch (error) {
    console.warn('[customersList.isExportKeyRequired]', error);
    return true;
  }
}

export async function askExportKey(typeLabel) {
  if (!(await isExportKeyRequired())) {
    return { status: 'not_required', key: '' };
  }

  const value = window.prompt(
    `Digite a chave para exportar ${typeLabel}:`,
    ''
  );

  if (value == null) return { status: 'cancelled', key: null };

  const key = String(value).trim();
  if (!key) return { status: 'missing', key: '' };

  return { status: 'valid', key };
}
