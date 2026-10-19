/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.js                                                     ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                  ║
   ║ DESCRIPTION: Frontend do módulo de CC-e                             ║
   ║ PRODNEX ERP · Frontend · ESM                                        ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

/* =========================================================================
 * 🔧 CONFIG
 * ========================================================================= */

const API_BASE =
    window.API_BASE ||
    window.apiBase ||
    'http://localhost:3000';

const ROUTES = {
    emitir: `${API_BASE}/api/nfe/cce`,
    status: (id) => `${API_BASE}/api/nfe/cce/status/${encodeURIComponent(id)}`,
    pdf: (id) => `${API_BASE}/api/nfe/cce/pdf/${encodeURIComponent(id)}`,
    xml: (id) => `${API_BASE}/api/nfe/cce/xml/${encodeURIComponent(id)}`,
    historicoPorPedido: (orderId) =>
        `${API_BASE}/api/nfe/cce/order/${encodeURIComponent(orderId)}`,
    historico: `${API_BASE}/api/nfe/cce/eventos`,
    historicoPorNfe: (id) =>
        `${API_BASE}/api/nfe/cce/${encodeURIComponent(id)}/eventos`,
};

/* =========================================================================
 * 🧩 HELPERS
 * ========================================================================= */

const $ = (selector) => document.querySelector(selector);

function onlyDigits(value) {
    return String(value ?? '').replace(/\D+/g, '');
}

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function toJsonPretty(value) {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

function setFeedback(message, type = 'info') {
    const el = $('#feedback');
    if (!el) return;

    el.className = `feedback ${type}`;
    el.textContent = message || '—';
}

function setJsonPreview(selector, data) {
    const el = $(selector);
    if (!el) return;
    el.textContent = toJsonPretty(data);
}

function parseErrorMessage(err, fallback = 'Ocorreu um erro.') {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return fallback;
}

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('pt-BR');
}

function pickFirst(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }
    }
    return null;
}

function extractEventStatus(data = {}) {
    const root = data?.data ?? data ?? {};

    return {
        protocolo: pickFirst(
            root.protocolo,
            root.protocol,
            root.nProt,
            root.numeroProtocolo
        ) || '—',

        numeroSequencia: pickFirst(
            root.numeroSequencia,
            root.sequencia,
            root.sequence,
            root.seqEvento
        ) || '—',

        status: pickFirst(
            root.status,
            root.situacao,
            root.descricaoSituacao,
            root.resposta
        ) || '—',

        cstat: pickFirst(
            root.cStat,
            root.cstat,
            root.codigo,
            root.statusCodigo
        ) || '—',

        respostaSefaz: pickFirst(
            root.respostaSefaz,
            root.xMotivo,
            root.motivo,
            root.message,
            root.mensagem
        ) || '—',

        pdfUrl: pickFirst(root.pdf, root.pdfUrl, root.urlPdf),
        xmlUrl: pickFirst(root.xml, root.xmlUrl, root.urlXml),
    };
}

