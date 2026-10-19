// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelPrintConfig.js — Frontend Label Print Config                   ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║ API: /api/label-print-config                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const toast = {
  success: (title, message) =>
    showCenterModal({ variant: 'success', title, message, timeoutMs: 3500 }),
  error: (title, message) =>
    showCenterModal({ variant: 'error', title, message }),
  warn: (title, message) =>
    showCenterModal({ variant: 'warning', title, message }),
  info: (title, message) =>
    showCenterModal({ variant: 'info', title, message, timeoutMs: 3200 }),
};

const API_BASE =
  (typeof window !== 'undefined' && (window.API_BASE || window.apiBase)) || '';

const ROUTES = Object.freeze({
  base: `${API_BASE}/api/label-print-config`,
  reset: `${API_BASE}/api/label-print-config/reset`,
});

const DEFAULT_CONFIG = Object.freeze({
  width_mm: 80,
  height_mm: 40,
  margin_mm: 2,
  orientation: 'portrait',
  barcode_height: 40,
  font_size_pt: 8,
  barcode_type: 'CODE128',
  copies: 1,
  paper: 'custom',
  show_label_text: true,
  show_location: true,
  location_font_size: 7,
  show_id: false,
});

const FIELD_IDS = [
  'width_mm',
  'height_mm',
  'margin_mm',
  'orientation',
  'barcode_height',
  'font_size_pt',
  'barcode_type',
  'copies',
  'paper',
  'show_label_text',
  'show_location',
  'location_font_size',
  'show_id',
];

const $ = (selector) => document.querySelector(selector);

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  applyConfig(DEFAULT_CONFIG);
  updatePreview();
  loadConfig();
});

function cacheElements() {
  FIELD_IDS.forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.btnSave = $('#btnSave');
  els.btnReset = $('#btnReset');
  els.loadingOverlay = $('#loadingOverlay');

  els.labelPreview = $('#labelPreview');
  els.previewBarcode = $('#previewBarcode');
  els.previewName = $('#previewName');
  els.previewLocation = $('#previewLocation');
  els.previewId = $('#previewId');
}

function bindEvents() {
  FIELD_IDS.forEach((id) => {
    const el = els[id];
    if (!el) return;

    el.addEventListener('input', updatePreview);
    el.addEventListener('change', updatePreview);
  });

  els.btnSave?.addEventListener('click', saveConfig);
  els.btnReset?.addEventListener('click', resetConfig);
}

async function loadConfig() {
  setLoading(true);

  try {
    const data = await apiRequest(ROUTES.base, { method: 'GET' });

    const config = normalizeConfig(data);
    applyConfig({ ...DEFAULT_CONFIG, ...config });
    updatePreview();
  } catch (err) {
    console.error('[labelPrintConfig] loadConfig error:', err);
    toast.warn(
      'Configuração não carregada',
      'Não foi possível carregar a configuração. O padrão local foi aplicado.'
    );
  } finally {
    setLoading(false);
  }
}

async function saveConfig() {
  const payload = collectConfig();

  const validation = validateConfig(payload);
  if (!validation.ok) {
    toast.warn('Validação', validation.message);
    return;
  }

  setLoading(true);

  try {
    const saved = await apiRequest(ROUTES.base, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    applyConfig(normalizeConfig(saved));
    updatePreview();

    toast.success('Configuração salva', 'A configuração da etiqueta foi salva com sucesso.');
  } catch (err) {
    console.error('[labelPrintConfig] saveConfig error:', err);
    toast.error('Erro ao salvar', err.message || 'Não foi possível salvar a configuração.');
  } finally {
    setLoading(false);
  }
}

async function resetConfig() {
  const confirmed = window.confirm('Deseja restaurar a configuração padrão da etiqueta?');
  if (!confirmed) return;

  setLoading(true);

  try {
    const reseted = await apiRequest(ROUTES.reset, {
      method: 'POST',
    });

    applyConfig(normalizeConfig(reseted));
    updatePreview();

    toast.success('Configuração restaurada', 'Os parâmetros padrão foram aplicados.');
  } catch (err) {
    console.error('[labelPrintConfig] resetConfig error:', err);
    toast.error('Erro ao restaurar', err.message || 'Não foi possível restaurar a configuração.');
  } finally {
    setLoading(false);
  }
}

function collectConfig() {
  return {
    width_mm: toNumber(els.width_mm?.value, DEFAULT_CONFIG.width_mm),
    height_mm: toNumber(els.height_mm?.value, DEFAULT_CONFIG.height_mm),
    margin_mm: toNumber(els.margin_mm?.value, DEFAULT_CONFIG.margin_mm),
    orientation: els.orientation?.value || DEFAULT_CONFIG.orientation,

    barcode_height: toNumber(
      els.barcode_height?.value,
      DEFAULT_CONFIG.barcode_height
    ),

    font_size_pt: toNumber(
      els.font_size_pt?.value,
      DEFAULT_CONFIG.font_size_pt
    ),

    barcode_type: els.barcode_type?.value || DEFAULT_CONFIG.barcode_type,
    copies: toNumber(els.copies?.value, DEFAULT_CONFIG.copies),
    paper: els.paper?.value || DEFAULT_CONFIG.paper,

    show_label_text: Boolean(els.show_label_text?.checked),
    show_location: Boolean(els.show_location?.checked),

    location_font_size: toNumber(
      els.location_font_size?.value,
      DEFAULT_CONFIG.location_font_size
    ),

    show_id: Boolean(els.show_id?.checked),
  };
}

function applyConfig(config = {}) {
  FIELD_IDS.forEach((id) => {
    const el = els[id];
    if (!el) return;

    const value = config[id];

    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
      return;
    }

    if (value !== undefined && value !== null) {
      el.value = value;
    }
  });
}

