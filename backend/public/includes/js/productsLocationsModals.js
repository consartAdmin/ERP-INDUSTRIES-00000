// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsModals.js — Modal de busca de localizações         ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║ Uso: window.ProductsLocationsModal.open({ onSelect })               ║
// ║                                                                      ║
// ║ ✅ Busca no mapa real: /api/locations/map                            ║
// ║ ✅ Não busca mais somente produtos vinculados                         ║
// ║ ✅ Carrega Local / Corredor / Gôndola / Bandeja                       ║
// ║ ✅ Mantém compatibilidade com aliases antigos                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const LAYER_ID = 'products-locations-modal-layer-consart';

function getApiBaseSafe() {
    try {
        if (typeof window.getApiBase === 'function') return window.getApiBase();
    } catch { }

    return window.API_BASE || window.apiBase || window.location.origin || '';
}

const API_BASE = getApiBaseSafe();

function qs(sel, root = document) {
    return root.querySelector(sel);
}

function qsa(sel, root = document) {
    return [...root.querySelectorAll(sel)];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function jfetch(url, options = {}) {
    const res = await fetch(url, {
        headers: {
            Accept: 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    const text = await res.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        const msg =
            data?.message ||
            data?.error ||
            `HTTP ${res.status} ao acessar ${url}`;

        throw new Error(msg);
    }

    return data;
}

function extractRows(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.rows)) return payload.data.rows;

    for (const key of Object.keys(payload)) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    if (payload.data && typeof payload.data === 'object') {
        for (const key of Object.keys(payload.data)) {
            if (Array.isArray(payload.data[key])) return payload.data[key];
        }
    }

    return [];
}

function normalizeLocation(row = {}) {
    const id =
        row.id ??
        row.bin_id ??
        row.location_id ??
        row.product_location_id ??
        row.products_location_id ??
        null;

    const local =
        row.local ??
        row.location ??
        row.location_name ??
        row.local_name ??
        row.store_id ??
        '';

    const corredor =
        row.corredor ??
        row.corridor ??
        row.corridor_name ??
        row.aisle ??
        row.rua ??
        '';

    const gondola =
        row.gondola ??
        row.prateleira ??
        row.shelf ??
        row.shelf_name ??
        row.shelf_code ??
        '';

    const bandeja =
        row.bandeja ??
        row.bin ??
        row.bin_name ??
        row.box ??
        row.caixa ??
        '';

    const position =
        row.position ??
        row.posicao ??
        row.position_name ??
        '';

    const descricao =
        row.descricao_localizacao ??
        row.location_description ??
        row.descricao ??
        row.description ??
        '';

    const ativoRaw =
        row.ativo ??
        row.active ??
        row.is_active ??
        row.status ??
        true;

    const label =
        row.label ||
        [local, corredor, gondola, bandeja, position]
            .filter(Boolean)
            .join(' / ');

    return {
        id,
        local,
        corredor,
        gondola,
        bandeja,
        position,
        descricao,
        ativo: Boolean(
            ativoRaw === true ||
            ativoRaw === 1 ||
            ativoRaw === '1' ||
            ativoRaw === 'true' ||
            ativoRaw === 'ativo' ||
            ativoRaw === 'ATIVO'
        ),
        label,
        raw: row,
    };
}

function uniqueLocations(rows = []) {
    const map = new Map();

    for (const row of rows) {
        const key = [
            row.id || '',
            row.local || '',
            row.corredor || '',
            row.gondola || '',
            row.bandeja || '',
            row.position || '',
        ]
            .map(v => String(v).trim().toUpperCase())
            .join('|');

        if (!map.has(key)) {
            map.set(key, row);
        }
    }

    return [...map.values()];
}

function removeLayer() {
    const old = document.getElementById(LAYER_ID);

    if (old) old.remove();

    document.body.classList.remove('plm-open');
}

function fillSelect(selectEl, values, placeholder = 'Todos') {
    if (!selectEl) return;

    selectEl.innerHTML = '';

    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    selectEl.appendChild(first);

    values.forEach((value) => {
        const opt = document.createElement('option');
        opt.value = String(value);
        opt.textContent = String(value);
        selectEl.appendChild(opt);
    });
}

async function loadFilterOptions(layer) {
    try {
        const rows = await fetchLocations({
            q: '',
            corredor: '',
            prateleira: '',
            bandeja: '',
            onlyActive: false,
            limit: 10000,
        });

        const corredores = [...new Set(
            rows.map(r => String(r.corredor ?? '').trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        const gondolas = [...new Set(
            rows.map(r => String(r.gondola ?? '').trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        const bandejas = [...new Set(
            rows.map(r => String(r.bandeja ?? '').trim()).filter(Boolean)
        )].sort((a, b) => {
            const na = Number(a);
            const nb = Number(b);
            const aIsNum = Number.isFinite(na);
            const bIsNum = Number.isFinite(nb);

            if (aIsNum && bIsNum) return na - nb;

            return String(a).localeCompare(String(b), 'pt-BR');
        });

        fillSelect(qs('#plm-corredor', layer), corredores, 'Todos');
        fillSelect(qs('#plm-gondola', layer), gondolas, 'Todas');
        fillSelect(qs('#plm-bandeja', layer), bandejas, 'Todas');
    } catch (err) {
        console.warn('[ProductsLocationsModal] erro ao carregar filtros dinâmicos:', err);
    }
}

function buildModal() {
    removeLayer();

    const layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.className = 'plm-layer';

    layer.innerHTML = `
        <div class="plm-backdrop"></div>

        <div class="plm-modal" role="dialog" aria-modal="true" aria-labelledby="plm-title">
            <div class="plm-head">
                <div class="plm-title" id="plm-title">📍 Buscar Localização</div>
                <button type="button" class="plm-close" aria-label="Fechar">✕</button>
            </div>

            <div class="plm-body">
                <div class="plm-toolbar">

                    <div class="plm-group" style="min-width:220px;">
                        <label>Busca</label>
                        <input type="text" id="plm-q" placeholder="Ex: local, corredor, gôndola, bandeja..." />
                    </div>

                    <div class="plm-group">
                        <label>Corredor</label>
                        <select id="plm-corredor">
                            <option value="">Todos</option>
                        </select>
                    </div>

                    <div class="plm-group">
                        <label>Gôndola</label>
                        <select id="plm-gondola">
                            <option value="">Todas</option>
                        </select>
                    </div>

                    <div class="plm-group">
                        <label>Bandeja</label>
                        <select id="plm-bandeja">
                            <option value="">Todas</option>
                        </select>
                    </div>

                    <div class="plm-group">
                        <label>Itens</label>
                        <select id="plm-limit">
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100" selected>100</option>
                            <option value="500">500</option>
                        </select>
                    </div>

                    <div class="plm-actions">
                        <button type="button" class="btn btn-primary btn-sm" id="plm-search-btn">🔍 Buscar</button>
                        <button type="button" class="btn btn-flat btn-sm" id="plm-clear-btn">Limpar</button>
                    </div>
                </div>

                <div class="plm-table-wrap">
                    <table class="plm-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Local</th>
                                <th>Corredor</th>
                                <th>Gôndola</th>
                                <th>Bandeja</th>
                                <th>Descrição</th>
                                <th>Status</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody id="plm-tbody">
                            <tr>
                                <td colspan="8" class="plm-empty">Digite algo para buscar.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="plm-foot">
                <div class="plm-meta" id="plm-meta">—</div>
                <div class="plm-actions">
                    <button type="button" class="btn btn-flat btn-sm" id="plm-cancel-btn">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(layer);
    document.body.classList.add('plm-open');

    return layer;
}

async function fetchLocations({
    q = '',
    corredor = '',
    prateleira = '',
    bandeja = '',
    onlyActive = true,
    limit = 100,
} = {}) {
    const candidates = [
        `${API_BASE}/api/locations/map`,
    ];

    let lastErr = null;

    for (const base of candidates) {
        try {
            const url = new URL(base, window.location.origin);

            if (q) url.searchParams.set('q', q);
            if (corredor) url.searchParams.set('corredor', corredor);
            if (prateleira) url.searchParams.set('prateleira', prateleira);
            if (bandeja) url.searchParams.set('bandeja', bandeja);

            url.searchParams.set('limit', String(limit));

            if (onlyActive === true) {
                url.searchParams.set('onlyActive', 'true');
            }

            const payload = await jfetch(url.toString());

            const rows = uniqueLocations(
                extractRows(payload)
                    .map(normalizeLocation)
                    .filter(r => r.id || r.local || r.corredor || r.gondola || r.bandeja)
            );

            return rows;
        } catch (err) {
            lastErr = err;
        }
    }

    throw lastErr || new Error('Não foi possível carregar as localizações.');
}

function renderRows(tbody, rows, onSelect) {
    if (!tbody) return;

    if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="plm-empty">Nenhuma localização encontrada.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((row) => `
        <tr>
            <td>${escapeHtml(row.id)}</td>
            <td>${escapeHtml(row.local)}</td>
            <td>${escapeHtml(row.corredor)}</td>
            <td>${escapeHtml(row.gondola)}</td>
            <td>${escapeHtml(row.bandeja)}</td>
            <td>${escapeHtml(row.descricao)}</td>
            <td>
                <span class="plm-badge">${row.ativo ? '✅ Ativo' : '⛔ Inativo'}</span>
            </td>
            <td>
                <button
                    type="button"
                    class="btn btn-primary btn-sm plm-btn-select"
                    data-id="${escapeHtml(row.id)}"
                >
                    Selecionar
                </button>
            </td>
        </tr>
    `).join('');

    qsa('.plm-btn-select', tbody).forEach((btn) => {
        btn.addEventListener('click', () => {
            const row = rows.find((r) => String(r.id) === String(btn.dataset.id));

            if (!row) return;

            onSelect?.(row);
            removeLayer();
        });
    });
}

function bindCloseEvents(layer) {
    const close = () => removeLayer();

    qs('.plm-backdrop', layer)?.addEventListener('click', close);
    qs('.plm-close', layer)?.addEventListener('click', close);
    qs('#plm-cancel-btn', layer)?.addEventListener('click', close);

    const onKey = (e) => {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', onKey);
            close();
        }
    };

    document.addEventListener('keydown', onKey, { once: false });
}

function openProductsLocationsModal({
    onSelect,
    initialQuery = '',
    initialCorredor = '',
    initialGondola = '',
    initialBandeja = '',
    autoSearch = false,
} = {}) {
    const layer = buildModal();
    bindCloseEvents(layer);

    const inputQ = qs('#plm-q', layer);
    const inputCorredor = qs('#plm-corredor', layer);
    const inputGondola = qs('#plm-gondola', layer);
    const inputBandeja = qs('#plm-bandeja', layer);
    const selLimit = qs('#plm-limit', layer);
    const tbody = qs('#plm-tbody', layer);
    const meta = qs('#plm-meta', layer);
    const btnSearch = qs('#plm-search-btn', layer);
    const btnClear = qs('#plm-clear-btn', layer);

    let busy = false;

    async function runSearch() {
        if (busy) return;

        busy = true;

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="plm-empty">Carregando localizações…</td>
            </tr>
        `;

        meta.textContent = 'Buscando…';

        try {
            const corredorSelecionado = String(inputCorredor?.value || '').trim().toUpperCase();
            const gondolaSelecionada = String(inputGondola?.value || '').trim().toUpperCase();
            const bandejaSelecionada = String(inputBandeja?.value || '').trim().toUpperCase();
            const buscaTexto = String(inputQ?.value || '').trim().toUpperCase();

            let rows = await fetchLocations({
                q: '',
                corredor: '',
                prateleira: '',
                bandeja: '',
                onlyActive: false,
                limit: 10000,
            });

            rows = rows.filter((row) => {
                const rowCorredor = String(row.corredor || '').trim().toUpperCase();
                const rowGondola = String(row.gondola || '').trim().toUpperCase();
                const rowBandeja = String(row.bandeja || '').trim().toUpperCase();

                const textoLivre = [
                    row.id,
                    row.local,
                    row.corredor,
                    row.gondola,
                    row.bandeja,
                    row.position,
                    row.descricao,
                    row.label,
                ]
                    .map(v => String(v ?? '').toUpperCase())
                    .join(' ');

                if (corredorSelecionado && rowCorredor !== corredorSelecionado) return false;
                if (gondolaSelecionada && rowGondola !== gondolaSelecionada) return false;
                if (bandejaSelecionada && rowBandeja !== bandejaSelecionada) return false;
                if (buscaTexto && !textoLivre.includes(buscaTexto)) return false;

                return true;
            });

            const limit = Number(selLimit?.value || 100);
            const visibleRows = rows.slice(0, limit);

            renderRows(tbody, visibleRows, onSelect);

            meta.textContent = `${rows.length} localização(ões) encontrada(s).`;
        } catch (err) {
            console.error('[ProductsLocationsModal] erro:', err);

            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="plm-empty">Erro ao buscar localizações.</td>
                </tr>
            `;

            meta.textContent = err?.message || 'Erro ao buscar.';
        } finally {
            busy = false;
        }
    }

    btnSearch?.addEventListener('click', runSearch);

    btnClear?.addEventListener('click', () => {
        if (inputQ) inputQ.value = '';
        if (inputCorredor) inputCorredor.value = '';
        if (inputGondola) inputGondola.value = '';
        if (inputBandeja) inputBandeja.value = '';
        if (selLimit) selLimit.value = '100';

        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="plm-empty">Digite algo para buscar.</td>
            </tr>
        `;

        meta.textContent = '—';
        inputQ?.focus();
    });

    inputQ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            runSearch();
        }
    });

    (async () => {
        await loadFilterOptions(layer);

        if (inputQ) inputQ.value = initialQuery || '';
        if (inputCorredor && initialCorredor) inputCorredor.value = initialCorredor;
        if (inputGondola && initialGondola) inputGondola.value = initialGondola;
        if (inputBandeja && initialBandeja) inputBandeja.value = initialBandeja;

        setTimeout(() => inputQ?.focus(), 30);

        const hasInitialFilter =
            Boolean(initialQuery) ||
            Boolean(initialCorredor) ||
            Boolean(initialGondola) ||
            Boolean(initialBandeja);

        if (autoSearch || hasInitialFilter) {
            runSearch();
        }
    })();

    return {
        close: removeLayer,
        search: runSearch,
    };
}

window.ProductsLocationsModal = {
    open: openProductsLocationsModal,
};