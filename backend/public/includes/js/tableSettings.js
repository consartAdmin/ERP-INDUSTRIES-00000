// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tableSettings.js — Engrenagem ⚙️ reutilizável para tabelas (ESM)     ║
// ║ PRODNEX ERP                                                          ║
// ║                                                                      ║
// ║ Tabela: altura das linhas, largura e altura da área da tabela.       ║
// ║ Exibição: linhas por página (select "Mostrar" do rodapé) e ordenação ║
// ║   inicial (cabeçalhos th[data-sort-column] do sortableTable.js).     ║
// ║ Por coluna: visível, largura e alinhamento (título e dados).         ║
// ║ Salvo por USUÁRIO no banco (/api/user-table-preferences/:tableKey).  ║
// ║ O localStorage fica só como cache para aplicar o layout sem piscar.  ║
// ║ Aplicado por um <style> gerado: sobrevive a cada re-render da tabela.║
// ║                                                                      ║
// ║ Automático: toda .table-scroll(--rounded) com <thead> ganha a ⚙️.   ║
// ║   data-table-settings="off"       → desliga nesta tabela             ║
// ║   data-table-settings="modulo.x"  → chave própria (padrão: página+nº)║
// ║   data-table-settings-manual      → a tela chama createTableSettings ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { Modal } from '/public/includes/js/modal.js';

const PREFS_URL = '/api/user-table-preferences/';
const CACHE_PREFIX = 'consart.tableSettings.v1.';
const TABLE_PREF = '__table'; // chave reservada: opções da tabela inteira
const KEY_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;
const SPECIFICITY_BOOST = '#ts-boost#ts-boost#ts-boost';

const COL_WIDTH = { min: 40, max: 1200 };
const ROW_HEIGHT = { min: 18, max: 120 };
const TABLE_HEIGHT = { min: 120, max: 3000 };
const TABLE_WIDTH = { '%': { min: 20, max: 100 }, px: { min: 300, max: 6000 } };
const PAGE_SIZE = { min: 1, max: 1000 };
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const SORT_COLUMN_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;
const PAGE_SIZE_SELECT = '.table-footer__page-size-select';

const ALIGNS = [
  { value: '', label: 'Padrão' },
  { value: 'left', label: '⬅ Esquerda' },
  { value: 'center', label: '↔ Centro' },
  { value: 'right', label: '➡ Direita' },
];
const ALIGN_VALUES = new Set(['left', 'center', 'right']);

const instances = new Map(); // tableKey → instância

/* ---------------------------------------------------------------- helpers */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clone = (obj) => JSON.parse(JSON.stringify(obj || {}));

const slug = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inRange(value, { min, max }) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

function resolveElement(value) {
  return typeof value === 'string' ? document.querySelector(value) : value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera o elemento ficar sem mutações por `quietMs` (a tela terminou de renderizar). */
function waitIdle(el, { quietMs = 300, maxMs = 6000 } = {}) {
  return new Promise((resolve) => {
    let quietTimer = null;
    const done = () => {
      observer.disconnect();
      clearTimeout(quietTimer);
      clearTimeout(maxTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(done, quietMs);
    });
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    quietTimer = setTimeout(done, quietMs);
    const maxTimer = setTimeout(done, maxMs);
  });
}

/** Espera o <tbody> receber a primeira linha (dados carregados). */
function waitFirstRows(getTable, maxMs = 15000) {
  const hasRows = () => (getTable()?.tBodies[0]?.rows.length || 0) > 0;
  if (hasRows()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (hasRows()) return resolve(true);
      if (Date.now() - started > maxMs) return resolve(false);
      setTimeout(tick, 150);
    };
    tick();
  });
}

/* ------------------------------------------------------------ instância */

/**
 * Liga a engrenagem a uma tabela.
 *
 * @param {object} options
 * @param {HTMLElement|string} options.wrapper  .table-scroll (ou seletor) que contém a <table>.
 * @param {string} options.tableKey             Chave salva no banco (ex.: 'products.list').
 * @param {HTMLElement|string} [options.trigger] Botão próprio; sem ele a engrenagem é injetada.
 * @param {() => Array<{key: string, label: string, cls: string, width?: number, locked?: boolean}>} [options.columns]
 *        Colunas fixas por classe CSS. Sem isso as colunas são lidas do <thead>.
 * @param {string} [options.cacheKey]           Chave do localStorage (padrão derivado do tableKey).
 * @param {(ctx: {widthOf: (key: string) => (number|null), tableSel: string}) => string[]} [options.extraRules]
 */
