// ╔════════════════════════════════════════════════════════════╗
// ║ pcp.common.js — Utilitários compartilhados das telas do PCP ║
// ╚════════════════════════════════════════════════════════════╝

import { apiFetch } from '/public/includes/js/apiFetch.js';

export const API = '/api/pcp';

export const STATUS_LABEL = {
  PLANEJADA: 'Planejada',
  LIBERADA: 'Liberada',
  EM_PRODUCAO: 'Em produção',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

/** Chama a API do PCP e devolve apenas o "data" da resposta. */
export async function pcpApi(path, { method = 'GET', body } = {}) {
  const res = await apiFetch(`${API}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res?.data;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function fmtNum(value, max = 3, min = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
}

export function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-');
  return d ? `${d}/${m}/${y}` : s;
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function toInputDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function statusBadge(status) {
  return `<span class="pcp-badge pcp-badge--${escapeHtml(status)}">${escapeHtml(STATUS_LABEL[status] || status)}</span>`;
}

export function activeBadge(active) {
  return `<span class="pcp-badge ${active ? 'pcp-badge--active' : 'pcp-badge--inactive'}">${active ? 'Ativo' : 'Inativo'}</span>`;
}

/** Mensagem dentro do modal (erro / sucesso / aviso). */
export function showMessage(el, text, kind = 'error') {
  if (!el) return;
  if (!text) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.className = `pcp-form-message is-${kind}`;
  el.innerHTML = Array.isArray(text) ? text.map(escapeHtml).join('<br>') : escapeHtml(text);
  el.hidden = false;
}

/** Aviso global do ERP (window.Alert do core.js), com fallback. */
export function notify(kind, title, message = '') {
  if (window.Alert?.[kind]) window.Alert[kind](title, message);
  else if (kind === 'error') alert(`${title}\n${message}`);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Liga um <input> a um <datalist> com a busca de produtos do PCP.
 * O valor digitado/selecionado fica no formato "CODIGO — Descrição";
 * use productCodeOf() para extrair o código.
 * kind: 'producible' (produto acabado / em processo) ou 'component' (matéria-prima,
 * embalagem...), conforme o Tipo do item do cadastro de produtos.
 */
export function attachProductSearch(input, datalist, kind = '', enabled = () => true) {
  const search = debounce(async () => {
    const q = input.value.split(' — ')[0].trim();
    if (q.length < 2 || !enabled()) return;
    try {
      const params = new URLSearchParams({ q });
      if (kind) params.set('kind', kind);
      const rows = await pcpApi(`/products?${params}`);
      datalist.innerHTML = (rows || [])
        .map((p) => `<option value="${escapeHtml(`${p.product_code} — ${p.description || ''}`)}"></option>`)
        .join('');
    } catch {
      /* busca silenciosa */
    }
  });
  input.addEventListener('input', search);
}

/** Igual a attachProductSearch, mas busca no cadastro de Matérias-primas. */
export function attachRawMaterialSearch(input, datalist, enabled = () => true) {
  const search = debounce(async () => {
    const q = input.value.split(' — ')[0].trim();
    if (q.length < 2 || !enabled()) return;
    try {
      const rows = await pcpApi(`/raw-materials/search?${new URLSearchParams({ q })}`);
      datalist.innerHTML = (rows || [])
        .map((m) => `<option value="${escapeHtml(`${m.code} — ${m.description || ''}`)}"></option>`)
        .join('');
    } catch {
      /* busca silenciosa */
    }
  });
  input.addEventListener('input', search);
}

export function productCodeOf(value) {
  return String(value || '').split(' — ')[0].trim();
}

export function productLabel(code, description) {
  if (!code) return '';
  return description ? `${code} — ${description}` : code;
}

/** Paginação simples no padrão das telas do ERP. */
export function paginate(rows, state) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * state.pageSize;
  return { slice: rows.slice(start, start + state.pageSize), total, pages };
}

export function bindPagination(state, ids, render) {
  const $ = (id) => document.getElementById(id);
  $(ids.prev)?.addEventListener('click', () => { if (state.page > 1) { state.page--; render(); } });
  $(ids.next)?.addEventListener('click', () => { state.page++; render(); });
  $(ids.size)?.addEventListener('change', (e) => { state.pageSize = Number(e.target.value) || 50; state.page = 1; render(); });
}

export function renderPagination(ids, { total, pages }, state, noun = 'registros') {
  const $ = (id) => document.getElementById(id);
  if ($(ids.info)) $(ids.info).textContent = `${total} ${noun}`;
  if ($(ids.pageInfo)) $(ids.pageInfo).textContent = `Página ${state.page} de ${pages}`;
  if ($(ids.prev)) $(ids.prev).disabled = state.page <= 1;
  if ($(ids.next)) $(ids.next).disabled = state.page >= pages;
}
