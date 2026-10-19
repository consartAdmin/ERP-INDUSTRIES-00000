    // ╔══════════════════════════════════════════════════════════════════════╗
    // ║ reportsProductsStock.bootstrap.js — Bootstrap                       ║
    // ╚══════════════════════════════════════════════════════════════════════╝

    'use strict';

    import { getEls } from './reportsProductsStock.dom.js';
    import { state } from './reportsProductsStock.state.js';
    import { loadRows, downloadPdf, downloadExcel } from './reportsProductsStock.api.js';
    import { loadGroups, loadBrands } from './reportsProductsStock.lookups.js';
    import { bindFilters } from './reportsProductsStock.filters.js';
    import { mapRow, sortRows, renderTable } from './reportsProductsStock.table.js';
    import { renderPagination, setFooter } from './reportsProductsStock.pagination.js';
    import { sanitize } from './reportsProductsStock.utils.js';

    function setStatus(msg, type = 'info') {
    const els = getEls();
    if (!els.statusArea) return;
    els.statusArea.textContent = msg || '';
    els.statusArea.dataset.type = type;
    }

async function load() {
  try {
    if (state.loading) state.aborter?.abort?.();
    state.aborter = new AbortController();
    state.loading = true;

    setStatus('Carregando...', 'info');
    setFooter({ total: null, page: null, pages: null, sumStock: null, sumCost: null });

    const api = await loadRows();
    const mapped = api.rows.map(mapRow);

    const sorted = sortRows(mapped, state.order);

    const sumStockFromApi = Number(api?.summary?.sum_stock);
    const sumCostFromApi = Number(api?.summary?.sum_cost);

    const pageSumStock = sorted.reduce((acc, r) => acc + (Number(r.stock) || 0), 0);
    const pageSumCost = sorted.reduce((acc, r) => acc + (Number(r.total) || 0), 0);

    renderTable(sorted);

    renderPagination({
      total: api.total,
      page: api.page,
      limit: api.limit,
      onPageChange: (p) => {
        state.page = p;
        load();
      },
    });

    const pages = Math.max(Math.ceil((api.total || 0) / (api.limit || 1)), 1);

    setFooter({
      total: api.total,
      page: api.page,
      pages,
      sumStock: Number.isFinite(sumStockFromApi) ? sumStockFromApi : pageSumStock,
      sumCost: Number.isFinite(sumCostFromApi) ? sumCostFromApi : pageSumCost,
    });

    setStatus(`${api.total} item(ns) carregado(s).`, 'success');
  } catch (err) {
    console.error('[reportsProductsStock] load error:', err);
    setStatus(`Erro: ${err.message || err}`, 'error');
    setFooter({ total: null, page: null, pages: null, sumStock: null, sumCost: null });
  } finally {
    state.loading = false;
  }
}

    async function bootstrapLookups() {
    const els = getEls();

    try {
        const groups = await loadGroups();
        if (els.selGrupo) {
        els.selGrupo.innerHTML =
            '<option value="">Todos</option>' +
            groups.map(g => `<option value="${sanitize(g.id)}">${sanitize(g.name)}</option>`).join('');
        }
    } catch (e) {
        console.warn('[groups] falhou:', e);
    }

    try {
        const brands = await loadBrands();
        if (els.selMarca) {
        els.selMarca.innerHTML =
            '<option value="">Todas</option>' +
            brands.map(b => `<option value="${sanitize(b.id)}">${sanitize(b.name)}</option>`).join('');
        }
    } catch (e) {
        console.warn('[brands] falhou:', e);
    }
    }

    function bindExports() {
    const els = getEls();

    els.btnPdf?.addEventListener('click', async () => {
        try {
        setStatus('Gerando PDF...', 'info');
        const blob = await downloadPdf();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `posicao_estoque_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('PDF gerado com sucesso.', 'success');
        } catch (err) {
        setStatus(`Falha ao gerar PDF: ${err.message || err}`, 'error');
        }
    });

    els.btnExcel?.addEventListener('click', async () => {
        try {
        setStatus('Gerando Excel...', 'info');
        const blob = await downloadExcel();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `posicao_estoque_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('Excel exportado com sucesso.', 'success');
        } catch (err) {
        setStatus(`Falha ao exportar Excel: ${err.message || err}`, 'error');
        }
    });
    }

    export async function bootstrapReportsProductsStock() {
    bindFilters(load);
    bindExports();
    await bootstrapLookups();
    await load();
    }