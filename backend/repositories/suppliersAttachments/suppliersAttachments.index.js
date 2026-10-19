// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachments.index.js — ponto de entrada (anexos fornec.)  ║
// ║ Mantém a mesma API pública do antigo suppliersAttachmentsApi.js    ║
// ║ (somente export default { list, upload, remove })                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { list } from './suppliersAttachmentsQuery.repository.js';
import { upload } from './suppliersAttachmentsUpload.repository.js';
import { remove } from './suppliersAttachmentsRemove.repository.js';

export default {
  list,
  upload,
  remove
};
