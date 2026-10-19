// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReport.utils.js — Helpers de datas do relatório            ║
// ╚════════════════════════════════════════════════════════════════════╝

// ---------------------------------------------------------------------
// Helpers de datas
// ---------------------------------------------------------------------

export function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDateIso: start.toISOString(),
    endDateIso: end.toISOString()
  };
}
