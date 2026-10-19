// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainings.index.js — ponto de entrada do módulo            ║
// ║ Treinamentos de clientes (agenda, participantes, conclusão)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { FORMAT_LABELS, STATUS_LABELS, TB, TB_ATTENDEES } from './customerTrainings.constants.js';
import { ensureTable } from './customerTrainingsSchema.repository.js';
import { list, getById } from './customerTrainingsQuery.repository.js';
import { create } from './customerTrainingsCreate.repository.js';
import { update, complete, markEmailSent } from './customerTrainingsUpdate.repository.js';
import { remove } from './customerTrainingsRemove.repository.js';

export {
  TB,
  TB_ATTENDEES,
  STATUS_LABELS,
  FORMAT_LABELS,
  ensureTable,
  list,
  getById,
  create,
  update,
  complete,
  markEmailSent,
  remove,
};

export default {
  ensureTable,
  list,
  getById,
  create,
  update,
  complete,
  markEmailSent,
  remove,
};
