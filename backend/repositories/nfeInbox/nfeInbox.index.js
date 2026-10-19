// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInbox.index.js — ponto de entrada da Caixa de Entrada NF-e        ║
// ║ Mantém a mesma API pública do antigo nfeInboxApi.js                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULT_SORT_COLUMN, DEFAULT_SORT_DIRECTION } from './nfeInbox.constants.js';
import { SORTABLE_COLUMNS } from './nfeInbox.sql.js';
import { ensureTable } from './nfeInboxSchema.repository.js';
import { list, count, getById } from './nfeInboxQuery.repository.js';
import { saveXmlCompletoById, upsertFromParsedNfe } from './nfeInboxUpsert.repository.js';

export {
  SORTABLE_COLUMNS,
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DIRECTION,
  ensureTable,
  list,
  count,
  getById,
  saveXmlCompletoById,
  upsertFromParsedNfe,
};

export default {
  ensureTable,
  list,
  count,
  getById,
  saveXmlCompletoById,
  upsertFromParsedNfe,
  SORTABLE_COLUMNS,
  DEFAULT_SORT_COLUMN,
  DEFAULT_SORT_DIRECTION,
};
