// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfig.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo labelPrintConfigApi.js         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getLabelConfig } from './labelPrintConfigGet.repository.js';
import { updateLabelConfig, resetLabelConfig } from './labelPrintConfigUpdate.repository.js';

export { LABEL_PRINT_CONFIG_TABLE } from './labelPrintConfig.constants.js';

export default {
  getLabelConfig,
  updateLabelConfig,
  resetLabelConfig,
};
