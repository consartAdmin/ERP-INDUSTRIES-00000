// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.validation.js — Regras de validação                  ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateXmlFile(file) {
  if (!file) throw new Error('Selecione o XML da NF-e de entrada.');
  return true;
}

export function validateImportedHeader(header) {
  if (!header) throw new Error('Importe uma NF-e de entrada primeiro.');
  return true;
}

export function validateCreatePayload(payload) {
  if (!payload.supplier_id) {
    throw new Error('Fornecedor do XML não foi encontrado no cadastro. Cadastre/vincule o fornecedor antes de gerar a devolução.');
  }

  if (!payload.items.length) {
    throw new Error('Selecione ao menos um item com quantidade maior que zero.');
  }

  return true;
}

export function validateReturnId(id) {
  if (!id) throw new Error('ID da devolução não informado.');
  return true;
}
