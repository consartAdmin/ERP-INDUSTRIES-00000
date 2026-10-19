// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.sanitizers.js — Normalização e validação            ║
// ║ Inclui layout_json (designer visual de etiquetas)                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ======================================================================
   NORMALIZATION
   ====================================================================== */

export function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function normalizeNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = parseInt(String(value), 10);
  return Number.isInteger(n) ? n : fallback;
}

export function parseLayoutJson(raw) {
  if (!raw) {
    return {
      version: 1,
      elements: [],
    };
  }

  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.warn('[labelParametersApi] Invalid layout_json, using default.', err);
    return {
      version: 1,
      elements: [],
    };
  }
}

export function sanitizeDesignerElement(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  const align = ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left';
  const weight = String(raw.weight || '400');

  return {
    id: String(raw.id || `el_${Date.now()}_${index}`),
    type: String(raw.type || 'custom'),
    key: String(raw.key || raw.type || 'custom'),
    text: String(raw.text ?? ''),
    x: normalizeNumber(raw.x, 0),
    y: normalizeNumber(raw.y, 0),
    w: Math.max(2, normalizeNumber(raw.w, 20)),
    h: Math.max(2, normalizeNumber(raw.h, 5)),
    fontSize: Math.max(3, normalizeNumber(raw.fontSize, 6)),
    align,
    weight,
    visible: normalizeBoolean(raw.visible, true),
  };
}

export function normalizeLayoutJson(raw) {
  const parsed = parseLayoutJson(raw);

  const elements = Array.isArray(parsed?.elements)
    ? parsed.elements.map(sanitizeDesignerElement).filter(Boolean)
    : [];

  return {
    version: normalizeInteger(parsed?.version, 1) || 1,
    elements,
  };
}

export function normalizePayload(payload = {}) {
  const normalized = {};

  if ('user_id' in payload) {
    normalized.user_id = normalizeInteger(payload.user_id, null);
  }

  if ('name' in payload) {
    normalized.name = String(payload.name ?? '').trim();
  }

  if ('page_width_mm' in payload) {
    normalized.page_width_mm = normalizeNumber(payload.page_width_mm, null);
  }

  if ('page_height_mm' in payload) {
    normalized.page_height_mm = normalizeNumber(payload.page_height_mm, null);
  }

  if ('label_width_mm' in payload) {
    normalized.label_width_mm = normalizeNumber(payload.label_width_mm, null);
  }

  if ('label_height_mm' in payload) {
    normalized.label_height_mm = normalizeNumber(payload.label_height_mm, null);
  }

  if ('active' in payload) {
    normalized.active = normalizeBoolean(payload.active, true);
  }

  if ('layout_json' in payload) {
    normalized.layout_json = normalizeLayoutJson(payload.layout_json);
  }

  return normalized;
}

/* ======================================================================
   VALIDATION
   ====================================================================== */

export function validateCreatePayload(payload) {
  if (!payload.name) {
    throw new Error('O campo "name" é obrigatório.');
  }

  if (payload.page_width_mm == null) {
    throw new Error('O campo "page_width_mm" é obrigatório.');
  }

  if (payload.page_height_mm == null) {
    throw new Error('O campo "page_height_mm" é obrigatório.');
  }

  if (payload.label_width_mm == null) {
    throw new Error('O campo "label_width_mm" é obrigatório.');
  }

  if (payload.label_height_mm == null) {
    throw new Error('O campo "label_height_mm" é obrigatório.');
  }

  if (!payload.layout_json || !Array.isArray(payload.layout_json.elements)) {
    throw new Error('O campo "layout_json" é obrigatório e deve conter um layout válido.');
  }
}

export function validateUpdatePayload(payload) {
  if ('name' in payload && !String(payload.name || '').trim()) {
    throw new Error('O campo "name" não pode ficar vazio.');
  }

  if ('layout_json' in payload) {
    if (!payload.layout_json || !Array.isArray(payload.layout_json.elements)) {
      throw new Error('O campo "layout_json" deve conter um layout válido.');
    }
  }
}
