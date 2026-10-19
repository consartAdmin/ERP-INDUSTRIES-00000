// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellersModalSearch.js — Modal CONSART para buscar VENDEDORES         ║
// ║ exporta: openSellersModalSearch({ apiBase, onPick(seller), opts })   ║
// ║ Layout padrão MODALS.CSS + controle pelo MODAL.JS                    ║
// ║ (.modal > backdrop + dialog > panel com header / body / footer).     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';

const LAYER_ID = 'sellers-modal-layer-consart';
const CSS_HREF = '/public/modalsSearch/sellersModalSearch.css';

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

function pickSellerId(s) {
  return s?.seller_id ?? s?.id ?? s?.sellerId ?? s?.vendedor_id ?? s?.vendedorId ?? null;
}

function pickName(s) {
  return s?.name ?? s?.nome ?? s?.full_name ?? s?.fullName ?? s?.apelido ?? s?.nickname ?? '';
}

function pickDoc(s) {
  return s?.cpf ?? s?.cnpj ?? s?.document ?? s?.doc ?? s?.tax_id ?? '';
}

export function openSellersModalSearch({ apiBase = '', onPick, opts = {}, headers = {} } = {}) {
  const base = String(apiBase || '').trim().replace(/\/$/, '') || window.location.origin;

  const cfg = {
    title: 'Buscar Vendedor',
    placeholder: 'Digite nome, ID ou documento do vendedor...',
    limit: 50,
    ...opts,
  };

  // Título sem emoji, como nos demais modais padrão
  const title = String(cfg.title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Buscar Vendedor';

  ensureCss();
  Modal.setup();

  document.getElementById(LAYER_ID)?.remove();

  const layer = document.createElement('div');
  layer.id = LAYER_ID;
  layer.className = 'modal sellers-search-modal';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-7" role="dialog" aria-modal="true"
        aria-labelledby="sellerSearchTitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <h2 id="sellerSearchTitle" class="modal__title">${esc(title)}</h2>
          <button type="button" class="modal__close" data-modal-close
            title="Fechar" aria-label="Fechar">&times;</button>
        </header>

        <div class="modal__body modal-section">
          <div class="fields fields-h-6 fields-w-full fields-font-3">
            <label for="sellerSearchInput">Pesquisar</label>
            <input id="sellerSearchInput" type="text" autocomplete="off"
              placeholder="${esc(cfg.placeholder)}" />
          </div>

          <div class="modal-divider"></div>

          <div class="slms-results">
            <table class="slms-table">
              <thead>
                <tr>
                  <th class="slms-col-code">Código</th>
                  <th>Nome</th>
                  <th class="slms-col-doc">Documento</th>
                </tr>
              </thead>
              <tbody id="sellerSearchTbody">
                <tr><td colspan="3" class="slms-empty">Digite para buscar vendedores.</td></tr>
              </tbody>
            </table>
          </div>

          <p class="slms-hint">Use ↑ ↓ e Enter para selecionar.</p>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button type="button" class="btn btn-cancel btn-sm" data-modal-close>Cancelar</button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(layer);

  const input = layer.querySelector('#sellerSearchInput');
  const tbody = layer.querySelector('#sellerSearchTbody');

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
    tbody.innerHTML = `<tr><td colspan="3" class="slms-empty">${esc(msg)}</td></tr>`;
  }

  function setActiveRow(idx) {
    activeIndex = idx;
    tbody.querySelectorAll('tr[data-idx]').forEach((tr) => {
      tr.classList.toggle('is-active', Number(tr.dataset.idx) === activeIndex);
    });
    tbody.querySelector(`tr[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function renderRows(list) {
    if (!list.length) return renderEmpty('Nenhum vendedor encontrado.');

    rows = list;
    tbody.innerHTML = rows.map((s, idx) => `
      <tr class="slms-row" data-idx="${idx}">
        <td>${esc(pickSellerId(s) ?? '')}</td>
        <td>${esc(pickName(s) || '—')}</td>
        <td>${esc(pickDoc(s))}</td>
      </tr>
    `).join('');

    setActiveRow(0);
  }

  async function fetchRows(term) {
    const params = { limit: String(cfg.limit), offset: '0' };
    const candidates = [
      ['/api/sellers/search', { q: term, ...params }],
      ['/api/sellers', { q: term, ...params }],
      ['/api/sellers', { search: term, ...params }],
      ['/api/vendedores/search', { q: term, ...params }],
      ['/api/vendedores', { q: term, ...params }],
    ];

    let lastErr = null;

    for (const [path, query] of candidates) {
      try {
        const url = new URL(path, base);
        Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));

        const res = await fetch(url.toString(), {
          headers: { Accept: 'application/json', ...headers },
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        return normalizeRows(await res.json());
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('Nenhum endpoint respondeu.');
  }

  function runSearch() {
    clearTimeout(timer);

    const term = input.value.trim();
    if (!term) {
      requestSeq++;
      return renderEmpty('Digite para buscar vendedores.');
    }

    timer = setTimeout(async () => {
      const seq = ++requestSeq;
      try {
        renderEmpty('Buscando...');
        const list = await fetchRows(term);
        if (seq === requestSeq) renderRows(list);
      } catch (err) {
        if (seq !== requestSeq) return;
        console.error('[sellersModalSearch]', err);
        renderEmpty(`Erro ao buscar vendedores: ${err.message || err}`);
      }
    }, 250);
  }

  function pickIndex(idx) {
    const seller = rows[idx];
    if (!seller) return;
    picked = seller;
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

  Modal.open(layer, { focusSelector: '#sellerSearchInput' });
}
