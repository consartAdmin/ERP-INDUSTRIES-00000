// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelSettings.sanitizers.js — Normalização dos parâmetros  ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  DEFAULT_LABEL_SETTINGS,
  ALIGN_VALUES,
  FIELD_LABEL_KEYS,
  NUMBER_LIMITS,
} from './deliveryLabelSettings.constants.js';

export function sanitizeLabelSettings(rawInput = {}) {
  const out = { ...DEFAULT_LABEL_SETTINGS };
  const input = { ...rawInput };

  // Compatibilidade: antigo parâmetro único show_field_labels vale para todos os títulos
  if (input.show_field_labels !== undefined) {
    for (const key of FIELD_LABEL_KEYS) input[key] ??= input.show_field_labels;
  }

  for (const [key, fallback] of Object.entries(DEFAULT_LABEL_SETTINGS)) {
    const value = input[key];
    if (value === undefined || value === null || value === '') continue;

    if (typeof fallback === 'boolean') {
      out[key] = value === true || value === 'true' || value === 1 || value === '1';
    } else if (typeof fallback === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      const [min, max] = NUMBER_LIMITS[key];
      out[key] = Math.min(max, Math.max(min, n));
    } else if (key.startsWith('align_')) {
      if (ALIGN_VALUES.includes(value)) out[key] = value;
    } else {
      out[key] = String(value).trim().slice(0, 60);
    }
  }

  return out;
}
