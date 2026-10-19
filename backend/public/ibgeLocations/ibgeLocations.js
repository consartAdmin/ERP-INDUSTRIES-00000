// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocations.js — UI padrão “Grupos & Subgrupos” | PRODNEX ERP       ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = window.apiBase || location.origin;
const API = `${API_BASE}/api/ibge-locations`;

// endpoint de import
const IMPORT_ENDPOINT = `${API}/import/state`; // POST { state:"MG" }

const el = (id) => document.getElementById(id);

const S = {
  selectedUF: '',
  ufs: [],
  ufsQ: '',
  ufsIncludeInativos: false,

  citiesQ: '',
  citiesIncludeInativos: false,
  citiesLimit: 20,
  citiesOffset: 0,
  citiesPage: 1,
  citiesTotal: null,
  lastCities: [],
  loading: false,
};

function setStatus(msg, type = 'ok') {
  const box = el('statusArea');
  if (!box) return;
  box.classList.remove('is-ok', 'is-err', 'is-warn');
  if (!msg) { box.textContent = ''; return; }
  box.textContent = msg;
  box.classList.add(type === 'err' ? 'is-err' : type === 'warn' ? 'is-warn' : 'is-ok');
}

async function safeJson(url, opts) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; }
  catch { json = { ok: false, error: 'Invalid JSON', raw: text }; }
  if (!res.ok) return { ok: false, status: res.status, ...json };
  return json || { ok: true };
}

function toUF(v) {
  const s = String(v || '').trim().toUpperCase();
  return s ? s.slice(0, 2) : '';
}

function chip(status) {
  return status
    ? `<span class="chip chip--on">Ativo</span>`
    : `<span class="chip chip--off">Inativo</span>`;
}

/* ===============================
 * UFs (derivadas da tabela)
 * =============================== */
async function loadUFs() {
  const params = new URLSearchParams();

  // Se incluir inativos, não filtra status (não envia)
  if (!S.ufsIncludeInativos) params.set('status', 'true');

  params.set('limit', '5000');
  params.set('offset', '0');

  const j = await safeJson(`${API}?${params.toString()}`);
  if (!j.ok) { setStatus(j.error || 'Erro ao carregar UFs', 'err'); return; }

  const rows = Array.isArray(j.data)
    ? j.data
    : (Array.isArray(j.data?.rows) ? j.data.rows : []);

  const map = new Map();
  for (const r of rows) {
    const uf = (r.state || '').trim();
    if (!uf) continue;
    const cur = map.get(uf) || { uf, name: uf, activeCount: 0, inactiveCount: 0 };
    if (r.status === false) cur.inactiveCount++;
    else cur.activeCount++;
    map.set(uf, cur);
  }

  let ufs = Array.from(map.values()).sort((a, b) => a.uf.localeCompare(b.uf));

  if (S.ufsQ) {
    const q = S.ufsQ.toUpperCase();
    ufs = ufs.filter(x => x.uf.includes(q) || (x.name || '').toUpperCase().includes(q));
  }

  S.ufs = ufs;
  renderUFs();
}

