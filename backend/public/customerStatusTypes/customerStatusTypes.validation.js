import { elements } from './customerStatusTypes.state.js';
import { isValidHexColor, normalizeHexColor } from './customerStatusTypes.utils.js';
export function readValidTypeForm() {
  const name_pt = String(elements.typeNameInput?.value || '').trim();
  const internal_code = String(elements.typeCodeInput?.value || '').trim();
  const color_hex = normalizeHexColor(elements.typeColorInput?.value);
  const order = String(elements.typeOrderInput?.value || '').trim();
  if (!name_pt) { alert('Informe o Nome (PT).'); elements.typeNameInput?.focus(); return null; }
  if (!internal_code) { alert('Informe o Código Interno.'); elements.typeCodeInput?.focus(); return null; }
  if (color_hex && !isValidHexColor(color_hex)) {
    alert('Informe uma cor HEX válida. Exemplo: #FF0000');
    elements.typeColorInput?.focus(); elements.typeColorInput?.classList.add('input-invalid'); return null;
  }
  return { name_pt, internal_code, color_hex: color_hex || null, sort_order: order === '' ? 0 : Number(order) };
}
