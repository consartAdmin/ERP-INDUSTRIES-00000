// ╔════════════════════════════════════════════════════════════════════╗
// ║ dreGerencial.utils.js — Helpers puros (número, mês, IRPJ/CSLL)     ║
// ╚════════════════════════════════════════════════════════════════════╝

export function toNum(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function monthRange(month) {
  const ref = String(month || '').trim();

  if (!/^\d{4}-\d{2}$/.test(ref)) {
    throw new Error('Informe o mês no formato YYYY-MM');
  }

  const start = `${ref}-01`;
  const endDate = new Date(`${start}T00:00:00`);
  endDate.setMonth(endDate.getMonth() + 1);

  return {
    start,
    end: endDate.toISOString().slice(0, 10),
  };
}

export function calcIrpjCsll(baseLucro) {
  const lucro = Math.max(0, toNum(baseLucro));

  const irpjBase = lucro * 0.15;
  const irpjAdicional = Math.max(0, lucro - 20000) * 0.10;
  const irpj = irpjBase + irpjAdicional;
  const csll = lucro * 0.09;

  return {
    irpj: Number(irpj.toFixed(2)),
    csll: Number(csll.toFixed(2)),
    total: Number((irpj + csll).toFixed(2)),
  };
}