function buildHeaders() {
    return {
        'Content-Type': 'application/json',
    };
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...buildHeaders(),
            ...(options.headers || {}),
        },
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error?.message ||
            data?.error ||
            (typeof data === 'string' ? data : null) ||
            `Erro HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

function openUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function getBestEventIdentifier(row) {
    if (!row) return '';

    return (
        String(
            row.nfe_plugnotas_id ||
            row.nfePlugnotasId ||
            row.protocolo ||
            row.nfe_key ||
            row.nfeKey ||
            ''
        ).trim()
    );
}

function canOpenPdfFromRow(row) {
    return !!getBestEventIdentifier(row);
}

function canOpenXmlFromRow(row) {
    return !!getBestEventIdentifier(row);
}

/* =========================================================================
 * 🧠 STATE
 * ========================================================================= */

const state = {
    ultimoIdentificador: '',
    ultimoStatusPayload: null,
    ultimoEventoSelecionado: null,
    eventosSalvos: [],
};

/* =========================================================================
 * 🏗️ ELEMENTOS
 * ========================================================================= */

const els = {
    tabs: [...document.querySelectorAll('.cce-tab')],
    panels: [...document.querySelectorAll('.cce-tab-panel')],

    idOuChave: $('#idOuChave'),
    orderId: $('#orderId'),
    nfeKey: $('#nfeKey'),
    nfePlugnotasId: $('#nfePlugnotasId'),
    createdBy: $('#createdBy'),
    correcao: $('#correcao'),
    contadorCorrecao: $('#contadorCorrecao'),

    btnValidarCampos: $('#btnValidarCampos'),
    btnEmitirCce: $('#btnEmitirCce'),
    btnLimparTela: $('#btnLimparTela'),
    btnAtualizarHistorico: $('#btnAtualizarHistorico'),

    retornoStatus: $('#retornoStatus'),
    retornoProtocolo: $('#retornoProtocolo'),
    retornoSequencia: $('#retornoSequencia'),
    retornoCstat: $('#retornoCstat'),
    jsonRetorno: $('#jsonRetorno'),

    btnAbrirPdfUltimo: $('#btnAbrirPdfUltimo'),
    btnAbrirXmlUltimo: $('#btnAbrirXmlUltimo'),

    consultaIdentificador: $('#consultaIdentificador'),
    consultaListaCce: $('#consultaListaCce'),
    btnConsultarStatus: $('#btnConsultarStatus'),
    jsonConsultaStatus: $('#jsonConsultaStatus'),

    documentoIdentificador: $('#documentoIdentificador'),
    btnAbrirPdf: $('#btnAbrirPdf'),
    btnAbrirXml: $('#btnAbrirXml'),

    filtroOrderId: $('#filtroOrderId'),
    filtroNfeKey: $('#filtroNfeKey'),
    filtroIdOuChave: $('#filtroIdOuChave'),
    btnBuscarHistorico: $('#btnBuscarHistorico'),
    tbodyEventosSalvos: $('#tbodyEventosSalvos'),
    jsonHistoricoRemoto: $('#jsonHistoricoRemoto'),

    detNfeKey: $('#detNfeKey'),
    detPlugnotasId: $('#detPlugnotasId'),
    detProtocolo: $('#detProtocolo'),
    detStatus: $('#detStatus'),
    detRespostaSefaz: $('#detRespostaSefaz'),
    detCorrecao: $('#detCorrecao'),
    btnAbrirPdfEvento: $('#btnAbrirPdfEvento'),
    btnAbrirXmlEvento: $('#btnAbrirXmlEvento'),
};

/* =========================================================================
 * 🧼 UI
 * ========================================================================= */

function switchTab(tabId) {
    els.tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    els.panels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === tabId);
    });
}

function updateCorrecaoCounter() {
    const value = els.correcao?.value || '';
    if (els.contadorCorrecao) {
        els.contadorCorrecao.textContent = `${value.length} / 1000`;
    }
}

function clearResultadoEmissao() {
    if (els.retornoStatus) els.retornoStatus.textContent = '—';
    if (els.retornoProtocolo) els.retornoProtocolo.textContent = '—';
    if (els.retornoSequencia) els.retornoSequencia.textContent = '—';
    if (els.retornoCstat) els.retornoCstat.textContent = '—';

    setJsonPreview('#jsonRetorno', {});
    state.ultimoStatusPayload = null;
    state.ultimoIdentificador = '';

    if (els.btnAbrirPdfUltimo) els.btnAbrirPdfUltimo.disabled = true;
    if (els.btnAbrirXmlUltimo) els.btnAbrirXmlUltimo.disabled = true;
}

function clearDetalhesEvento() {
    if (els.detNfeKey) els.detNfeKey.textContent = '—';
    if (els.detPlugnotasId) els.detPlugnotasId.textContent = '—';
    if (els.detProtocolo) els.detProtocolo.textContent = '—';
    if (els.detStatus) els.detStatus.textContent = '—';
    if (els.detRespostaSefaz) els.detRespostaSefaz.textContent = '—';
    if (els.detCorrecao) els.detCorrecao.value = '';

    if (els.btnAbrirPdfEvento) els.btnAbrirPdfEvento.disabled = true;
    if (els.btnAbrirXmlEvento) els.btnAbrirXmlEvento.disabled = true;

    state.ultimoEventoSelecionado = null;
}

function clearAll() {
    [
        els.idOuChave,
        els.orderId,
        els.nfeKey,
        els.nfePlugnotasId,
        els.createdBy,
        els.correcao,
        els.consultaIdentificador,
        els.documentoIdentificador,
        els.filtroOrderId,
        els.filtroNfeKey,
        els.filtroIdOuChave,
    ].forEach((input) => {
        if (input) input.value = '';
    });

    if (els.consultaListaCce) {
        els.consultaListaCce.checked = false;
    }

    updateCorrecaoCounter();
    clearResultadoEmissao();
    clearDetalhesEvento();
    setJsonPreview('#jsonConsultaStatus', {});
    setJsonPreview('#jsonHistoricoRemoto', {});
    renderEventos([]);
    setFeedback('Tela limpa com sucesso.', 'info');
}

/* =========================================================================
 * ✅ VALIDAÇÃO
 * ========================================================================= */

function validateEmissaoForm() {
    const payload = {
        idOuChave: normalizeText(els.idOuChave?.value),
        orderId: normalizeText(els.orderId?.value),
        nfeKey: normalizeText(els.nfeKey?.value),
        nfePlugnotasId: normalizeText(els.nfePlugnotasId?.value),
        correcao: normalizeText(els.correcao?.value),
        createdBy: normalizeText(els.createdBy?.value),
    };

    if (
        !payload.idOuChave &&
        !payload.orderId &&
        !payload.nfeKey &&
        !payload.nfePlugnotasId
    ) {
        throw new Error('Informe ao menos um identificador da NF-e.');
    }

    if (!payload.correcao) {
        throw new Error('Informe o texto da carta de correção.');
    }

    if (payload.correcao.length < 15) {
        throw new Error('O texto da CC-e deve ter no mínimo 15 caracteres.');
    }

    if (payload.correcao.length > 1000) {
        throw new Error('O texto da CC-e deve ter no máximo 1000 caracteres.');
    }

    return payload;
}

function validateConsultaStatusForm() {
    const identificador = normalizeText(els.consultaIdentificador?.value);

    if (!identificador) {
        throw new Error('Informe o identificador para consulta de status.');
    }

    return {
        identificador,
        listaCce: !!els.consultaListaCce?.checked,
    };
}

function validateDocumentoForm() {
    const identificador = normalizeText(els.documentoIdentificador?.value);

    if (!identificador) {
        throw new Error('Informe o identificador para abrir PDF/XML.');
    }

    return { identificador };
}

/* =========================================================================
 * 📤 AÇÕES
 * ========================================================================= */

async function onValidarCampos() {
    try {
        validateEmissaoForm();
        setFeedback('Campos validados com sucesso.', 'success');
    } catch (err) {
        setFeedback(parseErrorMessage(err), 'error');
    }
}

async function onEmitirCce() {
    try {
        const payload = validateEmissaoForm();

        setFeedback('Emitindo CC-e...', 'info');
        clearResultadoEmissao();

        const data = await fetchJson(ROUTES.emitir, {
            method: 'POST',
            body: JSON.stringify({
                idOuChave: payload.idOuChave || undefined,
                orderId: payload.orderId || undefined,
                nfeKey: payload.nfeKey || undefined,
                nfePlugnotasId: payload.nfePlugnotasId || undefined,
                correcao: payload.correcao,
                createdBy: payload.createdBy || undefined,
            }),
        });

        const statusPayload = data?.data?.status || data?.data?.envio || data?.data || {};
        const extracted = extractEventStatus(statusPayload);

        const ultimoIdentificador =
            payload.idOuChave ||
            payload.nfePlugnotasId ||
            payload.nfeKey ||
            payload.orderId ||
            '';

        state.ultimoIdentificador = ultimoIdentificador;
        state.ultimoStatusPayload = statusPayload;

        if (els.retornoStatus) els.retornoStatus.textContent = extracted.status;
        if (els.retornoProtocolo) els.retornoProtocolo.textContent = extracted.protocolo;
        if (els.retornoSequencia) els.retornoSequencia.textContent = extracted.numeroSequencia;
        if (els.retornoCstat) els.retornoCstat.textContent = extracted.cstat;

        setJsonPreview('#jsonRetorno', data);

        if (els.btnAbrirPdfUltimo) {
            els.btnAbrirPdfUltimo.disabled = !ultimoIdentificador;
        }

        if (els.btnAbrirXmlUltimo) {
            els.btnAbrirXmlUltimo.disabled = !ultimoIdentificador;
        }

        setFeedback('CC-e emitida com sucesso.', 'success');

        if (els.filtroOrderId && payload.orderId) {
            els.filtroOrderId.value = payload.orderId;
        }

        if (els.filtroNfeKey && payload.nfeKey) {
            els.filtroNfeKey.value = payload.nfeKey;
        }

        if (els.filtroIdOuChave && payload.idOuChave) {
            els.filtroIdOuChave.value = payload.idOuChave;
        }

        await onBuscarHistorico();
    } catch (err) {
        clearResultadoEmissao();
        setFeedback(parseErrorMessage(err, 'Falha ao emitir CC-e.'), 'error');
    }
}

async function onConsultarStatus() {
    try {
        const { identificador, listaCce } = validateConsultaStatusForm();

        setFeedback('Consultando status da CC-e...', 'info');

        const url = new URL(ROUTES.status(identificador));
        if (listaCce) {
            url.searchParams.set('listaCce', 'true');
        }

        const data = await fetchJson(url.toString());
        setJsonPreview('#jsonConsultaStatus', data);

        const extracted = extractEventStatus(data?.data || data);
        if (els.retornoStatus) els.retornoStatus.textContent = extracted.status;
        if (els.retornoProtocolo) els.retornoProtocolo.textContent = extracted.protocolo;
        if (els.retornoSequencia) els.retornoSequencia.textContent = extracted.numeroSequencia;
        if (els.retornoCstat) els.retornoCstat.textContent = extracted.cstat;

        state.ultimoIdentificador = identificador;
        state.ultimoStatusPayload = data?.data || data;

        if (els.btnAbrirPdfUltimo) els.btnAbrirPdfUltimo.disabled = false;
        if (els.btnAbrirXmlUltimo) els.btnAbrirXmlUltimo.disabled = false;

        setFeedback('Status consultado com sucesso.', 'success');
    } catch (err) {
        setJsonPreview('#jsonConsultaStatus', {});
        setFeedback(parseErrorMessage(err, 'Falha ao consultar status.'), 'error');
    }
}

function onAbrirPdfUltimo() {
    const identificador =
        state.ultimoIdentificador ||
        normalizeText(els.idOuChave?.value) ||
        normalizeText(els.consultaIdentificador?.value) ||
        normalizeText(els.documentoIdentificador?.value);

    if (!identificador) {
        setFeedback('Nenhum identificador disponível para abrir o PDF.', 'error');
        return;
    }

    openUrl(ROUTES.pdf(identificador));
}

function onAbrirXmlUltimo() {
    const identificador =
        state.ultimoIdentificador ||
        normalizeText(els.idOuChave?.value) ||
        normalizeText(els.consultaIdentificador?.value) ||
        normalizeText(els.documentoIdentificador?.value);

    if (!identificador) {
        setFeedback('Nenhum identificador disponível para abrir o XML.', 'error');
        return;
    }

    openUrl(ROUTES.xml(identificador));
}

function onAbrirPdfManual() {
    try {
        const { identificador } = validateDocumentoForm();
        openUrl(ROUTES.pdf(identificador));
        setFeedback('Abrindo PDF da CC-e...', 'info');
    } catch (err) {
        setFeedback(parseErrorMessage(err), 'error');
    }
}

function onAbrirXmlManual() {
    try {
        const { identificador } = validateDocumentoForm();
        openUrl(ROUTES.xml(identificador));
        setFeedback('Abrindo XML da CC-e...', 'info');
    } catch (err) {
        setFeedback(parseErrorMessage(err), 'error');
    }
}

/* =========================================================================
 * 📋 HISTÓRICO
 * ========================================================================= */

function renderEventos(eventos = []) {
    state.eventosSalvos = Array.isArray(eventos) ? eventos : [];

    if (!els.tbodyEventosSalvos) return;

    if (!state.eventosSalvos.length) {
        els.tbodyEventosSalvos.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">Nenhum evento encontrado.</td>
      </tr>
    `;
        clearDetalhesEvento();
        return;
    }

    els.tbodyEventosSalvos.innerHTML = state.eventosSalvos
        .map((row, index) => {
            const id = row.id ?? index;
            const seq = row.numero_sequencia ?? row.numeroSequencia ?? '—';
            const protocolo = row.protocolo || '—';
            const status = row.status || '—';
            const cstat = row.cstat || '—';
            const criadoPor = row.created_by || row.createdBy || '—';
            const criadoEm = formatDateTime(row.created_at || row.createdAt);

            return `
        <tr data-event-id="${id}">
          <td>${seq}</td>
          <td>${protocolo}</td>
          <td>${status}</td>
          <td>${cstat}</td>
          <td>${criadoPor}</td>
          <td>${criadoEm}</td>
          <td>
            <button type="button" class="btn-row-action" data-action="select" data-event-id="${id}">
              Selecionar
            </button>
          </td>
          <td>
            <button type="button" class="btn-row-action" data-action="pdf" data-event-id="${id}" ${canOpenPdfFromRow(row) ? '' : 'disabled'}>
            PDF
            </button>
            <button type="button" class="btn-row-action" data-action="xml" data-event-id="${id}" ${canOpenXmlFromRow(row) ? '' : 'disabled'}>
            XML
            </button>
          </td>
        </tr>
      `;
        })
        .join('');

    const first = state.eventosSalvos[0];
    if (first) {
        selectEvento(first.id ?? 0);
    }
}