export function createTableSettings(options = {}) {
  const wrapper = resolveElement(options.wrapper);
  const tableKey = String(options.tableKey || '').trim();
  if (!(wrapper instanceof HTMLElement) || !KEY_PATTERN.test(tableKey)) {
    console.warn('[tableSettings] wrapper ou tableKey inválido:', options.tableKey);
    return null;
  }
  const existing = instances.get(tableKey);
  if (existing) {
    // a tela recriou a .table-scroll (innerHTML no pai): a instância passa para o novo elemento
    if (existing.wrapper !== wrapper && !existing.wrapper.isConnected) existing.attach(wrapper);
    return existing.api;
  }

  const cacheKey = options.cacheKey || `${CACHE_PREFIX}${tableKey}`;
  // O que o usuário escolhe na engrenagem precisa vencer o CSS do módulo, que às vezes
  // força tamanhos com !important (ex.: budgets.list.mobile.css). :is() assume a maior
  // especificidade entre seus argumentos; o #id nunca casa, só eleva a especificidade.
  const boost = (sel) => `:is(${sel}, ${SPECIFICITY_BOOST})`;
  const scopeSel = boost(`[data-ts-key="${tableKey}"]`);
  const shellSel = boost(`[data-ts-shell="${tableKey}"]`);
  const tableSel = boost(`table[data-ts-table="${tableKey}"]`);

  const inst = {
    tableKey,
    wrapper: null,
    trigger: null,
    prefs: readCache(cacheKey),
    savedPrefs: {},
    dirty: false,
    style: null,
    explicitColumns: typeof options.columns === 'function' ? options.columns : null,
  };
  inst.savedPrefs = clone(inst.prefs);

  const getTable = () => {
    const table = inst.wrapper.querySelector('table');
    if (table && table.dataset.tsTable !== tableKey) table.dataset.tsTable = tableKey;
    return table;
  };

  /* ---------------- colunas */

  function readHeaderColumns() {
    const row = getTable()?.querySelector(':scope > thead > tr:last-child');
    if (!row) return [];
    const cells = [...row.children].filter((c) => c.tagName === 'TH' || c.tagName === 'TD');
    // cabeçalho com colspan não casa posição a posição com o corpo
    if (cells.some((c) => c.colSpan > 1)) return [];

    const used = new Set();
    return cells.map((cell, i) => {
      const label = cell.textContent.replace(/[↕↑↓]/g, '').replace(/\s+/g, ' ').trim();
      const colClass = [...cell.classList].find((c) => /^col-/.test(c));
      let key = colClass || cell.dataset.sortColumn || slug(label) || `col-${i + 1}`;
      for (let n = 2; used.has(key); n += 1) key = `${key.replace(/~\d+$/, '')}~${n}`;
      used.add(key);

      const nth = `:nth-child(${i + 1})`;
      return {
        key,
        label: label || `Coluna ${i + 1}`,
        th: `${tableSel} > thead > tr > ${cell.tagName.toLowerCase()}${nth}`,
        td: `${tableSel} > tbody > tr > td${nth}:not([colspan])`,
        cell,
      };
    });
  }

  function getColumns() {
    if (!inst.explicitColumns) return readHeaderColumns();
    return inst.explicitColumns().map((col) => ({
      ...col,
      th: `${tableSel} th.${col.cls}`,
      td: `${tableSel} td.${col.cls}`,
      cell: getTable()?.querySelector(`thead th.${col.cls}`) || null,
    }));
  }

  const isVisible = (col) => col.locked || inst.prefs[col.key]?.hidden !== true;

  function widthOf(key) {
    return inRange(inst.prefs[key]?.width, COL_WIDTH);
  }

  function alignOf(col, part) {
    const value = inst.prefs[col.key]?.[part];
    return ALIGN_VALUES.has(value) ? value : '';
  }

  function tablePrefs() {
    const t = inst.prefs[TABLE_PREF] || {};
    const widthUnit = t.widthUnit === 'px' ? 'px' : '%';
    return {
      rowHeight: inRange(t.rowHeight, ROW_HEIGHT),
      height: inRange(t.height, TABLE_HEIGHT),
      width: inRange(t.width, TABLE_WIDTH[widthUnit]),
      widthUnit,
      pageSize: inRange(t.pageSize, PAGE_SIZE),
      sortColumn: SORT_COLUMN_PATTERN.test(String(t.sortColumn || '')) ? t.sortColumn : '',
      sortDir: t.sortDir === 'desc' ? 'desc' : 'asc',
    };
  }

  /* ---------------- exibição: linhas por página e ordenação */

  /** Select "Mostrar" do rodapé mais próximo da tabela. */
  function findPageSizeSelect() {
    for (let el = inst.wrapper.parentElement; el && el !== document.body; el = el.parentElement) {
      const select = el.querySelector(PAGE_SIZE_SELECT);
      if (select) return select;
    }
    return null;
  }

  /** Cabeçalhos ordenáveis (sortableTable.js): [{ column, label, th }]. */
  function getSortColumns() {
    const headers = getTable()?.querySelectorAll(':scope > thead th[data-sort-column]') || [];
    return [...headers].map((th) => ({
      column: th.dataset.sortColumn,
      label: th.textContent.replace(/[↕↑↓]/g, '').replace(/\s+/g, ' ').trim() || th.dataset.sortColumn,
      th,
    })).filter((c) => SORT_COLUMN_PATTERN.test(c.column));
  }

  let behaviorRun = 0;

  /**
   * Aplica linhas por página e ordenação pelos próprios controles da tela
   * (dispara o "change" do Mostrar e clica no cabeçalho), então funciona
   * tanto com paginação/ordenação no navegador quanto no backend.
   */
  async function applyBehavior() {
    const run = ++behaviorRun;
    const t = tablePrefs();
    if (!t.pageSize && !t.sortColumn) return;

    const select = t.pageSize ? findPageSizeSelect() : null;
    if (select && select.value !== String(t.pageSize)) {
      if (![...select.options].some((o) => o.value === String(t.pageSize))) {
        select.add(new Option(`${t.pageSize} linhas`, String(t.pageSize)));
      }
      select.value = String(t.pageSize);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitIdle(inst.wrapper);
      if (run !== behaviorRun) return;
    }

    if (!t.sortColumn) return;
    const want = t.sortDir === 'desc' ? 'descending' : 'ascending';
    // 1º clique numa coluna nova = crescente; 2º = decrescente
    for (let i = 0; i < 3; i += 1) {
      const sortCol = getSortColumns().find((c) => c.column === t.sortColumn);
      if (!sortCol || sortCol.th.getAttribute('aria-sort') === want) return;
      const button = sortCol.th.querySelector('[data-sort-button]') || sortCol.th;
      for (let w = 0; button.disabled && w < 40; w += 1) await sleep(150); // ordenação anterior em andamento
      button.click();
      await waitIdle(inst.wrapper);
      if (run !== behaviorRun) return;
    }
  }

  /** Na abertura da tela: espera os dados chegarem e aplica uma vez. */
  async function applyBehaviorOnLoad() {
    const loaded = await waitFirstRows(getTable);
    if (!loaded) return;
    await waitIdle(inst.wrapper);
    await applyBehavior();
  }

  /* ---------------- aplicação */

  function applyStyles() {
    getTable();
    if (!inst.style) {
      inst.style = document.createElement('style');
      inst.style.dataset.tsStyle = tableKey;
      document.head.appendChild(inst.style);
    }

    const rules = [];
    const t = tablePrefs();

    // a ⚙️ injetada fica no canto direito do cabeçalho: reserva espaço no último título
    if (!options.trigger) {
      rules.push(`${tableSel} > thead > tr > th:last-child { padding-right: 32px !important; }`);
    }

    if (t.rowHeight) {
      const pad = `max(1px, calc((${t.rowHeight}px - var(--table-cell-line-height, 16px)) / 2))`;
      rules.push(`${scopeSel} { --table-row-min-height: ${t.rowHeight}px !important; }`);
      rules.push(`${tableSel} > tbody > tr { height: ${t.rowHeight}px !important; }`);
      rules.push(`${tableSel} > tbody > tr > td, ${tableSel} > tbody > tr > th { padding-top: ${pad} !important; padding-bottom: ${pad} !important; }`);
    }
    // Dentro do .table-layout-integrated o card (filtro + tabela + rodapé) acompanha a tabela:
    // - altura fixa empurraria o rodapé para fora (overflow: hidden + max-height): o card abraça o conteúdo;
    // - largura vai no card inteiro, senão a tabela encolhe e sobra o fundo do card ao lado.
    const parent = inst.wrapper.parentElement;
    const shell = parent?.classList.contains('table-layout-integrated') ? parent : null;
    if (shell && (t.height || t.width)) shell.dataset.tsShell = tableKey;
    else if (shell?.dataset.tsShell === tableKey) delete shell.dataset.tsShell;

    if (t.height) {
      rules.push(`${scopeSel} { height: ${t.height}px !important; max-height: ${t.height}px !important; min-height: 0 !important; flex: 0 0 auto !important; }`);
      rules.push(`${shellSel} { height: auto !important; max-height: none !important; min-height: 0 !important; flex: 0 0 auto !important; }`);
    }
    if (t.width && shell) {
      rules.push(`${shellSel} { width: ${t.width}${t.widthUnit} !important; max-width: 100% !important; }`);
      rules.push(`${scopeSel} { width: 100% !important; max-width: 100% !important; }`);
    } else if (t.width) {
      rules.push(`${scopeSel} { width: ${t.width}${t.widthUnit} !important; max-width: 100% !important; }`);
    }

    getColumns().forEach((col) => {
      const { th, td } = col;
      if (!isVisible(col)) {
        rules.push(`${th}, ${td} { display: none !important; }`);
        return;
      }

      const width = widthOf(col.key);
      if (width) {
        rules.push(`${th}, ${td} { width: ${width}px !important; min-width: ${width}px !important; max-width: ${width}px !important; overflow: hidden; text-overflow: ellipsis; }`);
      }

      const headAlign = alignOf(col, 'alignHead');
      if (headAlign) rules.push(`${th} { text-align: ${headAlign} !important; }`);

      const cellAlign = alignOf(col, 'alignCell');
      if (cellAlign) rules.push(`${td} { text-align: ${cellAlign} !important; }`);
    });

    if (typeof options.extraRules === 'function') {
      rules.push(...(options.extraRules({ widthOf, tableSel }) || []));
    }

    inst.style.textContent = rules.join('\n');
  }

  /* ---------------- persistência */

  async function save() {
    const url = `${PREFS_URL}${tableKey}`;
    // layout vazio = padrão → apaga o registro em vez de guardar {}
    if (Object.keys(inst.prefs).length) {
      await apiFetch(url, { method: 'PUT', body: JSON.stringify({ prefs: inst.prefs }) });
    } else {
      await apiFetch(url, { method: 'DELETE' });
    }
    inst.savedPrefs = clone(inst.prefs);
    writeCache(cacheKey, inst.prefs);
    applyBehavior();
  }

  /** Busca o layout do usuário no banco; na 1ª vez, migra o que estava no navegador. */
  async function loadServerPrefs() {
    const url = `${PREFS_URL}${tableKey}`;
    try {
      const data = await apiFetch(url);
      if (data?.prefs && typeof data.prefs === 'object') {
        if (inst.dirty) return; // usuário já está editando: não sobrescreve
        inst.prefs = data.prefs;
        inst.savedPrefs = clone(inst.prefs);
        writeCache(cacheKey, inst.prefs);
        applyStyles();
        if (isOpenFor(inst)) renderModal();
      } else if (Object.keys(inst.prefs).length) {
        // ainda não existe no banco, mas há layout antigo neste navegador → envia
        await apiFetch(url, { method: 'PUT', body: JSON.stringify({ prefs: inst.prefs }) });
      }
    } catch (err) {
      console.warn(`[tableSettings] ${tableKey}: preferências do servidor indisponíveis, usando cache local:`, err);
    }
  }

  /* ---------------- engrenagem */

  function injectTrigger(wrapper) {
    const anchor = document.createElement('div');
    anchor.className = 'ts-anchor';
    anchor.innerHTML = `<button type="button" class="ts-trigger" title="Configurar tabela"
      aria-label="Configurar tabela" aria-haspopup="dialog" aria-expanded="false">⚙️</button>`;
    // Pai em grid ou flex em linha: um irmão a mais ocuparia uma célula/slot do layout.
    // Nesses casos o anchor vai dentro da própria .table-scroll, grudado no topo (sticky).
    const parentStyle = wrapper.parentElement ? getComputedStyle(wrapper.parentElement) : null;
    const display = parentStyle?.display || '';
    const inner = /grid/.test(display)
      || (/flex/.test(display) && !/column/.test(parentStyle.flexDirection));

    if (inner) {
      anchor.classList.add('ts-anchor--inner');
      wrapper.prepend(anchor);
    } else {
      wrapper.before(anchor);
      // o anchor tem altura 0: compensa o gap do pai para não empurrar a tabela
      const gap = parseFloat(parentStyle?.rowGap) || 0;
      if (gap && /flex/.test(display)) anchor.style.marginBottom = `-${gap}px`;
    }
    inst.anchor = anchor;

    // não cobre a barra de rolagem vertical
    const syncScrollbar = () => {
      anchor.style.setProperty('--ts-scrollbar', `${inner ? 0 : Math.max(0, wrapper.offsetWidth - wrapper.clientWidth)}px`);
      const width = inner ? wrapper.clientWidth : wrapper.offsetWidth;
      anchor.style.width = width ? `${width}px` : '';
    };
    syncScrollbar();
    inst.resizeObserver?.disconnect();
    if ('ResizeObserver' in window) {
      inst.resizeObserver = new ResizeObserver(syncScrollbar);
      inst.resizeObserver.observe(wrapper);
    }

    return anchor.querySelector('button');
  }

  function bindTrigger(button) {
    inst.trigger = button;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isOpenFor(inst)) closeModal();
      else openModal(inst);
    });
  }

  // cabeçalho re-renderizado (colunas dinâmicas, tabela recriada): reaplica as regras
  let queued = false;
  const contentObserver = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      // tela recriou o conteúdo da .table-scroll (innerHTML): devolve a engrenagem interna
      if (inst.anchor && !inst.anchor.isConnected) inst.wrapper.prepend(inst.anchor);
      const head = getTable()?.tHead;
      const signature = head ? head.textContent : '';
      if (signature !== inst.headSignature) {
        inst.headSignature = signature;
        inst.refresh();
      }
    });
  });

  /** Liga a instância a um elemento .table-scroll (na criação ou quando a tela o recria). */
  function attach(el) {
    const previous = inst.wrapper;
    if (previous?.parentElement?.dataset.tsShell === tableKey) delete previous.parentElement.dataset.tsShell;
    inst.wrapper = el;
    el.dataset.tsKey = tableKey;

    if (!options.trigger) {
      inst.anchor?.remove();
      bindTrigger(injectTrigger(el));
    }

    contentObserver.disconnect();
    contentObserver.observe(el, { childList: true, subtree: true });

    inst.headSignature = getTable()?.tHead?.textContent ?? '';
    inst.refresh();
  }

  Object.assign(inst, {
    getColumns, isVisible, widthOf, alignOf, tablePrefs, applyStyles, save, attach,
    findPageSizeSelect, getSortColumns,
    markDirty() {
      inst.dirty = true;
    },
    discard() {
      inst.prefs = clone(inst.savedPrefs);
      inst.dirty = false;
      applyStyles();
    },
    reset() {
      inst.prefs = {};
      applyStyles();
    },
    update(key, patch) {
      const next = { ...(inst.prefs[key] || {}), ...patch };
      Object.keys(next).forEach((k) => (next[k] == null || next[k] === '') && delete next[k]);
      if (Object.keys(next).length) inst.prefs[key] = next;
      else delete inst.prefs[key];
      applyStyles(); // pré-visualiza na tabela
    },
    refresh() {
      applyStyles();
      if (isOpenFor(inst)) renderModal();
    },
  });

  inst.api = Object.freeze({
    tableKey,
    refresh: inst.refresh,
    open: () => openModal(inst),
  });

  const ownTrigger = resolveElement(options.trigger);
  if (ownTrigger) bindTrigger(ownTrigger);

  instances.set(tableKey, inst);
  attach(wrapper);
  loadServerPrefs().finally(applyBehaviorOnLoad);

  return inst.api;
}