function renderUFs() {
  const tb = el('tblUfs')?.querySelector('tbody');
  if (!tb) return;

  tb.innerHTML = '';

  for (const u of S.ufs) {
    const isSelected = S.selectedUF && S.selectedUF === u.uf;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${u.uf}</b></td>
      <td>${u.name || u.uf}</td>
      <td>${chip((u.activeCount || 0) > 0)}</td>
      <td>
        <div class="actions">
          <button class="action-btn" data-act="select" data-uf="${u.uf}" title="Selecionar">🎯</button>
          <button class="action-btn" data-act="new" data-uf="${u.uf}" title="Nova cidade nessa UF">＋</button>
        </div>
      </td>
    `;

    if (isSelected) tr.style.background = 'rgba(0,0,0,0.03)';
    tb.appendChild(tr);
  }

  const info = el('ufsInfo');
  if (info) info.textContent = `${S.ufs.length} UF(s)`;

  tb.onclick = async (ev) => {
    const btn = ev.target?.closest?.('button[data-act]');
    if (!btn) return;

    const act = btn.getAttribute('data-act');
    const uf = btn.getAttribute('data-uf');

    if (act === 'select') {
      S.selectedUF = uf;
      S.citiesOffset = 0;
      S.citiesTotal = null;
      await loadCities();
      renderSelectedHint();
      renderUFs();
      return;
    }

    if (act === 'new') {
      openModal('city', { state: uf });
    }
  };
}

function renderSelectedHint() {
  const hint = el('selectedUfHint');
  if (!hint) return;

  if (!S.selectedUF) {
    hint.firstChild.textContent = 'Nenhuma UF selecionada. Clique em uma UF à esquerda para filtrar.';
    return;
  }
  hint.firstChild.textContent = `Filtro ativo: UF ${S.selectedUF}`;
}

/* ===============================
 * Cidades (direita)
 * =============================== */
function parseCitiesResponse(j) {
  // Aceita vários formatos sem quebrar
  let rows = [];
  let total = null;

  if (!j || !j.ok) return { rows: [], total: null };

  if (Array.isArray(j.data)) {
    rows = j.data;
    if (j.pagination && Number.isFinite(Number(j.pagination.total))) total = Number(j.pagination.total);
    return { rows, total };
  }

  if (j.data && Array.isArray(j.data.rows)) {
    rows = j.data.rows;
    if (Number.isFinite(Number(j.data.total))) total = Number(j.data.total);
    return { rows, total };
  }

  if (j.data && Array.isArray(j.data.items)) {
    rows = j.data.items;
    if (Number.isFinite(Number(j.data.total))) total = Number(j.data.total);
    return { rows, total };
  }

  if (j.data && Array.isArray(j.data.data)) {
    rows = j.data.data;
    if (Number.isFinite(Number(j.data.total))) total = Number(j.data.total);
    return { rows, total };
  }

  return { rows: [], total: null };
}

async function loadCities() {
  if (S.loading) return;
  S.loading = true;

  // ✅ status mostra offset/limit (ajuda debug)
  setStatus(`Carregando... (offset=${S.citiesOffset}, limit=${S.citiesLimit})`, 'warn');

  try {
    const params = new URLSearchParams();

    if (S.selectedUF) params.set('state', S.selectedUF);
    if (S.citiesQ) params.set('q', S.citiesQ);

    // ✅ se incluir inativos, NÃO enviar status
    if (!S.citiesIncludeInativos) params.set('status', 'true');

    params.set('limit', String(S.citiesLimit));
    params.set('offset', String(S.citiesOffset));

    // ✅ pede total (se backend suportar)
    params.set('includeTotal', 'true');

    const j = await safeJson(`${API}?${params.toString()}`);
    if (!j.ok) {
      setStatus(j.error || 'Erro ao carregar cidades', 'err');
      S.lastCities = [];
      S.citiesTotal = null;
      renderCities();
      renderCitiesPagination();
      renderCitiesTotalBox();
      return;
    }

    const parsed = parseCitiesResponse(j);
    S.lastCities = parsed.rows;
    S.citiesTotal = parsed.total;

    // ✅ página sempre derivada do offset
    S.citiesPage = Math.floor(S.citiesOffset / Math.max(1, S.citiesLimit)) + 1;

    renderCities();
    renderCitiesPagination();
    renderCitiesTotalBox();

    setStatus('Pronto ✅', 'ok');
  } catch (e) {
    setStatus(String(e?.message || e), 'err');
  } finally {
    S.loading = false;
  }
}

function renderCities() {
  const tb = el('tblCities')?.querySelector('tbody');
  if (!tb) return;

  tb.innerHTML = '';

  const empty = el('emptyState');
  if (empty) empty.style.display = S.lastCities.length ? 'none' : 'block';

  for (const r of S.lastCities) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ibge_location_id}</td>
      <td><b>${(r.state || '').trim()}</b></td>
      <td>${r.city || '—'}</td>
      <td><b>${r.ibge_code ?? '—'}</b></td>
      <td>${chip(r.status !== false)}</td>
      <td>
        <div class="actions">
          <button class="action-btn" data-act="edit" data-id="${r.ibge_location_id}" title="Editar">✏️</button>
          ${
            (r.status !== false)
              ? `<button class="action-btn" data-act="off" data-id="${r.ibge_location_id}" title="Inativar">⛔</button>`
              : `<button class="action-btn" data-act="on" data-id="${r.ibge_location_id}" title="Ativar">✅</button>`
          }
        </div>
      </td>
    `;
    tb.appendChild(tr);
  }

  tb.onclick = async (ev) => {
    const btn = ev.target?.closest?.('button[data-act]');
    if (!btn) return;

    const act = btn.getAttribute('data-act');
    const id = btn.getAttribute('data-id');
    const row = S.lastCities.find(x => String(x.ibge_location_id) === String(id));

    if (act === 'edit' && row) openModal('city', row);

    if (act === 'off') {
      if (!confirm('Inativar este registro? (soft delete)')) return;
      await apiRemove(id);
      await loadCities();
      await loadUFs();
    }

    if (act === 'on' && row) {
      if (!confirm('Reativar este registro?')) return;
      await apiUpdate(id, { status: true });
      await loadCities();
      await loadUFs();
    }
  };
}

