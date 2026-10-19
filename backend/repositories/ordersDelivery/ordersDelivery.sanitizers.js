// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDelivery.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toMoney(v, def = 0) {
  if (v === null || v === undefined || v === '') return Number(def);
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number(def);

  // aceita "1.234,56" e "1234.56"
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : Number(def);
}

export function validateFreightMode(mode) {
  const m = toInt(mode);
  if (m === null) return 9;
  if (![0, 1, 2, 3, 4, 9].includes(m)) throw new Error('freight_mode inválido');
  return m;
}

export function normalizePayload(p = {}) {
  const freight_value = toMoney(p.freight_value ?? p.frete ?? 0, 0);
  const freight_mode = validateFreightMode(
    p.freight_mode ?? (freight_value > 0 ? 0 : 9)
  );

  const carrier_cnpj_cpf =
    p.carrier_cnpj_cpf != null ? String(p.carrier_cnpj_cpf).replace(/\D/g, '') : null;

  const carrier_uf =
    p.carrier_uf != null
      ? String(p.carrier_uf).trim().toUpperCase()
      : p.carrier_state != null
        ? String(p.carrier_state).trim().toUpperCase()
        : null;

  const vehicle_uf =
    p.vehicle_uf != null
      ? String(p.vehicle_uf).trim().toUpperCase()
      : p.vehicle_state != null
        ? String(p.vehicle_state).trim().toUpperCase()
        : null;

  return {
    freight_mode,
    freight_value,

    carrier_name: p.carrier_name ?? null,
    carrier_cnpj_cpf: carrier_cnpj_cpf || null,
    carrier_ie: p.carrier_ie ?? null,
    carrier_address: p.carrier_address ?? null,
    carrier_city: p.carrier_city ?? null,
    carrier_uf: carrier_uf || null,

    antt_code: p.antt_code ?? p.vehicle_rntc ?? null,
    vehicle_plate: p.vehicle_plate ?? null,
    vehicle_uf: vehicle_uf || null,

    volume_quantity: p.volume_quantity ?? p.volumes ?? null,
    volume_species: p.volume_species ?? null,
    volume_brand: p.volume_brand ?? null,
    volume_numbering: p.volume_numbering ?? null,

    gross_weight: p.gross_weight ?? null,
    net_weight: p.net_weight ?? null,
  };
}
