/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.dfe.js — Importar XML direto do módulo DF-e      ║
   ║ PRODNEX ERP | Frontend (ESM)                                     ║
   ║                                                                  ║
   ║ Lista as NF-e da caixa de entrada DF-e, baixa o XML da nota      ║
   ║ escolhida e entrega ao mesmo pipeline do botão "Importar XML".   ║
   ║ Ou seja: abre a prévia para conferência/vínculo de produtos,     ║
   ║ nunca lança estoque automaticamente.                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

const PAGE_SIZE = 50;

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateBR(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatMoneyBR(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function shortenKey(key) {
  const clean = String(key || '').trim();
  if (clean.length !== 44) return clean || '—';

  return `${clean.slice(0, 10)}…${clean.slice(-6)}`;
}

export function initImportFromDfe({ core, ROUTES, state, refs }) {
  const {
    btnImportFromDfe: button,
    dfeModal: modal,
    dfeModalClose: closeButton,
    dfeModalBackdrop: backdrop,
    dfeSearch: search,
    dfeOnlyPending: onlyPending,
    dfeReload: reload,
    dfeTbody: tbody,
    dfeStatus: status,
  } = refs;

  if (!button || !modal || !tbody) {
    console.warn('[INBOUND][DFE] Elementos do modal ausentes; recurso desativado.');
    return;
  }

  let loading = false;
  let rows = [];

  function setStatus(message, tone = 'info') {
    if (!status) return;

    status.textContent = message || '';
    status.dataset.tone = tone;
  }

  // modals.css controla a visibilidade por .is-open, não pelo atributo hidden.
  function openModal() {
    modal.classList.add('is-open');
    document.body.classList.add('inbound-modal-open');
    search?.focus();
    void loadRows();
  }

  function closeModal() {
    modal.classList.remove('is-open');

    // O formulário de edição usa a mesma trava de scroll; só libera
    // quando ele também estiver fechado.
    const editorOpen = document.querySelector('#tab-form')?.hidden === false;
    if (!editorOpen) document.body.classList.remove('inbound-modal-open');
  }

  function renderRows() {
    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="dfe-empty">
            Nenhuma NF-e encontrada na caixa de entrada DF-e.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map((row) => {
        const done = row.entrada_criada === true;
        const key = String(row.chave_nfe || '').trim();
        const action = row.needsManifest
          ? `<button type="button" class="btn btn-toolbar btn-sm" data-dfe-manifest
                     title="Envia a Ciência da Operação à SEFAZ para liberar o XML completo">
                     Manifestar ciência
                   </button>`
          : `<button type="button" class="btn btn-toolbar btn-sm" data-dfe-import>
                     Importar
                   </button>`;

        return `
          <tr data-id="${htmlEscape(row.id)}" data-key="${htmlEscape(key)}">
            <td>${htmlEscape(formatDateBR(row.data_autorizacao || row.data_emissao))}</td>
            <td title="${htmlEscape(key)}">${htmlEscape(shortenKey(key))}</td>
            <td>${htmlEscape(row.numero || '—')}</td>
            <td>${htmlEscape(row.emitente_razao || row.emitente_cnpj || '—')}</td>
            <td class="dfe-col-right">${htmlEscape(formatMoneyBR(row.valor_total))}</td>
            <td>
              ${done
            ? '<span class="dfe-badge dfe-badge--done">Já lançada</span>'
            : action
          }
            </td>
          </tr>
        `;
      })
      .join('');
  }

  async function loadRows() {
    if (loading) return;

    loading = true;
    setStatus('Carregando notas do DF-e...');
    tbody.innerHTML = '<tr><td colspan="6" class="dfe-empty">Carregando…</td></tr>';

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: '0',
        sort: 'data_autorizacao',
        order: 'desc',
      });

      const term = String(search?.value || '').trim();
      if (term) params.set('q', term);

      const response = await fetch(`${ROUTES.nfeInboxList()}?${params}`);
      const json = await response.json().catch(() => ({}));

      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || `Erro HTTP ${response.status}.`);
      }

      const allRows = Array.isArray(json?.data) ? json.data : [];

      rows = onlyPending?.checked
        ? allRows.filter((row) => row.entrada_criada !== true)
        : allRows;

      renderRows();

      setStatus(
        `${rows.length} nota(s) listada(s)${onlyPending?.checked ? ' — pendentes de entrada' : ''}.`
      );
    } catch (error) {
      console.error('[INBOUND][DFE][LOAD]', error);

      rows = [];
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="dfe-empty">
            Não foi possível carregar a caixa de entrada DF-e.
          </td>
        </tr>
      `;

      setStatus(error?.message || 'Falha ao consultar o DF-e.', 'error');
    } finally {
      loading = false;
    }
  }

  const findRow = (id) => rows.find((row) => String(row.id) === String(id));

  const hasManifest = (row) => Boolean(row?.manifestacao?.operacao);

  /**
   * Busca o XML completo da nota no backend (que consulta a NF-e API).
   * Lança erro com code = 'XML_NOT_AVAILABLE' quando só existe o resumo
   * (resNFe), ou seja, a SEFAZ ainda não liberou o XML.
   */
  async function fetchXml(id) {
    const response = await fetch(ROUTES.nfeInboxXmlById(id));
    const text = await response.text();

    if (!response.ok) {
      let json = {};

      try {
        json = JSON.parse(text);
      } catch {
        // resposta não-JSON: mantém a mensagem padrão
      }

      const error = new Error(json?.message || `Erro HTTP ${response.status}.`);
      error.code = json?.error;
      throw error;
    }

    if (!text || text.trim().length < 50) {
      throw new Error('O XML retornado está vazio.');
    }

    return text;
  }

  async function deliverXml(id, key, xml) {
    const file = new File([xml], `${key || id}.xml`, { type: 'application/xml' });

    closeModal();

    await state.actions.importXmlFile?.(file);
  }

  function setBusy(trigger, label) {
    if (!trigger) return () => {};

    const original = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = label;

    return () => {
      trigger.disabled = false;
      trigger.textContent = original;
    };
  }

  /**
   * Baixa o XML da nota e entrega ao pipeline de importação.
   *
   * Sem manifestação a SEFAZ só distribui o resumo da NF-e. Nesse caso a
   * linha passa a oferecer "Manifestar ciência" em vez de "Importar".
   */
  async function importFromRow(rowEl) {
    const id = rowEl?.dataset.id;
    const key = rowEl?.dataset.key || '';

    if (!id) return;

    const release = setBusy(rowEl.querySelector('[data-dfe-import]'), 'Baixando…');

    try {
      setStatus('Baixando XML da NF-e...');

      const xml = await fetchXml(id);
      await deliverXml(id, key, xml);
    } catch (error) {
      console.error('[INBOUND][DFE][IMPORT]', error);

      const row = findRow(id);

      if (error?.code === 'XML_NOT_AVAILABLE' && row && !hasManifest(row)) {
        row.needsManifest = true;
        renderRows();

        setStatus(
          'Só o resumo desta NF-e está disponível. Clique em "Manifestar ciência" para liberar o XML completo.',
          'warn'
        );
        return;
      }

      const message = error?.code === 'XML_NOT_AVAILABLE'
        ? 'Ciência já registrada, mas a SEFAZ ainda não liberou o XML. Tente novamente em alguns minutos.'
        : error?.message || 'Não foi possível obter o XML desta NF-e.';

      setStatus(message, 'error');
      core?.toast?.error?.('XML indisponível', message);
    } finally {
      release();
    }
  }

  /**
   * Envia a Ciência da Operação (evento 210210) pela NF-e API e, em
   * seguida, tenta baixar e importar o XML. A ciência não aceita nem
   * recusa a nota; só libera o XML completo para o destinatário.
   */
  async function manifestAndImport(rowEl) {
    const id = rowEl?.dataset.id;
    const key = rowEl?.dataset.key || '';
    const row = findRow(id);

    if (!id || !row) return;

    const confirmed = window.confirm(
      'Enviar à SEFAZ a "Ciência da Operação" desta NF-e?\n\n'
      + 'Ela apenas registra que a empresa tomou conhecimento da nota e libera o XML completo. '
      + 'Não confirma nem recusa a operação.'
    );
    if (!confirmed) return;

    const release = setBusy(rowEl.querySelector('[data-dfe-manifest]'), 'Enviando…');

    try {
      setStatus('Enviando Ciência da Operação à SEFAZ...');

      const response = await fetch(ROUTES.nfeInboxManifestById(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacao: 'CIENCIA' }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || `Erro HTTP ${response.status}.`);
      }

      row.manifestacao = { operacao: 'CIENCIA' };
      row.needsManifest = false;

      setStatus('Ciência registrada. Buscando o XML completo...');

      try {
        const xml = await fetchXml(id);
        core?.toast?.success?.('Ciência registrada', 'XML liberado. Abrindo a importação.');
        await deliverXml(id, key, xml);
      } catch (error) {
        if (error?.code !== 'XML_NOT_AVAILABLE') throw error;

        renderRows();
        setStatus(
          'Ciência registrada. A SEFAZ ainda não liberou o XML; clique em "Importar" novamente em alguns minutos.',
          'warn'
        );
        core?.toast?.warn?.(
          'Ciência registrada',
          'O XML ainda não foi liberado pela SEFAZ. Tente importar em alguns minutos.'
        );
      }
    } catch (error) {
      console.error('[INBOUND][DFE][MANIFEST]', error);

      const message = error?.message || 'Falha ao enviar a manifestação.';
      setStatus(message, 'error');
      core?.toast?.error?.('Manifestação não enviada', message);
    } finally {
      release();
    }
  }

  button.addEventListener('click', openModal);
  closeButton?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  reload?.addEventListener('click', () => void loadRows());
  onlyPending?.addEventListener('change', () => void loadRows());

  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void loadRows();
    }
  });

  tbody.addEventListener('click', (event) => {
    const manifestTrigger = event.target.closest('[data-dfe-manifest]');
    if (manifestTrigger) {
      void manifestAndImport(manifestTrigger.closest('tr'));
      return;
    }

    const trigger = event.target.closest('[data-dfe-import]');
    if (!trigger) return;

    void importFromRow(trigger.closest('tr'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  state.actions.openDfeImportModal = openModal;
}