function renderCitiesPagination() {
  let totalPages = null;
  if (Number.isFinite(S.citiesTotal) && S.citiesTotal !== null) {
    totalPages = Math.max(1, Math.ceil(S.citiesTotal / Math.max(1, S.citiesLimit)));
  }

  const info = el('citiesPageInfo');
  if (info) {
    const currentPage = Math.floor(S.citiesOffset / Math.max(1, S.citiesLimit)) + 1;
    info.textContent = totalPages ? `Página ${currentPage} de ${totalPages}` : `Página ${currentPage}`;
  }

  // ✅ NÃO desabilita botões aqui (deixa o click sempre disparar)
  const prev = el('citiesPrev');
  const next = el('citiesNext');
  if (prev) prev.disabled = false;
  if (next) next.disabled = false;
}


function renderCitiesTotalBox() {
  const box = el('citiesTotalBox');
  if (!box) return;

  if (!S.selectedUF) {
    box.textContent = '—';
    return;
  }

  const uf = S.selectedUF;
  const q = S.citiesQ ? ` | Filtro: "${S.citiesQ}"` : '';

  if (Number.isFinite(S.citiesTotal) && S.citiesTotal !== null) {
    box.textContent = `UF ${uf} — ${S.citiesTotal} cidade(s)${q}`;
  } else {
    box.textContent = `UF ${uf}${q}`;
  }
}

/* ===============================
 * API CRUD
 * =============================== */
async function apiEnsure() {
  const j = await safeJson(`${API}/ensure`, { method: 'POST' });
  if (!j.ok) throw new Error(j.error || 'Ensure falhou');
}

async function apiImportUF(uf) {
  const j = await safeJson(IMPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: uf }),
  });
  if (!j.ok) throw new Error(j.error || 'Import falhou');
  return j;
}

async function apiCreate(payload) {
  const j = await safeJson(`${API}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!j.ok) throw new Error(j.error || 'Create falhou');
  return j.data;
}

async function apiUpdate(id, payload) {
  const j = await safeJson(`${API}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!j.ok) throw new Error(j.error || 'Update falhou');
  return j.data;
}

async function apiRemove(id) {
  const j = await safeJson(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!j.ok) throw new Error(j.error || 'Delete falhou');
  return j.data;
}

/* ===============================
 * Modal
 * =============================== */
function openModal(mode, row = {}) {
  el('modalCrud').style.display = 'block';
  el('mode').value = mode || 'city';
  el('id').value = row.ibge_location_id || '';

  el('modalKicker').textContent = (mode === 'uf') ? 'UF' : 'Cidade';
  el('modalTitle').textContent = row.ibge_location_id ? `Editar #${row.ibge_location_id}` : 'Novo Registro';

  el('state').value = toUF(row.state || S.selectedUF || '');
  el('city').value = row.city || '';
  el('ibge_code').value = row.ibge_code ?? '';
  el('status').value = String(row.status !== false);

  el('city').closest('.field').style.display = 'flex';
  el('ibge_code').closest('.field').style.display = 'flex';

  setTimeout(() => (mode === 'uf' ? el('state') : el('city')).focus(), 50);
}

function closeModal() {
  el('modalCrud').style.display = 'none';
}

function bindModal() {
  el('modalCrud').addEventListener('click', (ev) => {
    if (ev.target?.getAttribute?.('data-close')) closeModal();
  });

  el('formCrud').addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const id = el('id').value || null;
    const payload = {
      state: toUF(el('state').value),
      city: String(el('city').value || '').trim(),
      ibge_code: Number(String(el('ibge_code').value || '').trim()),
      status: String(el('status').value) === 'true',
    };

    if (!payload.state || payload.state.length !== 2) return setStatus('UF inválida.', 'err');
    if (!payload.city) return setStatus('Cidade é obrigatória.', 'err');
    if (!Number.isFinite(payload.ibge_code)) return setStatus('Código IBGE inválido.', 'err');

    try {
      setStatus('Salvando...', 'warn');
      if (!id) await apiCreate(payload);
      else await apiUpdate(id, payload);

      closeModal();
      await loadCities();
      await loadUFs();
      setStatus('Salvo ✅', 'ok');
    } catch (e) {
      setStatus(String(e?.message || e), 'err');
    }
  });
}

/* ===============================
 * Bind UI
 * =============================== */
