// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.index.js — ponto de entrada Contas a Receber    ║
// ║ Mantém a mesma API pública do antigo accountsReceivableApi.js      ║
// ║ Integração com Asaas via tabela ponte; ENTRADA automática no caixa ║
// ║ Tabelas: accountsReceivable, accountsReceivableAsaas (PONTE),      ║
// ║          customers, bankAccounts, cashMoviments                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import { syncReceivableCashMovement } from './accountsReceivableCashMovement.repository.js';
import {
  listCashCategories,
  listCashSubcategories,
  listCashDocumentTypes,
  listChartOfAccounts,
  listBankAccounts,
} from './accountsReceivableLookups.repository.js';
import { listAccountsReceivable, resumoMes } from './accountsReceivableQuery.repository.js';
import { getById } from './accountsReceivableGetById.repository.js';
import { createAccount } from './accountsReceivableCreate.repository.js';
import { updateAccount } from './accountsReceivableUpdate.repository.js';
import { receivePayment } from './accountsReceivableReceive.repository.js';
import { updateBoletoValueAndDueDate, cancelAsaasBoleto } from './accountsReceivableBoletoUpdate.repository.js';
import { syncFromAsaas } from './accountsReceivableAsaasSync.repository.js';
import { resolveAsaasPaymentIdByAccountsReceivableId } from './accountsReceivableBridge.repository.js';
import {
  getExistingBoletoDownloadInfoByPaymentId,
  getExistingBoletoDownloadInfoByAccountsReceivableId,
  getBoletoDownloadInfo,
  updateBoletoLocalInfo,
} from './accountsReceivableBoletoDownload.repository.js';

// Efeito colateral: cria a tabela ponte Asaas (DDL) ao importar o módulo
import './accountsReceivable.schema.js';

export {
  syncReceivableCashMovement,
  listCashCategories,
  listCashSubcategories,
  listCashDocumentTypes,
  listChartOfAccounts,
  listBankAccounts,
  listAccountsReceivable,
  getById,
  createAccount,
  updateAccount,
  updateBoletoValueAndDueDate,
  receivePayment,
  syncFromAsaas,
  resumoMes,
  resolveAsaasPaymentIdByAccountsReceivableId,
  getExistingBoletoDownloadInfoByPaymentId,
  getExistingBoletoDownloadInfoByAccountsReceivableId,
  getBoletoDownloadInfo,
  cancelAsaasBoleto,
  updateBoletoLocalInfo,
};

export default {
  listBankAccounts,
  listCashCategories,
  listCashSubcategories,
  listCashDocumentTypes,
  listChartOfAccounts,
  listAccountsReceivable,
  getById,
  createAccount,
  updateAccount,
  receivePayment,

  // Atualização do boleto
  updateBoletoValueAndDueDate,

  syncFromAsaas,
  resumoMes,

  // boleto
  getBoletoDownloadInfo,
  updateBoletoLocalInfo, // ✅ ADD

  // extras
  resolveAsaasPaymentIdByAccountsReceivableId,
  getExistingBoletoDownloadInfoByPaymentId,
  getExistingBoletoDownloadInfoByAccountsReceivableId,

  cancelAsaasBoleto,
};
