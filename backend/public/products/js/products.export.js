// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.export.js — Exportações Excel/PDF                          ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { exportExcel, exportStockPositionPdf } from './products.api.js';
import { getExportButton, getSearchInput, getStockPdfButton, setStatus } from './products.dom.js';

import { state } from './products.state.js';
import { readFiltersFromDom } from './products.search.js';

export function bindExport() {
  const btn = getExportButton();
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      setStatus('Gerando Excel…');
      state.q = (getSearchInput()?.value || '').trim();
      readFiltersFromDom();

      const blob = await exportExcel({
        q: state.q,
        filters: state.filters,
      });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'produtos.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus('Excel exportado com sucesso.', 'success');
    } catch (err) {
      console.error('Export falhou:', err);
      setStatus(`Falha ao exportar Excel: ${err.message || err}`, 'error');
    }
  });
}

export function bindStockPdf() {
  const btn = getStockPdfButton();
  if (!btn) {
    console.warn('[products] Botão #btnPosicaoEstoque não encontrado no HTML.');
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      setStatus('Gerando PDF (Posição de Estoque)…');

      const q = (getSearchInput()?.value || '').trim();
      const blob = await exportStockPositionPdf(q);

      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `posicao_estoque_${yyyy}-${mm}-${dd}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus('PDF gerado com sucesso.', 'success');
    } catch (err) {
      console.error('[products] PDF falhou:', err);
      setStatus(`Falha ao gerar PDF: ${err.message || err}`, 'error');
    }
  });
}