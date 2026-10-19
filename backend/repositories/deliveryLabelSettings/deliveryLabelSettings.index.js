// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelSettings.index.js — ponto de entrada do módulo        ║
// ║ Mantém a mesma API pública do antigo deliveryLabelSettingsApi.js   ║
// ╚════════════════════════════════════════════════════════════════════╝

export { DEFAULT_LABEL_SETTINGS } from './deliveryLabelSettings.constants.js';
export { sanitizeLabelSettings } from './deliveryLabelSettings.sanitizers.js';
export {
  getLabelSettings,
  saveLabelSettings,
} from './deliveryLabelSettingsStore.repository.js';
