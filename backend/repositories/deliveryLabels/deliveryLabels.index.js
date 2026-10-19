// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.index.js — ponto de entrada do módulo etiquetas     ║
// ║ Mantém a mesma API pública do antigo deliveryLabelsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  createDeliveryLabel,
  listDeliveryLabels,
  getDeliveryLabelById,
  updateDeliveryLabel,
  deleteDeliveryLabel,
} from './deliveryLabelsCrud.repository.js';

export {
  createFromOrder,
  createFromBudget,
  createFromInvoice,
} from './deliveryLabelsImport.repository.js';
