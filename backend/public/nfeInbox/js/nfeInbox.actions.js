/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.actions.js — Ações do módulo | PRODNEX ERP (ESM)       ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import * as api from './nfeInbox.api.js';
import { IMPORT_BATCH_SIZE, INBOUND_ENTRY_PAGE } from './nfeInbox.config.js';
import { buildFilterParams, extractRows, extractTotal, getPeriodo } from './nfeInbox.form.js';
import { notify } from './nfeInbox.modal.js';
import { renderSyncInfo, renderTable, selectRow, setLoading, setSelected, setSyncRunning, updatePagination } from './nfeInbox.render.js';
import { cssEscape, downloadBlob, getFilenameFromDisposition } from './nfeInbox.utils.js';
import { getSelectedRow, validateFilters, validateManifest, validateSelectedRow, validateXmlFiles } from './nfeInbox.validation.js';

export function createActions(dom, state, modals) {
  async function openDetail(id) {
    try {
      const response = await api.getInboxById(id);
      modals.fillDetail(response.data || response.item || response);
      modals.showDetail();
    } catch (error) {
      console.error('[nfeInbox] openDetail:', error);
      notify(error.message || 'Erro ao carregar detalhes da NF-e.', 'error');
    }
  }

  async function loadInbox() {
    const validationError = validateFilters(dom);
    if (validationError) return notify(validationError, 'error');

    try {
      setLoading(dom, state, true);
      const response = await api.getInboxList(buildFilterParams(dom, state));
      const rows = extractRows(response);
      state.currentRows = rows;
      state.lastBatchSize = rows.length;
      state.total = extractTotal(response, rows);

      // Backends sem total explícito ainda podem informar que existe próxima página.
      // Mantém a navegação habilitada sem inventar o total definitivo.
      const hasNextPage = Boolean(
        response?.hasNext ??
        response?.has_next ??
        response?.hasMore ??
        response?.has_more ??
        response?.pagination?.hasNext ??
        response?.pagination?.has_next ??
        response?.meta?.hasNext ??
        response?.meta?.has_next
      );
      if (hasNextPage && state.total <= state.currentPage * state.pageSize) {
        state.total = state.currentPage * state.pageSize + 1;
      }

      state.totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));

      if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
        return loadInbox();
      }



      renderTable(dom, state, rows, {
        // Um clique: somente seleciona a linha e habilita os botões.
        onSelect: (row) => {
          selectRow(dom, state, row);
        },

        // Dois cliques: seleciona a linha e abre o modal de detalhes.
        onOpenDetail: (row, item) => {
          selectRow(dom, state, row);

          const id = item?.id || row.dataset.id;

          if (!id) {
            notify(
              'Não foi possível identificar a NF-e selecionada.',
              'error'
            );
            return;
          }

          openDetail(id);
        },
      });
      updatePagination(dom, state);

      if (state.selectedId) {
        const row = dom.$tbody?.querySelector(`tr[data-id="${cssEscape(state.selectedId)}"]`);
        if (row) selectRow(dom, state, row);
        else setSelected(dom, state, null);
      } else {
        setSelected(dom, state, null);
      }
    } catch (error) {
      console.error('[nfeInbox] loadInbox:', error);
      state.currentRows = [];
      state.total = 0;
      state.lastBatchSize = 0;
      renderTable(dom, state, []);
      updatePagination(dom, state);
      notify(error.message || 'Erro ao carregar a caixa de entrada de NF-e.', 'error');
    } finally {
      setLoading(dom, state, false);
    }
  }

  async function downloadXmlSelected() {
    const { error, row } = validateSelectedRow(dom, state);
    if (error) return notify(error, 'info');
    try {
      if (dom.$btnDownloadXml) {
        dom.$btnDownloadXml.disabled = true;
        dom.$btnDownloadXml.textContent = '⏳ Baixando XML...';
      }
      const xml = await api.getXmlById(row.dataset.id);
      downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }),
        `NFe-${row.dataset.accessKey || `id-${row.dataset.id}`}.xml`);
      notify('XML baixado com sucesso.', 'success');
    } catch (downloadError) {
      console.error('[nfeInbox] downloadXmlSelected:', downloadError);
      notify(downloadError.message || 'Erro ao baixar XML.', 'error');
    } finally {
      if (dom.$btnDownloadXml) {
        dom.$btnDownloadXml.disabled = !state.selectedId;
        dom.$btnDownloadXml.textContent = '📄 Baixar XML';
      }
    }
  }

  async function downloadPdfSelected() {
    const { error, row } = validateSelectedRow(dom, state);
    if (error) return notify(error, 'info');
    try {
      if (dom.$btnDownloadPdf) {
        dom.$btnDownloadPdf.disabled = true;
        dom.$btnDownloadPdf.textContent = '⏳ Gerando PDF...';
      }
      const { response, blob } = await api.getPdfById(row.dataset.id);
      const headerName = getFilenameFromDisposition(response.headers.get('Content-Disposition') || '');
      downloadBlob(blob, headerName || `DANFE-${row.dataset.accessKey || `id-${row.dataset.id}`}.pdf`);
      notify('PDF (DANFE) baixado com sucesso.', 'success');
    } catch (downloadError) {
      console.error('[nfeInbox] downloadPdfSelected:', downloadError);
      notify(downloadError.message || 'Erro ao gerar ou baixar PDF.', 'error');
    } finally {
      if (dom.$btnDownloadPdf) {
        dom.$btnDownloadPdf.disabled = !state.selectedId;
        dom.$btnDownloadPdf.textContent = '🧾 Baixar PDF';
      }
    }
  }

  async function manifestSelected() {
    const { error, row, operation } = validateManifest(dom, state);
    if (error) return notify(error, 'info');
    if (!window.confirm(`Confirmar manifestação: ${operation}?`)) return;

    try {
      if (dom.$btnManifest) {
        dom.$btnManifest.disabled = true;
        dom.$btnManifest.textContent = '⏳ Manifestando...';
      }
      await api.postManifest(row.dataset.id, operation);
      notify('Manifestação enviada com sucesso.', 'success');
      // Recarrega a listagem para refletir a nova manifestação. NÃO dispara
      // download: baixar o XML é uma ação explícita do usuário.
      await loadInbox();
    } catch (manifestError) {
      console.error('[nfeInbox] manifestSelected:', manifestError);
      notify(manifestError.message || 'Erro ao manifestar.', 'error');
    } finally {
      if (dom.$btnManifest) {
        dom.$btnManifest.disabled = !state.selectedId;
        dom.$btnManifest.textContent = '🖊️ Manifestar';
      }
    }
  }

  /**
   * Lê o status da última sincronização DF-e e atualiza o rodapé do topo.
   * Falha em silêncio: é informativo e não deve poluir a tela com alertas.
   */
  async function refreshSyncStatus() {
    try {
      const response = await api.getSyncStatus();
      renderSyncInfo(dom, response?.data || {});
    } catch (statusError) {
      console.warn('[nfeInbox] syncStatus:', statusError);
    }
  }

  async function syncDfe() {
    try {
      if (dom.$btnSyncDfe) {
        dom.$btnSyncDfe.disabled = true;
        dom.$btnSyncDfe.textContent = '⏳ Sincronizando...';
      }
      setSyncRunning(dom);
      // O backend resolve o CNPJ por NFE_INBOX_CNPJ_EMPRESA no .env.
      const response = await api.postSyncDfe({});
      const total = response.totalInseridas ?? response.totalAtualizadas ?? response.total ?? 0;
      notify(`Sincronização DF-e concluída. Notas processadas: ${total}.`, 'success');
      state.currentPage = 1;
      await loadInbox();
    } catch (syncError) {
      console.error('[nfeInbox] syncDfe:', syncError);
      notify(syncError.message || 'Erro ao sincronizar DF-e.', 'error');
    } finally {
      if (dom.$btnSyncDfe) {
        dom.$btnSyncDfe.disabled = false;
        dom.$btnSyncDfe.textContent = '🔄 Sincronizar DF-e';
      }
      // Sucesso ou falha, relê o status real publicado pelo backend.
      await refreshSyncStatus();
    }
  }

  async function importXml(event) {
    const { files, error } = validateXmlFiles(event?.target?.files);
    if (error) {
      if (dom.$fileInput) dom.$fileInput.value = '';
      return notify(error, 'error');
    }
    if (!files.length) return;

    let processed = 0;
    try {
      if (dom.$btnImportXml) {
        dom.$btnImportXml.disabled = true;
        dom.$btnImportXml.textContent = 'Enviando XML...';
      }
      for (let index = 0; index < files.length; index += IMPORT_BATCH_SIZE) {
        const batch = files.slice(index, index + IMPORT_BATCH_SIZE);
        const data = new FormData();
        batch.forEach((file) => data.append('files', file, file.name));
        const response = await api.postImportXml(data);
        processed += response.totalInseridas ?? response.totalProcessadas ?? batch.length;
      }
      notify(`Importação concluída. Notas processadas: ${processed}.`, 'success');
      state.currentPage = 1;
      await loadInbox();
    } catch (importError) {
      console.error('[nfeInbox] importXml:', importError);
      notify(importError.message || 'Erro ao importar XML.', 'error');
    } finally {
      if (dom.$btnImportXml) {
        dom.$btnImportXml.disabled = false;
        dom.$btnImportXml.textContent = '⬆️ Importar XML';
      }
      if (dom.$fileInput) dom.$fileInput.value = '';
    }
  }

  async function downloadXmlBatch() {
    if (!state.currentRows.length) return notify('Não há notas na lista para baixar em lote.', 'info');
    try {
      if (dom.$btnDownloadXmlLote) {
        dom.$btnDownloadXmlLote.disabled = true;
        dom.$btnDownloadXmlLote.textContent = '⏳ Gerando ZIP...';
      }
      const params = buildFilterParams(dom, state);
      const { response, blob } = await api.downloadXmlBatch(params);
      const headerName = getFilenameFromDisposition(response.headers.get('Content-Disposition') || '');
      const { dataIni, dataFim } = getPeriodo(dom);
      const filename = headerName || `NFe-XML-LOTE_${dataIni || 'ini'}_a_${dataFim || 'fim'}.zip`;
      downloadBlob(blob, filename);
      notify('ZIP de XML gerado e baixado com sucesso.', 'success');
    } catch (batchError) {
      console.error('[nfeInbox] downloadXmlBatch:', batchError);
      notify(batchError.message || 'Erro ao baixar XML em lote.', 'error');
    } finally {
      if (dom.$btnDownloadXmlLote) {
        dom.$btnDownloadXmlLote.disabled = !state.currentRows.length;
        dom.$btnDownloadXmlLote.textContent = '📄 Baixar XML Lote';
      }
    }
  }

  function openEntry() {
    const row = getSelectedRow(dom, state);
    if (!row) return notify('Selecione uma NF na lista para iniciar a entrada.', 'info');
    modals.fillEntry({
      accessKey: row.dataset.accessKey,
      issuer: row.dataset.emitente,
      total: row.dataset.valorTotal,
    });
    modals.showEntry();
  }

  async function confirmEntry() {
    const row = getSelectedRow(dom, state);
    const entry = modals.getEntryData();
    if (!row || !entry.accessKey || entry.accessKey === '-') {
      return notify('Selecione uma NF válida para iniciar a entrada.', 'error');
    }
    // Valor vem do dataset da linha (número cru da API), não do texto
    // formatado do modal: evita depender do round-trip "R$ 1.015,00" → 1015.
    const rawTotal = Number(row.dataset.valorTotal);
    const total = Number.isFinite(rawTotal) ? rawTotal : entry.total;

    try {
      if (dom.$entryConfirm) dom.$entryConfirm.disabled = true;
      const response = await api.postInboundAutoFromDfe(entry.accessKey, {
        issuerCnpj: row.dataset.emitenteCnpj,
        recipientCnpj: row.dataset.destCnpj,
        total,
        issuerName: entry.issuer,
        inboxId: row.dataset.id || null,
      });
      const invoiceId = response.invoiceId || response.invoice?.id;
      notify('Entrada iniciada com sucesso. A nota foi enviada ao módulo de entrada.', 'success');
      modals.closeEntry();

      if (typeof window.openInboundEntryModal === 'function') {
        window.openInboundEntryModal({
          accessKey: entry.accessKey,
          issuerCnpj: row.dataset.emitenteCnpj,
          recipientCnpj: row.dataset.destCnpj,
          total,
          invoiceId,
          inboxId: row.dataset.id,
        });
      } else {
        const params = new URLSearchParams({ chave: entry.accessKey });
        if (invoiceId) params.set('invoiceId', invoiceId);
        window.location.href = `${INBOUND_ENTRY_PAGE}?${params}`;
      }
    } catch (entryError) {
      console.error('[nfeInbox] confirmEntry:', entryError);
      notify(entryError.message || 'Erro ao iniciar a entrada.', 'error');
    } finally {
      if (dom.$entryConfirm) dom.$entryConfirm.disabled = false;
    }
  }

  return {
    loadInbox,
    openDetail,
    downloadXmlSelected,
    downloadPdfSelected,
    manifestSelected,
    syncDfe,
    refreshSyncStatus,
    importXml,
    downloadXmlBatch,
    openEntry,
    confirmEntry,
  };
}
