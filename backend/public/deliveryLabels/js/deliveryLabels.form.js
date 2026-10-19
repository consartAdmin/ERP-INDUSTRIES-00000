// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.form.js — Modal e formulário                 ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { DELIVERY_LABEL_FIELDS } from './deliveryLabels.config.js';
import { getField } from './deliveryLabels.utils.js';

export function clearLabelForm() {
  for (const field of DELIVERY_LABEL_FIELDS) {
    const element = getField(field);
    if (element) element.value = '';
  }
}

export function getLabelFormData() {
  const data = {};

  for (const field of DELIVERY_LABEL_FIELDS) {
    if (field === 'delivery_label_id') continue;

    const element = getField(field);
    if (!element) continue;

    data[field] = typeof element.value === 'string'
      ? element.value.trim()
      : element.value;
  }

  data.volumes = Math.max(1, Number(data.volumes || 1));
  data.weight = data.weight === '' ? null : Number(data.weight);

  return data;
}

export function getEditingLabelId() {
  return getField('delivery_label_id')?.value.trim() || '';
}
