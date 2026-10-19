// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.index.js — ponto de entrada do contas a pagar      ║
// ║ Mantém a mesma API pública do antigo accountsPayableApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './accountsPayableSchema.repository.js';
import { list, getById, getBySource } from './accountsPayableQuery.repository.js';
import { create, update, remove } from './accountsPayableMutation.repository.js';
import { pay } from './accountsPayablePay.repository.js';
import {
  listAttachments,
  getAttachmentById,
  addAttachment,
  addAttachments,
  removeAttachment,
} from './accountsPayableAttachments.repository.js';
import { signAttachmentUpload, signAttachmentDownload } from './accountsPayableAttachmentsSign.repository.js';
import { createFromSource } from './accountsPayableCreateFromSource.repository.js';

export {
  ensureTable,
  list,
  getById,
  getBySource,
  create,
  update,
  remove,
  pay,
  listAttachments,
  getAttachmentById,
  signAttachmentUpload,
  signAttachmentDownload,
  addAttachment,
  addAttachments,
  removeAttachment,
  createFromSource,
};

export default {
  ensureTable,
  list,
  getById,
  getBySource,
  create,
  update,
  remove,
  pay,
  listAttachments,
  getAttachmentById,
  addAttachment,
  addAttachments,
  removeAttachment,
  signAttachmentUpload,
  signAttachmentDownload,
  createFromSource
};