function selectEvento(eventId) {
    const selected = state.eventosSalvos.find(
        (row, index) => String(row.id ?? index) === String(eventId)
    );

    if (!selected) {
        clearDetalhesEvento();
        return;
    }

    state.ultimoEventoSelecionado = selected;

    if (els.detNfeKey) {
        els.detNfeKey.textContent = selected.nfe_key || selected.nfeKey || '—';
    }

    if (els.detPlugnotasId) {
        els.detPlugnotasId.textContent =
            selected.nfe_plugnotas_id || selected.nfePlugnotasId || '—';
    }

    if (els.detProtocolo) {
        els.detProtocolo.textContent = selected.protocolo || '—';
    }

    if (els.detStatus) {
        els.detStatus.textContent = selected.status || '—';
    }

    if (els.detRespostaSefaz) {
        els.detRespostaSefaz.textContent =
            selected.resposta_sefaz || selected.respostaSefaz || '—';
    }

    if (els.detCorrecao) {
        els.detCorrecao.value = selected.correcao || '';
    }

    if (els.btnAbrirPdfEvento) {
        els.btnAbrirPdfEvento.disabled = !canOpenPdfFromRow(selected);
    }

    if (els.btnAbrirXmlEvento) {
        els.btnAbrirXmlEvento.disabled = !canOpenXmlFromRow(selected);
    }

    [...els.tbodyEventosSalvos.querySelectorAll('tr')].forEach((tr) => {
        tr.classList.toggle(
            'selected',
            String(tr.dataset.eventId) === String(selected.id)
        );
    });
}