/* ---------------------------------------------------------------- cache */

function readCache(cacheKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cacheKey, prefs) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(prefs));
  } catch {
    // modo privado / armazenamento bloqueado: o banco continua valendo
  }
}

/* ------------------------------------------------------- modal (único) */

let modal = null;
let active = null; // instância em edição

const isOpenFor = (inst) => active === inst && Boolean(modal?.classList.contains('is-open'));

function ensureModal() {
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'modal modal-width-8 modal-height-8 ts-modal';
  modal.id = 'tableSettingsModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__backdrop" data-ts-close></div>
    <div class="modal__dialog">
      <section class="modal__panel" role="dialog"
        aria-modal="true" aria-labelledby="tableSettingsModalTitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <div>
            <h2 class="modal__title" id="tableSettingsModalTitle">⚙️ Configurar tabela</h2>
            <p class="ts-subtitle">As mudanças aparecem na tabela e só valem após Salvar.</p>
          </div>
          <button type="button" class="modal__close" data-ts-close aria-label="Fechar modal" title="Fechar">×</button>
        </header>

        <div class="modal__body">
          <section class="ts-section">
            <h3 class="ts-section__title">Tabela</h3>
            <div class="ts-table-fields">
              <label class="ts-field">
                <span>Altura das linhas (px)</span>
                <input type="number" class="ts-input" data-ts-table="rowHeight"
                  min="${ROW_HEIGHT.min}" max="${ROW_HEIGHT.max}" step="1">
              </label>
              <label class="ts-field">
                <span>Altura da tabela (px)</span>
                <input type="number" class="ts-input" data-ts-table="height"
                  min="${TABLE_HEIGHT.min}" max="${TABLE_HEIGHT.max}" step="10">
              </label>
              <div class="ts-field">
                <span>Largura da tabela</span>
                <div class="ts-field__group">
                  <input type="number" class="ts-input" data-ts-table="width" step="1" aria-label="Largura da tabela">
                  <select class="ts-input ts-unit" data-ts-table="widthUnit" aria-label="Unidade da largura">
                    <option value="%">%</option>
                    <option value="px">px</option>
                  </select>
                </div>
              </div>
            </div>
            <p class="ts-hint">Vazio = tamanho padrão da tela.</p>
          </section>

          <section class="ts-section" data-ts-behavior-section>
            <h3 class="ts-section__title">Exibição</h3>
            <div class="ts-table-fields">
              <label class="ts-field" data-ts-pagesize-field>
                <span>Linhas por página</span>
                <select class="ts-input" data-ts-table="pageSize"></select>
              </label>
              <label class="ts-field" data-ts-sort-field>
                <span>Ordenar por</span>
                <select class="ts-input ts-input--wide" data-ts-table="sortColumn"></select>
              </label>
              <label class="ts-field" data-ts-sort-field>
                <span>Ordem</span>
                <select class="ts-input" data-ts-table="sortDir">
                  <option value="asc">↑ Crescente</option>
                  <option value="desc">↓ Decrescente</option>
                </select>
              </label>
            </div>
            <p class="ts-hint">Aplicado ao abrir a tela e ao Salvar. Padrão = como a tela já abre hoje.</p>
          </section>

          <section class="ts-section" data-ts-columns-section>
            <h3 class="ts-section__title">Colunas</h3>
            <table class="table table-zebra ts-cols" aria-label="Configuração das colunas">
              <thead>
                <tr>
                  <th class="ts-col-show">Mostrar</th>
                  <th class="ts-col-name">Coluna</th>
                  <th class="ts-col-width">Largura (px)</th>
                  <th class="ts-col-align">Alinhar título</th>
                  <th class="ts-col-align">Alinhar dados</th>
                </tr>
              </thead>
              <tbody data-ts-cols></tbody>
            </table>
          </section>
        </div>

        <footer class="modal__footer">
          <span class="ts-status" data-ts-status aria-live="polite"></span>
          <button type="button" class="btn btn-clean btn-sm" data-ts-reset>Restaurar padrão</button>
          <button type="button" class="btn btn-cancel btn-sm" data-ts-close>Fechar</button>
          <button type="button" class="btn btn-save btn-sm" data-ts-save disabled>💾 Salvar</button>
        </footer>
      </section>
    </div>`;
  document.body.appendChild(modal);
  Modal.setup(); // foco preso no modal (Tab); Esc/fechar passam pelo closeModal abaixo

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-ts-close]')) closeModal();
    else if (event.target.closest('[data-ts-reset]')) {
      active.reset();
      renderModal();
      markDirty();
    } else if (event.target.closest('[data-ts-save]')) saveActive();
  });

  modal.addEventListener('change', handleColumnChange);
  modal.addEventListener('input', handleInput);

  // captura: roda antes do Esc global do modal.js, que fecharia sem perguntar
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !active || !modal.classList.contains('is-open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeModal();
  }, true);

  return modal;
}

function setStatus(text, kind = '') {
  const el = modal?.querySelector('[data-ts-status]');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function markDirty() {
  active.markDirty();
  setStatus('● Alterações não salvas', 'dirty');
  modal.querySelector('[data-ts-save]').disabled = false;
}

function markClean(text = '', kind = '') {
  if (active) active.dirty = false;
  setStatus(text, kind);
  modal.querySelector('[data-ts-save]').disabled = true;
}

async function saveActive() {
  const btn = modal.querySelector('[data-ts-save]');
  btn.disabled = true;
  setStatus('Salvando…');
  try {
    await active.save();
    markClean('✓ Salvo no seu usuário', 'ok');
  } catch (err) {
    console.warn(`[tableSettings] ${active.tableKey}: falha ao salvar preferências:`, err);
    setStatus('Não foi possível salvar. Tente novamente.', 'error');
    btn.disabled = false;
  }
}

function alignSelect(inst, col, part, label) {
  const current = inst.alignOf(col, part);
  const opts = ALIGNS.map((a) =>
    `<option value="${a.value}" ${a.value === current ? 'selected' : ''}>${a.label}</option>`).join('');
  return `<select class="ts-input" data-ts-align="${part}" aria-label="${esc(label)}">${opts}</select>`;
}

function renderTableFields() {
  const t = active.tablePrefs();
  const { wrapper } = active;
  const table = wrapper.querySelector('table');
  const firstRow = table?.tBodies[0]?.rows[0];
  const range = TABLE_WIDTH[t.widthUnit];

  const set = (name, value, placeholder) => {
    const input = modal.querySelector(`[data-ts-table="${name}"]`);
    input.value = value ?? '';
    if (placeholder !== undefined) input.placeholder = placeholder;
    return input;
  };

  set('rowHeight', t.rowHeight, firstRow ? Math.round(firstRow.offsetHeight) : '');
  set('height', t.height, wrapper.offsetHeight ? Math.round(wrapper.offsetHeight) : '');
  const width = set('width', t.width, t.widthUnit === '%' ? 100 : Math.round(wrapper.offsetWidth) || '');
  width.min = range.min;
  width.max = range.max;
  set('widthUnit', t.widthUnit);
  renderBehaviorFields(t);
}

function renderBehaviorFields(t) {
  const pageSelect = active.findPageSizeSelect();
  const sortColumns = active.getSortColumns();

  modal.querySelector('[data-ts-pagesize-field]').hidden = !pageSelect;
  modal.querySelectorAll('[data-ts-sort-field]').forEach((el) => { el.hidden = sortColumns.length === 0; });
  modal.querySelector('[data-ts-behavior-section]').hidden = !pageSelect && sortColumns.length === 0;

  const sizes = new Set(PAGE_SIZE_OPTIONS);
  if (pageSelect) [...pageSelect.options].forEach((o) => { const n = inRange(o.value, PAGE_SIZE); if (n) sizes.add(n); });
  if (t.pageSize) sizes.add(t.pageSize);
  const pageOpts = [...sizes].sort((a, b) => a - b)
    .map((n) => `<option value="${n}" ${n === t.pageSize ? 'selected' : ''}>${n} linhas</option>`).join('');
  modal.querySelector('[data-ts-table="pageSize"]').innerHTML =
    `<option value="" ${t.pageSize ? '' : 'selected'}>Padrão da tela</option>${pageOpts}`;

  const sortOpts = sortColumns.map((c) =>
    `<option value="${esc(c.column)}" ${c.column === t.sortColumn ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
  modal.querySelector('[data-ts-table="sortColumn"]').innerHTML =
    `<option value="" ${t.sortColumn ? '' : 'selected'}>Padrão da tela</option>${sortOpts}`;

  const dir = modal.querySelector('[data-ts-table="sortDir"]');
  dir.value = t.sortDir;
  dir.disabled = !t.sortColumn;
}

function renderModal() {
  if (!modal || !active) return;
  renderTableFields();

  const columns = active.getColumns();
  modal.querySelector('[data-ts-columns-section]').hidden = columns.length === 0;

  modal.querySelector('[data-ts-cols]').innerHTML = columns.map((col) => {
    const width = active.widthOf(col.key);
    const name = esc(col.label);
    const visible = active.isVisible(col);
    const fallback = col.width || (col.cell?.offsetWidth ? Math.round(col.cell.offsetWidth) : '');
    return `
      <tr data-key="${esc(col.key)}" class="${visible ? '' : 'is-hidden'}">
        <td class="ts-col-show">
          <input type="checkbox" data-ts-visible aria-label="Mostrar ${name}"
            ${visible ? 'checked' : ''} ${col.locked ? 'disabled title="Coluna fixa da tabela"' : ''}>
        </td>
        <td class="ts-col-name">${name}${col.locked ? ' <small class="ts-locked">fixa</small>' : ''}</td>
        <td class="ts-col-width">
          <input type="number" class="ts-input ts-width" data-ts-width min="${COL_WIDTH.min}" max="${COL_WIDTH.max}" step="10"
            placeholder="${fallback}" value="${width ?? ''}" aria-label="Largura de ${name}"
            title="Largura em px (vazio = padrão${fallback ? ` ${fallback}px` : ''})">
        </td>
        <td class="ts-col-align">${alignSelect(active, col, 'alignHead', `Alinhamento do título de ${col.label}`)}</td>
        <td class="ts-col-align">${alignSelect(active, col, 'alignCell', `Alinhamento dos dados de ${col.label}`)}</td>
      </tr>`;
  }).join('');
}

function openModal(inst) {
  ensureModal();
  if (active && active !== inst && modal.classList.contains('is-open') && !closeModal()) return;

  active = inst;
  renderModal();
  markClean();
  Modal.open(modal, { focusSelector: '.modal__close' });
  inst.trigger?.setAttribute('aria-expanded', 'true');
}

/** Fecha o modal; com alterações não salvas, pergunta antes de descartar. */
function closeModal() {
  if (!modal || !active) return true;
  if (active.dirty) {
    if (!confirm('Há alterações não salvas na tabela. Descartar e fechar?')) return false;
    active.discard();
  }
  Modal.close(modal); // devolve o foco para a ⚙️
  active.trigger?.setAttribute('aria-expanded', 'false');
  active = null;
  return true;
}

function handleColumnChange(event) {
  if (!active) return;

  if (event.target.matches('[data-ts-table="widthUnit"]')) {
    // trocar a unidade invalida o número digitado
    active.update(TABLE_PREF, { widthUnit: event.target.value === 'px' ? 'px' : null, width: null });
    renderTableFields();
    markDirty();
    return;
  }

  const behaviorField = event.target.dataset.tsTable;
  if (behaviorField === 'pageSize' || behaviorField === 'sortColumn' || behaviorField === 'sortDir') {
    const value = event.target.value;
    if (behaviorField === 'pageSize') active.update(TABLE_PREF, { pageSize: inRange(value, PAGE_SIZE) });
    else if (behaviorField === 'sortColumn') active.update(TABLE_PREF, value ? { sortColumn: value } : { sortColumn: null, sortDir: null });
    else active.update(TABLE_PREF, { sortDir: value === 'desc' ? 'desc' : null });
    renderBehaviorFields(active.tablePrefs());
    markDirty();
    return;
  }

  const row = event.target.closest('tr[data-key]');
  const key = row?.dataset.key;
  if (!key) return;

  if (event.target.matches('[data-ts-visible]')) {
    active.update(key, { hidden: event.target.checked ? null : true });
    row.classList.toggle('is-hidden', !event.target.checked);
    markDirty();
  } else if (event.target.matches('[data-ts-align]')) {
    active.update(key, { [event.target.dataset.tsAlign]: event.target.value || null });
    markDirty();
  }
}

function handleInput(event) {
  if (!active) return;
  const raw = String(event.target.value).trim();

  // vazio = volta ao padrão; valores fora da faixa são ignorados até ficarem válidos
  const field = event.target.dataset.tsTable;
  if (field === 'rowHeight' || field === 'height' || field === 'width') {
    const range = field === 'rowHeight' ? ROW_HEIGHT
      : field === 'height' ? TABLE_HEIGHT
        : TABLE_WIDTH[active.tablePrefs().widthUnit];
    const value = inRange(raw, range);
    if (!raw) active.update(TABLE_PREF, { [field]: null });
    else if (value != null) active.update(TABLE_PREF, { [field]: value });
    else return;
    markDirty();
    return;
  }

  const key = event.target.closest('tr[data-key]')?.dataset.key;
  if (!key || !event.target.matches('[data-ts-width]')) return;

  const width = inRange(raw, COL_WIDTH);
  if (!raw) active.update(key, { width: null });
  else if (width != null) active.update(key, { width });
  else return;
  markDirty();
}

/* ------------------------------------------------------ auto-instalação */

function pageModule() {
  const match = location.pathname.match(/\/public\/([^/]+)\//);
  return slug(match?.[1] || location.pathname.split('/').filter(Boolean).at(-2) || 'page') || 'page';
}

let autoIndex = 0;

function autoBind(root = document) {
  const wrappers = root.querySelectorAll?.(':is(.table-scroll, .table-scroll--rounded):not([data-ts-key])') || [];
  wrappers.forEach((wrapper) => {
    const setting = wrapper.dataset.tableSettings;
    if (setting === 'off' || wrapper.hasAttribute('data-table-settings-manual')) return;
    if (wrapper.closest('.modal')) return; // tabelas dentro de modais ficam de fora
    if (!wrapper.querySelector('table > thead')) return; // ainda sem tabela: tenta de novo depois

    autoIndex += 1;
    const id = slug(wrapper.id || wrapper.querySelector('table')?.id || '') || `t${autoIndex}`;
    const tableKey = (setting && KEY_PATTERN.test(setting) ? setting : `${pageModule()}.${id}`).slice(0, 80);
    createTableSettings({ wrapper, tableKey });
  });
}

function setupAuto() {
  autoBind();

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      autoBind();
    });
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuto, { once: true });
} else {
  setupAuto();
}

export default createTableSettings;
