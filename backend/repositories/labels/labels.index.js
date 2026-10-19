// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ labels.index.js — ponto de entrada do módulo labels                     ║
// ║ Mantém a mesma API pública do antigo services/apis/labelsApi.js         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { apiBase, setApiBase } from './labels.utils.js';
import {
  generateProductLabels,
  listLabelJobs,
  getLabelJob,
} from './labelsClient.repository.js';

// apiBase re-exportado como live binding (setApiBase continua refletindo).
export { apiBase, setApiBase, generateProductLabels, listLabelJobs, getLabelJob };

/* ──────────────────────────────────────────────────────────────────────────
   Default Export
────────────────────────────────────────────────────────────────────────── */

export default {
  apiBase,
  setApiBase,
  generateProductLabels,
  listLabelJobs,
  getLabelJob,
};