async function onBuscarHistorico() {
    try {
        const orderId = normalizeText(els.filtroOrderId?.value);
        const nfeKey = normalizeText(els.filtroNfeKey?.value);
        const idOuChave = normalizeText(els.filtroIdOuChave?.value);

        setFeedback('Buscando histórico de CC-e...', 'info');

        let data;

        if (orderId) {
            data = await fetchJson(ROUTES.historicoPorPedido(orderId));
        } else if (idOuChave) {
            data = await fetchJson(ROUTES.historicoPorNfe(idOuChave));
        } else {
            const url = new URL(ROUTES.historico);

            if (nfeKey) url.searchParams.set('nfeKey', nfeKey);

            data = await fetchJson(url.toString());
        }

        const salvos = data?.data?.salvos || [];
        const remoto = data?.data?.remoto || {};

        renderEventos(salvos);
        setJsonPreview('#jsonHistoricoRemoto', remoto);

        setFeedback('Histórico carregado com sucesso.', 'success');
    } catch (err) {
        renderEventos([]);
        setJsonPreview('#jsonHistoricoRemoto', {});
        setFeedback(parseErrorMessage(err, 'Falha ao buscar histórico.'), 'error');
    }
}

/* =========================================================================
 * 🧾 EVENTOS DE LINHA
 * ========================================================================= */

function onTabelaEventosClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { action, eventId } = button.dataset;
    const row = state.eventosSalvos.find(
        (item, index) => String(item.id ?? index) === String(eventId)
    );

    if (!row) return;

    if (action === 'select') {
        selectEvento(eventId);
        return;
    }

    const identifier = getBestEventIdentifier(row);

    if (!identifier) {
        setFeedback('Nenhum identificador válido encontrado para este evento.', 'error');
        return;
    }

    if (action === 'pdf') {
        openUrl(ROUTES.pdf(identifier));
        return;
    }

    if (action === 'xml') {
        openUrl(ROUTES.xml(identifier));
    }
}

function onAbrirPdfEvento() {
    const row = state.ultimoEventoSelecionado;
    const identifier = getBestEventIdentifier(row);

    if (!identifier) {
        setFeedback('Nenhum identificador válido encontrado para o evento selecionado.', 'error');
        return;
    }

    openUrl(ROUTES.pdf(identifier));
}

function onAbrirXmlEvento() {
    const row = state.ultimoEventoSelecionado;
    const identifier = getBestEventIdentifier(row);

    if (!identifier) {
        setFeedback('Nenhum identificador válido encontrado para o evento selecionado.', 'error');
        return;
    }

    openUrl(ROUTES.xml(identifier));
}

