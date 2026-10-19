// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employees.index.js — ponto de entrada do módulo                      ║
// ║ Mantém a mesma API pública do antigo employeesApi.js                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './employeesSchema.repository.js';
import { list, getById } from './employeesQuery.repository.js';
import { create } from './employeesCreate.repository.js';
import { update } from './employeesUpdate.repository.js';
import { remove } from './employeesRemove.repository.js';
import {
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
} from './employeesDocuments.repository.js';
import { signUpload, signDownload } from './employeesStorage.repository.js';

export { TB, PK, ALIAS, TB_DOCS, PK_DOCS, DOC_ALIAS } from './employees.constants.js';

export {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
  listDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  signUpload,
  signDownload,
};

// updateDocument é export nomeado, mas (como no original) não entra no default.
// ─────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────
export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,

  listDocuments,
  getDocumentById,
  createDocument,
  deleteDocument,

  signUpload,
  signDownload,
};