function normalizeConfig(raw = {}) {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : raw;

  return {
    width_mm: toNumber(data.width_mm, DEFAULT_CONFIG.width_mm),
    height_mm: toNumber(data.height_mm, DEFAULT_CONFIG.height_mm),
    margin_mm: toNumber(data.margin_mm, DEFAULT_CONFIG.margin_mm),
    orientation: String(data.orientation || DEFAULT_CONFIG.orientation),

    barcode_height: toNumber(
      data.barcode_height,
      DEFAULT_CONFIG.barcode_height
    ),

    font_size_pt: toNumber(
      data.font_size_pt,
      DEFAULT_CONFIG.font_size_pt
    ),

    barcode_type: String(data.barcode_type || DEFAULT_CONFIG.barcode_type),
    copies: toNumber(data.copies, DEFAULT_CONFIG.copies),
    paper: String(data.paper || DEFAULT_CONFIG.paper),

    show_label_text: toBoolean(
      data.show_label_text,
      DEFAULT_CONFIG.show_label_text
    ),

    show_location: toBoolean(
      data.show_location,
      DEFAULT_CONFIG.show_location
    ),

    location_font_size: toNumber(
      data.location_font_size,
      DEFAULT_CONFIG.location_font_size
    ),

    show_id: toBoolean(data.show_id, DEFAULT_CONFIG.show_id),
  };
}

function validateConfig(config) {
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
    return { ok: false, message: 'A altura do código de barras deve ser maior que zero.' };
  }

  if (config.font_size_pt <= 0) {
    return { ok: false, message: 'O tamanho da fonte deve ser maior que zero.' };
  }

  if (config.copies <= 0) {
    return { ok: false, message: 'A quantidade de cópias deve ser maior que zero.' };
  }

  if (config.location_font_size <= 0) {
    return { ok: false, message: 'O tamanho da fonte da localização deve ser maior que zero.' };
  }

  return { ok: true };
}

function updatePreview() {
  const config = collectConfig();

  const widthPx = mmToPx(config.width_mm);
  const heightPx = mmToPx(config.height_mm);
  const marginPx = mmToPx(config.margin_mm);

  if (els.labelPreview) {
    els.labelPreview.style.width = `${Math.min(Math.max(widthPx, 160), 460)}px`;
    els.labelPreview.style.minHeight = `${Math.min(Math.max(heightPx, 90), 280)}px`;
    els.labelPreview.style.padding = `${Math.max(marginPx, 6)}px`;

    els.labelPreview.style.aspectRatio =
      config.orientation === 'landscape'
        ? `${Math.max(config.width_mm, config.height_mm)} / ${Math.min(config.width_mm, config.height_mm)}`
        : `${config.width_mm} / ${config.height_mm}`;
  }

  if (els.previewBarcode) {
    els.previewBarcode.textContent = getBarcodeMock(config.barcode_type);
    els.previewBarcode.style.fontSize = `${Math.max(config.barcode_height / 2.2, 14)}px`;
  }

  if (els.previewName) {
    els.previewName.style.display = config.show_label_text ? 'block' : 'none';
    els.previewName.style.fontSize = `${config.font_size_pt}px`;
  }

  if (els.previewLocation) {
    els.previewLocation.style.display = config.show_location ? 'block' : 'none';
    els.previewLocation.style.fontSize = `${config.location_font_size}px`;
  }

  if (els.previewId) {
    els.previewId.style.display = config.show_id ? 'block' : 'none';
  }
}

function getBarcodeMock(type) {
  const map = {
    QR: '▦ ▦ ▦ ▦ ▦',
    EAN13: '7891234567890',
    EAN8: '78912345',
    UPC: '012345678905',
    CODE39: 'CODE-39-123',
    CODE128: '████████████████████████',
  };

  return map[type] || map.CODE128;
}

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      typeof data === 'object'
        ? data.error || data.message || `HTTP ${res.status}`
        : data || `HTTP ${res.status}`;

    throw new Error(message);
  }

  return data;
}

function setLoading(active) {
  els.loadingOverlay?.classList.toggle('hidden', !active);
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  return ['true', '1', 'yes', 'y', 'sim', 's'].includes(
    String(value).toLowerCase()
  );
}

function mmToPx(mm) {
  return Number(mm) * 3.7795275591;
}