// ╔════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.index.js — ponto de entrada perfis por módulo         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './usersProfileSchema.repository.js';
import { listByUser, getByUserAndModule, summary } from './usersProfileQuery.repository.js';
import { upsert, saveMany } from './usersProfileUpsert.repository.js';
import { remove } from './usersProfileRemove.repository.js';
import { PERMISSION_KEYS } from './usersProfile.constants.js';

export {
  ensureTable,
  listByUser,
  getByUserAndModule,
  summary,
  upsert,
  saveMany,
  remove,
  PERMISSION_KEYS,
};

export default {
  ensureTable,
  listByUser,
  getByUserAndModule,
  summary,
  upsert,
  saveMany,
  remove,
  PERMISSION_KEYS,
};
