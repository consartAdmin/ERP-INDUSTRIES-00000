import { DEFAULT_COLOR } from './customerStatusTypes.config.js';
import { elements } from './customerStatusTypes.state.js';
import { isValidHexColor, normalizeHexColor, safeColor } from './customerStatusTypes.utils.js';
const markValid = (valid) => elements.typeColorInput?.classList.toggle('input-invalid', !valid);
const preview = (color) => { if (elements.typeColorPreview) elements.typeColorPreview.style.background = safeColor(color, DEFAULT_COLOR); };
export function syncColorFromText() {
  const raw = elements.typeColorInput?.value || '';
  const color = normalizeHexColor(raw);
  if (!raw.trim()) {
    markValid(true); if (elements.typeColorPicker) elements.typeColorPicker.value = DEFAULT_COLOR; preview(DEFAULT_COLOR); return;
  }
  if (isValidHexColor(color)) {
    elements.typeColorInput.value = color;
    if (elements.typeColorPicker) elements.typeColorPicker.value = color;
    preview(color); markValid(true); return;
  }
  preview(elements.typeColorPicker?.value || DEFAULT_COLOR); markValid(false);
}
export function syncColorFromPicker() {
  const color = safeColor(elements.typeColorPicker?.value, DEFAULT_COLOR);
  if (elements.typeColorInput) elements.typeColorInput.value = color;
  markValid(true); preview(color);
}
export function initializeTypeForm() {
  if (elements.typeColorPicker) elements.typeColorPicker.value = DEFAULT_COLOR;
  if (elements.typeColorInput && !elements.typeColorInput.value.trim()) elements.typeColorInput.value = DEFAULT_COLOR;
  preview(elements.typeColorInput?.value || DEFAULT_COLOR); markValid(true);
}
export function clearTypeForm() {
  if (elements.typeNameInput) elements.typeNameInput.value = '';
  if (elements.typeCodeInput) elements.typeCodeInput.value = '';
  if (elements.typeColorInput) elements.typeColorInput.value = DEFAULT_COLOR;
  if (elements.typeOrderInput) elements.typeOrderInput.value = '';
  if (elements.typeColorPicker) elements.typeColorPicker.value = DEFAULT_COLOR;
  preview(DEFAULT_COLOR); markValid(true);
}
