// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfig.sanitizers.js — Normalização e validação           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
}

export function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeText(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).trim();
}

export function normalizePayload(payload = {}) {
  const normalized = {};

  if ('width_mm' in payload) normalized.width_mm = normalizeNumber(payload.width_mm);
  if ('height_mm' in payload) normalized.height_mm = normalizeNumber(payload.height_mm);
  if ('margin_mm' in payload) normalized.margin_mm = normalizeNumber(payload.margin_mm, 0);

  if ('orientation' in payload) {
    normalized.orientation = normalizeText(payload.orientation, 'portrait');
  }

  if ('barcode_height' in payload) {
    normalized.barcode_height = normalizeNumber(payload.barcode_height);
  }

  if ('font_size_pt' in payload) {
    normalized.font_size_pt = normalizeNumber(payload.font_size_pt);
  }

  if ('barcode_type' in payload) {
    normalized.barcode_type = normalizeText(payload.barcode_type, 'CODE128');
  }

  if ('copies' in payload) {
    normalized.copies = normalizeNumber(payload.copies, 1);
  }

  if ('paper' in payload) {
    normalized.paper = normalizeText(payload.paper, 'custom');
  }

  if ('show_label_text' in payload) {
    normalized.show_label_text = normalizeBoolean(payload.show_label_text, true);
  }

  if ('show_location' in payload) {
    normalized.show_location = normalizeBoolean(payload.show_location, true);
  }

  if ('location_font_size' in payload) {
    normalized.location_font_size = normalizeNumber(payload.location_font_size, 7);
  }

  if ('show_id' in payload) {
    normalized.show_id = normalizeBoolean(payload.show_id, false);
  }

  return normalized;
}

export function validatePayload(payload) {
  if ('width_mm' in payload && payload.width_mm <= 0) {
    throw new Error('O campo "width_mm" deve ser maior que zero.');
  }

  if ('height_mm' in payload && payload.height_mm <= 0) {
    throw new Error('O campo "height_mm" deve ser maior que zero.');
  }

  if ('margin_mm' in payload && payload.margin_mm < 0) {
    throw new Error('O campo "margin_mm" não pode ser negativo.');
  }

  if ('barcode_height' in payload && payload.barcode_height <= 0) {
    throw new Error('O campo "barcode_height" deve ser maior que zero.');
  }

  if ('font_size_pt' in payload && payload.font_size_pt <= 0) {
    throw new Error('O campo "font_size_pt" deve ser maior que zero.');
  }

  if ('copies' in payload && payload.copies <= 0) {
    throw new Error('O campo "copies" deve ser maior que zero.');
  }

  if ('location_font_size' in payload && payload.location_font_size <= 0) {
    throw new Error('O campo "location_font_size" deve ser maior que zero.');
  }
}
