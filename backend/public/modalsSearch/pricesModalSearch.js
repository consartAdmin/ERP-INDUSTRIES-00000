// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pricesModalSearch.js — Modal CONSART para buscar TABELAS DE PREÇO    ║
// ║ exporta: openPricesModalSearch({ apiBase, onPick(price), opts })     ║
// ║ Fonte: GET /api/price-tables?q=&active=true (somente ativas)         ║
// ║ Layout padrão MODALS.CSS + controle pelo MODAL.JS                    ║
// ║ (.modal > backdrop + dialog > panel com header / body / footer).     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';

const LAYER_ID = 'prices-modal-layer-consart';
const CSS_HREF = '/public/modalsSearch/pricesModalSearch.css';

// Garante o CSS mesmo em telas que não o incluem no <head>
function ensureCss() {
  const loaded = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .some((link) => (link.getAttribute('href') || '').startsWith(CSS_HREF));
  if (loaded) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  document.head.appendChild(link);
}

const esc = (v) => String(v ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function normalizeRows(data) {
  const payload = data && data.ok && data.data ? data.data : data;
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return payload.rows || payload.data || payload.items || payload.result || [];
}

function pickPriceId(p) {
  return p?.price_id ?? p?.id ?? null;
}

function pickName(p) {
  return p?.name ?? p?.nome ?? '';
}

function pickDescription(p) {
  return p?.description ?? p?.descricao ?? '';
}

export function openPricesModalSearch({ apiBase = '', onPick, opts = {} } = {}) {
  const base = String(apiBase || '').trim().replace(/\/$/, '') || window.location.origin;

  const cfg = {
    title: 'Buscar Tabela de Preço',
    placeholder: 'Digite o nome ou o código da tabela...',
    limit: 50,
    ...opts,
  };

  // Título sem emoji, como nos demais modais padrão
  const title = String(cfg.title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Buscar Tabela de Preço';

  ensureCss();
  Modal.setup();

  document.getElementById(LAYER_ID)?.remove();

  const layer = document.createElement('div');
  layer.id = LAYER_ID;
  layer.className = 'modal prices-search-modal';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-7" role="dialog" aria-modal="true"
        aria-labelledby="priceSearchTitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <h2 id="priceSearchTitle" class="modal__title">${esc(title)}</h2>
          <button type="button" class="modal__close" data-modal-close
            title="Fechar" aria-label="Fechar">&times;</button>
        </header>

        <div class="modal__body modal-section">
          <div class="fields fields-h-6 fields-w-full fields-font-3">
            <label for="priceSearchInput">Pesquisar</label>
            <input id="priceSearchInput" type="text" autocomplete="off"
              placeholder="${esc(cfg.placeholder)}" />
          </div>

          <div class="modal-divider"></div>

          <div class="prms-results">
            <table class="prms-table">
              <thead>
                <tr>
                  <th class="prms-col-code">Código</th>
                  <th>Nome</th>
                  <th class="prms-col-doc">Descrição</th>
                </tr>
              </thead>
              <tbody id="priceSearchTbody">
                <tr><td colspan="3" class="prms-empty">Carregando tabelas...</td></tr>
              </tbody>
            </table>
          </div>

          <p class="prms-hint">Use ↑ ↓ e Enter para selecionar.</p>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button type="button" class="btn btn-cancel btn-sm" data-modal-close>Cancelar</button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(layer);

  const input = layer.querySelector('#priceSearchInput');
  const tbody = layer.querySelector('#priceSearchTbody');

  let rows = [];
  let activeIndex = -1;
  let timer = null;
  let requestSeq = 0;
  let picked = null;

  // modal.js fecha pelo X, Cancelar, backdrop e ESC; aqui só limpamos
  layer.addEventListener('modal:close', () => {
    clearTimeout(timer);
    requestSeq++;
    layer.remove();
    if (picked && typeof onPick === 'function') onPick(picked);
  });

  function renderEmpty(msg) {
    rows = [];
    activeIndex = -1;
    tbody.innerHTML = `<tr><td colspan="3" class="prms-empty">${esc(msg)}</td></tr>`;
  }

  function setActiveRow(idx) {
    activeIndex = idx;
    tbody.querySelectorAll('tr[data-idx]').forEach((tr) => {
      tr.classList.toggle('is-active', Number(tr.dataset.idx) === activeIndex);
    });
    tbody.querySelector(`tr[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function renderRows(list) {
    if (!list.length) return renderEmpty('Nenhuma tabela encontrada.');

    rows = list;
    tbody.innerHTML = rows.map((s, idx) => `
      <tr class="prms-row" data-idx="${idx}">
        <td>${esc(pickPriceId(s) ?? '')}</td>
        <td>${esc(pickName(s) || '—')}</td>
        <td>${esc(pickDescription(s))}</td>
      </tr>
    `).join('');

    setActiveRow(0);
  }

  async function fetchRows(term) {
    const url = new URL('/api/price-tables', base);
    url.searchParams.set('active', 'true');
    url.searchParams.set('limit', String(cfg.limit));
    url.searchParams.set('page', '1');
    url.searchParams.set('sort', 'name');
    url.searchParams.set('dir', 'asc');

    // Código digitado: busca tudo e filtra pelo price_id
    const isCode = /^\d+$/.test(term);
    if (term && !isCode) url.searchParams.set('q', term);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const list = normalizeRows(await res.json());
    return isCode ? list.filter((p) => String(pickPriceId(p)) === term) : list;
  }

  function runSearch() {
    clearTimeout(timer);

    const term = input.value.trim();

    timer = setTimeout(async () => {
      const seq = ++requestSeq;
      try {
        renderEmpty('Buscando...');
        const list = await fetchRows(term);
        if (seq === requestSeq) renderRows(list);
      } catch (err) {
        if (seq !== requestSeq) return;
        console.error('[pricesModalSearch]', err);
        renderEmpty(`Erro ao buscar tabelas: ${err.message || err}`);
      }
    }, 250);
  }

  function pickIndex(idx) {
    const price = rows[idx];
    if (!price) return;
    picked = price;
    Modal.close(layer);
  }

  input.addEventListener('input', runSearch);

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' && rows.length) {
      ev.preventDefault();
      setActiveRow(Math.min(activeIndex + 1, rows.length - 1));
    } else if (ev.key === 'ArrowUp' && rows.length) {
      ev.preventDefault();
      setActiveRow(Math.max(activeIndex - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (activeIndex >= 0) pickIndex(activeIndex);
      else runSearch();
    }
  });

  tbody.addEventListener('mousemove', (ev) => {
    const tr = ev.target.closest('tr[data-idx]');
    if (tr) setActiveRow(Number(tr.dataset.idx));
  });

  tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-idx]');
    if (tr) pickIndex(Number(tr.dataset.idx));
  });

  Modal.open(layer, { focusSelector: '#priceSearchInput' });
  runSearch();
}