function bindUI() {
  el('btnEnsure').onclick = async () => {
    try {
      setStatus('Executando ensure...', 'warn');
      await apiEnsure();
      await loadUFs();
      await loadCities();
      setStatus('Ensure OK ✅', 'ok');
    } catch (e) {
      setStatus(String(e?.message || e), 'err');
    }
  };

  el('btnRefreshAll').onclick = async () => {
    await loadUFs();
    await loadCities();
  };

  // UFs
  el('btnUfsSearch').onclick = async () => {
    S.ufsQ = String(el('ufsQ').value || '').trim();
    await loadUFs();
  };

  el('ufsQ').addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') {
      S.ufsQ = String(el('ufsQ').value || '').trim();
      await loadUFs();
    }
  });

  el('ufsIncludeInativos').onchange = async (ev) => {
    S.ufsIncludeInativos = !!ev.target.checked;
    await loadUFs();
  };

  el('btnNovoUf').onclick = () => {
    openModal('city', { state: 'MG' });
  };

  // Cidades
  el('btnCitiesSearch').onclick = async () => {
    S.citiesQ = String(el('citiesQ').value || '').trim();
    S.citiesOffset = 0;
    S.citiesTotal = null;
    await loadCities();
  };

  el('citiesQ').addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') {
      S.citiesQ = String(el('citiesQ').value || '').trim();
      S.citiesOffset = 0;
      S.citiesTotal = null;
      await loadCities();
    }
  });

  el('citiesIncludeInativos').onchange = async (ev) => {
    S.citiesIncludeInativos = !!ev.target.checked;
    S.citiesOffset = 0;
    S.citiesTotal = null;
    await loadCities();
  };

  el('citiesLimit').onchange = async (ev) => {
    S.citiesLimit = Number(ev.target.value || 50) || 50;
    S.citiesOffset = 0;
    S.citiesTotal = null;
    await loadCities();
  };

  el('btnImportUf').onclick = async () => {
    const uf = toUF(S.selectedUF);
    if (!uf) return setStatus('Selecione uma UF na lista à esquerda.', 'err');

    try {
      setStatus(`Importando cidades da UF ${uf}...`, 'warn');
      await apiImportUF(uf);
      S.citiesOffset = 0;
      S.citiesTotal = null;
      await loadCities();
      await loadUFs();
      setStatus(`Importação da UF ${uf} concluída ✅`, 'ok');
    } catch (e) {
      setStatus(String(e?.message || e), 'err');
    }
  };

  el('btnNovoCity').onclick = () => {
    if (!S.selectedUF) return setStatus('Selecione uma UF primeiro.', 'err');
    openModal('city', { state: S.selectedUF });
  };

  el('btnClearUf').onclick = async () => {
    S.selectedUF = '';
    S.citiesOffset = 0;
    S.citiesTotal = null;
    renderSelectedHint();
    renderCitiesTotalBox();
    await loadCities();
    renderUFs();
  };

  // ✅ PAGINAÇÃO (click sempre funciona; regra fica dentro do handler)
  el('citiesPrev').onclick = async () => {
    if (S.loading) return;

    if (S.citiesOffset <= 0) {
      setStatus('Você já está na primeira página.', 'warn');
      return;
    }

    S.citiesOffset = Math.max(0, S.citiesOffset - S.citiesLimit);
    await loadCities();
  };

  el('citiesNext').onclick = async () => {
    if (S.loading) return;

    // Se backend fornece total, respeita totalPages
    if (Number.isFinite(S.citiesTotal) && S.citiesTotal !== null) {
      const totalPages = Math.max(1, Math.ceil(S.citiesTotal / Math.max(1, S.citiesLimit)));
      const currentPage = Math.floor(S.citiesOffset / Math.max(1, S.citiesLimit)) + 1;

      if (currentPage >= totalPages) {
        setStatus('Você já está na última página.', 'warn');
        return;
      }
    } else {
      // Sem total: só impede avançar se a página veio vazia
      if (!S.lastCities.length) {
        setStatus('Sem mais registros para avançar.', 'warn');
        return;
      }
    }

    S.citiesOffset += S.citiesLimit;
    await loadCities();
  };
}

/* ===============================
 * INIT (robusto)
 * =============================== */
function must(id) {
  const n = el(id);
  if (!n) console.warn('[IBGE] Elemento não encontrado:', id);
  return n;
}

function init() {
  // força checagem dos botões (pra você ver no console se existe)
  must('citiesPrev');
  must('citiesNext');
  must('tblCities');
  must('tblUfs');

  bindUI();
  bindModal();
  renderSelectedHint();
  renderCitiesTotalBox();
  loadUFs();
  loadCities();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[IBGE] DOMContentLoaded');
  init();
});
