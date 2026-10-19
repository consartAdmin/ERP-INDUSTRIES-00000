// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryRouteStops.sanitizers.js — Validação/normalização          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

export function cleanText(v, maxLen = null) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return maxLen && s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function normalizeMovementType(v, d = 'delivery') {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'pickup' || s === 'delivery') return s;
  return d;
}

export function normalizeLinkedType(v, d = 'other') {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'customer' || s === 'supplier' || s === 'other') return s;
  return d;
}

export function normalizeStatus(v, d = 'pending') {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'done' || s === 'canceled') return s;
  return d;
}

export function normalizeDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

export function normalizeTime(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

export function coerceByLinkedType(data = {}) {
  const linked_type = normalizeLinkedType(data.linked_type, 'other');

  const out = {
    route_id: toInt(data.route_id, null),
    stop_order: toInt(data.stop_order, null),
    movement_type: normalizeMovementType(data.movement_type, 'delivery'),
    linked_type,

    customer_id: data.customer_id != null ? toInt(data.customer_id, null) : null,
    supplier_id: data.supplier_id != null ? toInt(data.supplier_id, null) : null,

    name: cleanText(data.name, 255),
    tax_id: cleanText(data.tax_id, 32),
    address: cleanText(data.address, 500),
    city: cleanText(data.city, 120),
    region: cleanText(data.region, 120),
    contact_name: cleanText(data.contact_name, 255),
    phone: cleanText(data.phone, 50),
    notes: data.notes ?? null,
    expected_date: normalizeDate(data.expected_date),
    expected_time: normalizeTime(data.expected_time),
    status: normalizeStatus(data.status, 'pending'),
  };

  if (linked_type === 'customer') {
    out.supplier_id = null;
  } else if (linked_type === 'supplier') {
    out.customer_id = null;
  } else {
    out.customer_id = null;
    out.supplier_id = null;
  }

  return out;
}