/* =========================================================================
 * 🔗 BINDS
 * ========================================================================= */

function bindTabs() {
    els.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

function bindActions() {
    els.correcao?.addEventListener('input', updateCorrecaoCounter);

    els.btnValidarCampos?.addEventListener('click', onValidarCampos);
    els.btnEmitirCce?.addEventListener('click', onEmitirCce);
    els.btnLimparTela?.addEventListener('click', clearAll);

    els.btnConsultarStatus?.addEventListener('click', onConsultarStatus);

    els.btnAbrirPdfUltimo?.addEventListener('click', onAbrirPdfUltimo);
    els.btnAbrirXmlUltimo?.addEventListener('click', onAbrirXmlUltimo);

    els.btnAbrirPdf?.addEventListener('click', onAbrirPdfManual);
    els.btnAbrirXml?.addEventListener('click', onAbrirXmlManual);

    els.btnBuscarHistorico?.addEventListener('click', onBuscarHistorico);
    els.btnAtualizarHistorico?.addEventListener('click', onBuscarHistorico);

    els.btnAbrirPdfEvento?.addEventListener('click', onAbrirPdfEvento);
    els.btnAbrirXmlEvento?.addEventListener('click', onAbrirXmlEvento);

    els.tbodyEventosSalvos?.addEventListener('click', onTabelaEventosClick);
}

function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        const target = event.target;
        const isTyping =
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable);

        if (event.key === 'F5') return;

        if (event.ctrlKey && event.key.toLowerCase() === 'enter') {
            event.preventDefault();
            onEmitirCce();
            return;
        }

        if (!isTyping && event.key === 'Escape') {
            event.preventDefault();
            clearAll();
        }
    });
}

/* =========================================================================
 * 🚀 INIT
 * ========================================================================= */

function init() {
    bindTabs();
    bindActions();
    bindKeyboardShortcuts();
    updateCorrecaoCounter();
    clearResultadoEmissao();
    clearDetalhesEvento();
    setJsonPreview('#jsonRetorno', {});
    setJsonPreview('#jsonConsultaStatus', {});
    setJsonPreview('#jsonHistoricoRemoto', {});
    renderEventos([]);
    switchTab('tab-emissao');
    setFeedback('Módulo CC-e carregado com sucesso.', 'success');
}

document.addEventListener('DOMContentLoaded', init);