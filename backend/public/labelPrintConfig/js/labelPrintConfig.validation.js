// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.validation.js                                ║
// ║ MODULE: Label Print Config — Validation                             ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateLabelPrintConfig(config) {
  if (config.width_mm <= 0) {
    return { ok: false, message: 'A largura da etiqueta deve ser maior que zero.' };
  }

  if (config.height_mm <= 0) {
    return { ok: false, message: 'A altura da etiqueta deve ser maior que zero.' };
  }

  if (config.margin_mm < 0) {
    return { ok: false, message: 'A margem não pode ser negativa.' };
  }

  if (config.barcode_height <= 0) {
    return {
      ok: false,
      message: 'A altura do código de barras deve ser maior que zero.',
    };
  }

  if (config.font_size_pt <= 0) {
    return { ok: false, message: 'O tamanho da fonte deve ser maior que zero.' };
  }

  if (config.copies <= 0) {
    return { ok: false, message: 'A quantidade de cópias deve ser maior que zero.' };
  }

  if (config.location_font_size <= 0) {
    return {
      ok: false,
      message: 'O tamanho da fonte da localização deve ser maior que zero.',
    };
  }

  return { ok: true };
}
