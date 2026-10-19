// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetailsgaqlFeatureGuard.js — GAQL Feature Guard     ║
// ║ CONSART ERP | ESM                                                   ║
// ║ - Auto-disable se GAQL retornar "Unrecognized field(s)"              ║
// ║ - Evita quebrar /full quando algum report não é suportado            ║
// ╚══════════════════════════════════════════════════════════════════════╝

const state = new Map(); // key: `${customerId}:${feature}` -> { enabled, lastError, lastAt }

function k(customerId, feature) {
  return `${String(customerId || '')}:${String(feature || '')}`;
}

function isUnrecognizedFieldError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('unrecognized field') ||
    msg.includes('unrecognized fields') ||
    msg.includes('unrecognized') && msg.includes('field')
  );
}

function setDisabled(customerId, feature, err) {
  state.set(k(customerId, feature), {
    enabled: false,
    lastError: String(err?.message || err || ''),
    lastAt: new Date().toISOString(),
  });
}

function ensureEntry(customerId, feature) {
  const key = k(customerId, feature);
  if (!state.has(key)) state.set(key, { enabled: true, lastError: null, lastAt: null });
  return state.get(key);
}

async function query(customerId, feature, customer, gaql) {
  const entry = ensureEntry(customerId, feature);
  if (entry.enabled === false) return [];

  try {
    return await customer.query(gaql);
  } catch (err) {
    if (isUnrecognizedFieldError(err)) {
      setDisabled(customerId, feature, err);
      return [];
    }
    throw err;
  }
}

function isEnabled(customerId, feature) {
  const entry = ensureEntry(customerId, feature);
  return entry.enabled !== false;
}

function debugState(customerId) {
  const out = {};
  for (const [key, value] of state.entries()) {
    if (!customerId || String(key).startsWith(`${customerId}:`)) out[key] = value;
  }
  return out;
}

export default {
  query,
  isEnabled,
  debugState,
};
