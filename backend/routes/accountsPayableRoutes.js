// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableRoutes.js — Express Routes                           ║
// ║ CONSART ERP — Rotas /api/accounts-payable                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';

import {
  listAccountsPayable,
  exportAccountsPayablePdf,
  exportAccountsPayableExcel,
  getAccountsPayable,
  createAccountsPayable,
  updateAccountsPayable,
  deleteAccountsPayable,
  payAccountsPayable,
  getAccountsPayableAttachments,
  createAccountsPayableFromNfeEntry,
  signAccountsPayableAttachmentUpload,
  confirmAccountsPayableAttachmentUpload,
  downloadAccountsPayableAttachment,
  signReadAccountsPayableAttachment,
  countAccountsPayableAttachments,
  deleteAccountsPayableAttachment,
  diagAccountsPayableUpload
} from '../controllers/accountsPayableController.js';

const router = Router();

// Exportacoes e rotas fixas devem ficar antes de /:id.
router.get('/accounts-payable/export/pdf', exportAccountsPayablePdf);
router.get('/accounts-payable/export/excel', exportAccountsPayableExcel);
router.post('/accounts-payable/from-nfe-entry', createAccountsPayableFromNfeEntry);

router.get('/accounts-payable', listAccountsPayable);
router.post('/accounts-payable', createAccountsPayable);

// Upload direto no GCS por URL assinada.
router.post('/upload/accounts-payable/anexo/sign', signAccountsPayableAttachmentUpload);
router.post('/upload/accounts-payable/anexo/confirm', confirmAccountsPayableAttachmentUpload);
router.get('/upload/accounts-payable/anexo/sign-read', signReadAccountsPayableAttachment);
router.get('/upload/accounts-payable/diag', diagAccountsPayableUpload);

// Conta e pagamento.
router.get('/accounts-payable/:id', getAccountsPayable);
router.put('/accounts-payable/:id', updateAccountsPayable);
router.delete('/accounts-payable/:id', deleteAccountsPayable);
router.post('/accounts-payable/:id/pay', payAccountsPayable);

// Os dois nomes permanecem por compatibilidade.
router.get('/accounts-payable/:id/attachments', getAccountsPayableAttachments);
router.get('/accounts-payable/:id/anexos', getAccountsPayableAttachments);
router.get('/accounts-payable/:id/anexos/count', countAccountsPayableAttachments);
router.get(
  '/accounts-payable/:id/anexos/:attachmentId/download',
  downloadAccountsPayableAttachment
);
router.delete(
  '/accounts-payable/:id/anexos/:attachmentId',
  deleteAccountsPayableAttachment
);

export default router;
