/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.form.js — Formulário e filtros | PRODNEX ERP (ESM)     ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

/**
 * Lê o período selecionado.
 *
 * Fonte principal: <date-range-field id="nfi-periodo">, que expõe
 * { startDate, endDate } em ISO (YYYY-MM-DD).
 *
 * Fallback: inputs nativos #dataIni / #dataFim, usados caso o custom
 * element não tenha sido registrado (script ausente ou falha de upgrade).
 */
export function getPeriodo(dom) {
  const range = dom.$periodo?.value;

  if (range && typeof range === 'object') {
    return {
      dataIni: range.startDate || '',
      dataFim: range.endDate || '',
    };
  }

  return {
    dataIni: dom.$dataIni?.value || '',
    dataFim: dom.$dataFim?.value || '',
  };
}

export function buildFilterParams(dom, state, { paginate = true } = {}) {
  const params = new URLSearchParams();
  const { dataIni, dataFim } = getPeriodo(dom);
  const values = {
    situacao: dom.$situacao?.value || '',
    manifestacao: dom.$manifestacao?.value || '',
    dataIni,
    dataFim,
    q: (dom.$q?.value || '').trim(),
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  if (state?.sortColumn) {
    params.set('sort', state.sortColumn);
    params.set('order', state.sortDirection === 'desc' ? 'desc' : 'asc');
  }

  if (paginate) {
    params.set('limit', String(state.pageSize));
    params.set('offset', String((state.currentPage - 1) * state.pageSize));
  }
  return params;
}

export function clearFilters(dom) {
  [dom.$situacao, dom.$manifestacao, dom.$dataIni, dom.$dataFim, dom.$q]
    .forEach((field) => { if (field) field.value = ''; });

  if (dom.$periodo) {
    // O setter do componente já redesenha o gatilho e o calendário.
    dom.$periodo.value = { startDate: '', endDate: '' };
  }
}

export function extractRows(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
  if (Array.isArray(response?.result?.items)) return response.result.items;
  if (Array.isArray(response?.result?.rows)) return response.result.rows;
  return [];
}

export function extractTotal(response, rows = []) {
  const candidates = [
    response?.total,
    response?.count,
    response?.totalCount,
    response?.total_count,
    response?.totalRecords,
    response?.total_records,
    response?.totalRegistros,
    response?.total_registros,
    response?.recordsTotal,
    response?.totalRows,
    response?.total_rows,
    response?.totalItems,
    response?.total_items,

    response?.pagination?.total,
    response?.pagination?.count,
    response?.pagination?.totalRecords,
    response?.pagination?.totalItems,

    response?.meta?.total,
    response?.meta?.count,
    response?.meta?.totalRecords,
    response?.meta?.totalItems,

    response?.result?.total,
    response?.result?.count,
    response?.result?.totalRecords,
    response?.result?.totalItems,

    response?.data?.total,
    response?.data?.count,
    response?.data?.totalRecords,
    response?.data?.totalItems,
  ];

  for (const candidate of candidates) {
    if (
      candidate === null ||
      candidate === undefined ||
      candidate === ''
    ) {
      continue;
    }

    const total = Number(candidate);

    if (Number.isFinite(total) && total >= 0) {
      return total;
    }
  }

  return rows.length;
}
