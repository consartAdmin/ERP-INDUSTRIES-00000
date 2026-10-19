// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.filters.js — Filtros da listagem             ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

export function buildFilters(elements) {
  return {
    q: elements.filtroBusca.value.trim(),
    status: elements.filtroStatus.value.trim()
  };
}

