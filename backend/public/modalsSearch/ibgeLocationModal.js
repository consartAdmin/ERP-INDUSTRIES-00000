// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationModal.js — Modal UF + Cidade (IBGE) | PRODNEX ERP | ESM  ║
// ║ Preenche automaticamente: #state, #city, #ibge_city_code             ║
// ║ ✅ Usa apiBase.js (window.getApiBase)                                ║
// ║ ✅ Exporta: initIbgeLocationModal + openIbgeModal                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ─────────────────────────────────────────────────────────────
   API BASE (compatível com seu apiBase.js)
───────────────────────────────────────────────────────────── */
function resolveApiBase() {
  try {
    if (typeof window !== 'undefined') {
      if (typeof window.getApiBase === 'function') return String(window.getApiBase() || '').trim() || window.location.origin;
      if (window.apiBase) return String(window.apiBase).trim();
      if (window.API_BASE) return String(window.API_BASE).trim();
      return window.location.origin;
    }
  } catch {}
  return (typeof location !== 'undefined' && location.origin) ? location.origin : '';
}

const el = (id) => document.getElementById(id);

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

async function tryFetchJson(urls) {
  let lastErr = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
      const text = await res.text();

      let json = null;
      try { json = text ? JSON.parse(text) : null; }
      catch { json = null; }

      if (res.ok) return json;
      lastErr = new Error((json && (json.error || json.message)) || `HTTP ${res.status} - ${url}`);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Falha ao buscar dados do IBGE.');
}

function normalizeArrayPayload(payload) {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;

  // formatos comuns
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;

  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;

  return [];
}

function normalizeUfsPayload(payload) {
  const arr = normalizeArrayPayload(payload);

  return arr.map((x) => ({
    uf: x.uf || x.sigla || x.UF || x.state || x.code,
    name: x.name || x.nome || x.estado || x.label || '',
    ibgeCode: x.ibgeCode || x.codigo_ibge || x.codigo || x.id || null,
  })).filter(x => x.uf);
}

function normalizeCitiesPayload(payload) {
  const arr = normalizeArrayPayload(payload);

  return arr.map((x) => ({
    name: x.name || x.nome || x.city || x.municipio || '',
    ibgeCode: x.ibgeCode || x.codigo_ibge || x.codigo || x.id || '',
    uf: x.uf || x.sigla || x.state || '',
  })).filter(x => x.name);
}

function ensureSelectOption(select, value, label) {
  if (!select) return;
  const exists = Array.from(select.options).some(o => String(o.value) === String(value));
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label || value;
    select.appendChild(opt);
  }
}

/* ─────────────────────────────────────────────────────────────
   ROTAS: prioriza seu módulo real (/api/ibge-locations)
───────────────────────────────────────────────────────────── */
function buildRoutes(apiBase) {
  const BASE = String(apiBase || '').trim() || resolveApiBase();

  return Object.freeze({
    ufs: [
      // ✅ seu módulo principal (variações comuns)
      `${BASE}/api/ibge-locations/ufs`,
      `${BASE}/api/ibge-locations/uf`,
      `${BASE}/api/ibge-locations/estados`,
      `${BASE}/api/ibge-locations/states`,

      // ✅ fallback antigos (caso exista em outro ambiente)
      `${BASE}/api/ibge-ufs`,
      `${BASE}/api/ibge/ufs`,
      `${BASE}/api/ibgeUfs`,
      `${BASE}/api/ibgeUf`,
    ],

    citiesByUf: (uf) => ([
      // ✅ seu módulo principal
      `${BASE}/api/ibge-locations/cities/${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge-locations/cities?uf=${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge-locations?uf=${encodeURIComponent(uf)}`,

      // ✅ fallbacks antigos
      `${BASE}/api/ibge-cities/${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge-cities?uf=${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge-cities?state=${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge/cities/${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge/cities?uf=${encodeURIComponent(uf)}`,
      `${BASE}/api/ibge/cities?state=${encodeURIComponent(uf)}`,
    ]),

    resolveCity: (uf, city) => ([
      // ✅ seu módulo principal (variações comuns)
      `${BASE}/api/ibge-locations/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`,
      `${BASE}/api/ibge-locations/cities/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`,

      // ✅ fallbacks antigos
      `${BASE}/api/ibge-cities/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`,
      `${BASE}/api/ibge/cities/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`,
    ]),
  });
}

function extractResolveCode(payload) {
  const root = payload?.data ?? payload;

  // array
  if (Array.isArray(root) && root[0]) {
    const it = root[0];
    return it.ibgeCode ?? it.ibge_code ?? it.codigo_ibge ?? it.codigo ?? it.city_ibge_code ?? it.ibge_city_code ?? null;
  }

  // object
  if (root && typeof root === 'object') {
    return root.ibgeCode ?? root.ibge_code ?? root.codigo_ibge ?? root.codigo ?? root.city_ibge_code ?? root.ibge_city_code ?? null;
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
   Singleton (permite openIbgeModal Promise)
───────────────────────────────────────────────────────────── */
let __wired = false;
let __apiBase = null;
let __routes = null;

let __overlay = null;
let __btnApply = null;
let __ufSearch = null;
let __ufList = null;
let __citySearch = null;
let __cityList = null;

let __selectedUf = null;
let __selectedCity = null;
let __selectedCode = null;

let __stateSelect = null;
let __cityInput = null;
let __ibgeInput = null;

let __ufs = [];
let __cities = [];
let __ufChosen = null;
let __cityChosen = null;

let __resolver = null; // resolve() do openIbgeModal

function wireOnce({
  openButtonId = 'btnOpenUfModal',
  stateSelectId = 'state',
  cityInputId = 'city',
  ibgeInputId = 'ibge_city_code',
  apiBaseUrl = null,
} = {}) {
  if (__wired) return true;

  __apiBase = apiBaseUrl || resolveApiBase();
  __routes = buildRoutes(__apiBase);

  __overlay = el('ibgeLocationModal');
  if (!__overlay) return false;

  const btnOpen = el(openButtonId);
  const btnClose = el('ibgeLocationClose');
  const btnCancel = el('ibgeLocationCancel');
  __btnApply = el('ibgeLocationApply');

  __ufSearch = el('ibgeUfSearch');
  __ufList = el('ibgeUfList');

  __citySearch = el('ibgeCitySearch');
  __cityList = el('ibgeCityList');

  __selectedUf = el('ibgeSelectedUf');
  __selectedCity = el('ibgeSelectedCity');
  __selectedCode = el('ibgeSelectedCode');

  __stateSelect = el(stateSelectId);
  __cityInput = el(cityInputId);
  __ibgeInput = el(ibgeInputId);

  function openUI() {
    __overlay.hidden = false;
    __overlay.style.display = 'flex';
    __overlay.setAttribute('aria-hidden', 'false');

    // reset
    if (__ufSearch) __ufSearch.value = '';
    if (__citySearch) __citySearch.value = '';
    if (__citySearch) __citySearch.disabled = true;
    if (__btnApply) __btnApply.disabled = true;

    __ufChosen = null;
    __cityChosen = null;

    if (__selectedUf) __selectedUf.textContent = '—';
    if (__selectedCity) __selectedCity.textContent = '—';
    if (__selectedCode) __selectedCode.textContent = '—';

    if (__ufList) __ufList.innerHTML = '';
    if (__cityList) __cityList.innerHTML = '';

    loadUfs();
  }

  function closeUI({ resolveNull = true } = {}) {
    if (!__overlay) return;
    __overlay.hidden = true;
    __overlay.style.display = 'none';
    __overlay.setAttribute('aria-hidden', 'true');

    if (__resolver && resolveNull) {
      const r = __resolver;
      __resolver = null;
      r(null);
    }
  }

  async function loadUfs() {
    if (__ufList) __ufList.innerHTML = `<div class="ibge-item muted">Carregando UFs...</div>`;

    try {
      const payload = await tryFetchJson(__routes.ufs);
      __ufs = normalizeUfsPayload(payload);
      renderUfs();
    } catch (e) {
      if (__ufList) __ufList.innerHTML = `<div class="ibge-item error">Erro ao carregar UFs: ${String(e.message || e)}</div>`;
    }
  }

  async function loadCities(uf) {
    if (__cityList) __cityList.innerHTML = `<div class="ibge-item muted">Carregando cidades...</div>`;
    if (__citySearch) __citySearch.disabled = false;

    try {
      const payload = await tryFetchJson(__routes.citiesByUf(uf));
      __cities = normalizeCitiesPayload(payload);
      renderCities();
    } catch (e) {
      if (__cityList) __cityList.innerHTML = `<div class="ibge-item error">Erro ao carregar cidades: ${String(e.message || e)}</div>`;
      __cities = [];
    }
  }

  function renderUfs() {
    const q = norm(__ufSearch?.value);
    const filtered = !q ? __ufs : __ufs.filter(u => norm(u.uf).includes(q) || norm(u.name).includes(q));

    if (!__ufList) return;
    __ufList.innerHTML = '';

    if (!filtered.length) {
      __ufList.innerHTML = `<div class="ibge-item muted">Nenhuma UF encontrada.</div>`;
      return;
    }

    for (const u of filtered) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ibge-item';
      item.textContent = `${u.uf} — ${u.name || 'Estado'}`;
      item.addEventListener('click', () => {
        __ufChosen = u;
        __cityChosen = null;

        if (__selectedUf) __selectedUf.textContent = `${u.uf} — ${u.name || ''}`.trim();
        if (__selectedCity) __selectedCity.textContent = '—';
        if (__selectedCode) __selectedCode.textContent = '—';
        if (__btnApply) __btnApply.disabled = true;

        if (__citySearch) __citySearch.value = '';
        if (__cityList) __cityList.innerHTML = '';
        loadCities(u.uf);
      });

      __ufList.appendChild(item);
    }
  }

  function renderCities() {
    const q = norm(__citySearch?.value);
    const filtered = !q ? __cities : __cities.filter(c => norm(c.name).includes(q) || norm(c.ibgeCode).includes(q));

    if (!__cityList) return;
    __cityList.innerHTML = '';

    if (!filtered.length) {
      __cityList.innerHTML = `<div class="ibge-item muted">Nenhuma cidade encontrada.</div>`;
      return;
    }

    for (const c of filtered) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'ibge-item';
      item.textContent = `${c.name} — IBGE: ${c.ibgeCode || '—'}`;

      // ✅ FIX IBGE CODE: ao clicar na cidade, resolve o código se vier vazio
      item.addEventListener('click', async () => {
        __cityChosen = c;

        if (__selectedCity) __selectedCity.textContent = c.name;

        // tenta usar o que veio na lista
        let code =
          (c.ibgeCode != null && String(c.ibgeCode).trim() !== '')
            ? String(c.ibgeCode).trim()
            : null;

        // se não veio, resolve no backend (/resolve)
        if (!code && __ufChosen?.uf && c?.name) {
          code = await resolveIbgeCodeIfMissing(__ufChosen.uf, c.name);
          if (code) {
            // guarda no objeto para próximas interações e atualiza texto do botão
            c.ibgeCode = code;
            item.textContent = `${c.name} — IBGE: ${code}`;
          }
        }

        if (__selectedCode) __selectedCode.textContent = code || '—';
        if (__btnApply) __btnApply.disabled = !(__ufChosen && __cityChosen);
      });

      __cityList.appendChild(item);
    }
  }

  // ✅ FIX IBGE CODE: manter sua função, mas agora usando apiBase+fallbacks via __routes.resolveCity
  async function resolveIbgeCode(uf, city) {
    if (!uf || !city) return null;

    try {
      // usa as rotas já montadas (com BASE correto e fallbacks)
      const payload = await tryFetchJson(__routes.resolveCity(String(uf).trim(), String(city).trim()));
      const code = extractResolveCode(payload);
      return code != null && String(code).trim() !== '' ? String(code).trim() : null;
    } catch {
      return null;
    }
  }

  // ✅ FIX IBGE CODE: essa função era chamada no applySelection(), mas não existia.
  // Mantém seu fluxo intacto e garante o código quando faltar.
  async function resolveIbgeCodeIfMissing(uf, city) {
    return resolveIbgeCode(uf, city);
  }

  async function applySelection() {
    if (!__ufChosen || !__cityChosen) return;

    const uf = String(__ufChosen.uf || '').trim().toUpperCase().slice(0, 2);
    const city = String(__cityChosen.name || '').trim();

    // tenta garantir code
    let code = (__cityChosen.ibgeCode != null && String(__cityChosen.ibgeCode).trim() !== '')
      ? String(__cityChosen.ibgeCode).trim()
      : null;

    if (!code) {
      code = await resolveIbgeCodeIfMissing(uf, city);
    }

    // ✅ Preenche campos da tela
    ensureSelectOption(__stateSelect, uf, uf);
    if (__stateSelect) __stateSelect.value = uf;

    if (__cityInput) __cityInput.value = city || '';
    if (__ibgeInput) __ibgeInput.value = code || '';

    // dispara eventos
    __stateSelect?.dispatchEvent(new Event('change', { bubbles: true }));
    __cityInput?.dispatchEvent(new Event('input', { bubbles: true }));
    __ibgeInput?.dispatchEvent(new Event('input', { bubbles: true }));

    // se foi aberto via openIbgeModal(), devolve result
    if (__resolver) {
      const r = __resolver;
      __resolver = null;
      r({ uf, city, ibgeCode: code });
    }

    closeUI({ resolveNull: false });
  }

  // Events
  btnOpen?.addEventListener('click', openUI);
  btnClose?.addEventListener('click', () => closeUI({ resolveNull: true }));
  btnCancel?.addEventListener('click', () => closeUI({ resolveNull: true }));

  __overlay.addEventListener('click', (e) => {
    if (e.target === __overlay) closeUI({ resolveNull: true });
  });

  __ufSearch?.addEventListener('input', renderUfs);
  __citySearch?.addEventListener('input', renderCities);
  __btnApply?.addEventListener('click', applySelection);

  document.addEventListener('keydown', (e) => {
    if (!__overlay || __overlay.hidden) return;
    if (e.key === 'Escape') closeUI({ resolveNull: true });
  });

  __wired = true;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   ✅ Public API
───────────────────────────────────────────────────────────── */

// Inicializa usando o botão e preenchendo os campos automaticamente
export function initIbgeLocationModal(opts = {}) {
  wireOnce(opts);
}

// Abre o modal e devolve Promise com {uf, city, ibgeCode} ou null (cancelado)
export function openIbgeModal({
  apiBaseUrl = null,
  initialUF = '',
  initialCity = '',
  openButtonId = 'btnOpenUfModal',
  stateSelectId = 'state',
  cityInputId = 'city',
  ibgeInputId = 'ibge_city_code',
} = {}) {
  const ok = wireOnce({ apiBaseUrl, openButtonId, stateSelectId, cityInputId, ibgeInputId });
  if (!ok) return Promise.resolve(null);

  // pré-preenche visual (não dispara fetch automaticamente, só mostra)
  if (__selectedUf) __selectedUf.textContent = initialUF ? String(initialUF).toUpperCase().slice(0, 2) : '—';
  if (__selectedCity) __selectedCity.textContent = initialCity ? String(initialCity).trim() : '—';
  if (__selectedCode) __selectedCode.textContent = '—';

  // abre UI (simula clique)
  const overlay = __overlay;
  if (overlay) {
    overlay.hidden = false;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
  }

  // reset inputs/lists
  if (__ufSearch) __ufSearch.value = '';
  if (__citySearch) { __citySearch.value = ''; __citySearch.disabled = true; }
  if (__btnApply) __btnApply.disabled = true;
  __ufChosen = null;
  __cityChosen = null;
  if (__ufList) __ufList.innerHTML = '';
  if (__cityList) __cityList.innerHTML = '';

  // carrega UFs
  (async () => {
    try {
      if (__ufList) __ufList.innerHTML = `<div class="ibge-item muted">Carregando UFs...</div>`;
      const payload = await tryFetchJson(__routes.ufs);
      __ufs = normalizeUfsPayload(payload);

      // se veio initialUF, tenta selecionar automaticamente
      const targetUF = String(initialUF || '').trim().toUpperCase().slice(0, 2);
      if (targetUF) {
        const found = __ufs.find(u => String(u.uf || '').toUpperCase() === targetUF);
        if (found) {
          __ufChosen = found;
          if (__selectedUf) __selectedUf.textContent = `${found.uf} — ${found.name || ''}`.trim();
          if (__citySearch) __citySearch.disabled = false;

          // carrega cidades para UF
          try {
            if (__cityList) __cityList.innerHTML = `<div class="ibge-item muted">Carregando cidades...</div>`;
            const payloadC = await tryFetchJson(__routes.citiesByUf(found.uf));
            __cities = normalizeCitiesPayload(payloadC);

            // se veio initialCity, tenta selecionar
            const targetCity = String(initialCity || '').trim();
            if (targetCity) {
              const fCity = __cities.find(c => norm(c.name) === norm(targetCity));
              if (fCity) {
                __cityChosen = fCity;
                if (__selectedCity) __selectedCity.textContent = fCity.name;

                // ✅ FIX IBGE CODE: se não veio código, resolve agora
                let code =
                  (fCity.ibgeCode != null && String(fCity.ibgeCode).trim() !== '')
                    ? String(fCity.ibgeCode).trim()
                    : null;

                if (!code) {
                  // tenta resolver usando as rotas do módulo
                  try {
                    const payloadR = await tryFetchJson(__routes.resolveCity(found.uf, fCity.name));
                    const resolved = extractResolveCode(payloadR);
                    if (resolved != null && String(resolved).trim() !== '') {
                      code = String(resolved).trim();
                      fCity.ibgeCode = code;
                    }
                  } catch {}
                }

                if (__selectedCode) __selectedCode.textContent = code || '—';
                if (__btnApply) __btnApply.disabled = false;
              }
            }
          } catch {
            __cities = [];
          }
        }
      }

      // render normal (lista UF/cidades)
      // (renderUfs/renderCities são internas do wireOnce; aqui fazemos render simples)
      if (__ufList) {
        const q = norm(__ufSearch?.value);
        const filtered = !q ? __ufs : __ufs.filter(u => norm(u.uf).includes(q) || norm(u.name).includes(q));
        __ufList.innerHTML = '';
        if (!filtered.length) __ufList.innerHTML = `<div class="ibge-item muted">Nenhuma UF encontrada.</div>`;
        else {
          for (const u of filtered) {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'ibge-item';
            item.textContent = `${u.uf} — ${u.name || 'Estado'}`;
            item.addEventListener('click', async () => {
              __ufChosen = u;
              __cityChosen = null;
              if (__selectedUf) __selectedUf.textContent = `${u.uf} — ${u.name || ''}`.trim();
              if (__selectedCity) __selectedCity.textContent = '—';
              if (__selectedCode) __selectedCode.textContent = '—';
              if (__btnApply) __btnApply.disabled = true;

              if (__citySearch) { __citySearch.value = ''; __citySearch.disabled = false; }
              if (__cityList) __cityList.innerHTML = `<div class="ibge-item muted">Carregando cidades...</div>`;

              try {
                const payload2 = await tryFetchJson(__routes.citiesByUf(u.uf));
                __cities = normalizeCitiesPayload(payload2);

                // render cidades
                if (__cityList) {
                  const q2 = norm(__citySearch?.value);
                  const filtered2 = !q2 ? __cities : __cities.filter(c => norm(c.name).includes(q2) || norm(c.ibgeCode).includes(q2));
                  __cityList.innerHTML = '';
                  if (!filtered2.length) __cityList.innerHTML = `<div class="ibge-item muted">Nenhuma cidade encontrada.</div>`;
                  else {
                    for (const c of filtered2) {
                      const b = document.createElement('button');
                      b.type = 'button';
                      b.className = 'ibge-item';
                      b.textContent = `${c.name} — IBGE: ${c.ibgeCode || '—'}`;

                      // ✅ FIX IBGE CODE: resolve ao clicar se vier vazio
                      b.addEventListener('click', async () => {
                        __cityChosen = c;
                        if (__selectedCity) __selectedCity.textContent = c.name;

                        let code =
                          (c.ibgeCode != null && String(c.ibgeCode).trim() !== '')
                            ? String(c.ibgeCode).trim()
                            : null;

                        if (!code && __ufChosen?.uf && c?.name) {
                          try {
                            const payloadR = await tryFetchJson(__routes.resolveCity(__ufChosen.uf, c.name));
                            const resolved = extractResolveCode(payloadR);
                            if (resolved != null && String(resolved).trim() !== '') {
                              code = String(resolved).trim();
                              c.ibgeCode = code;
                              b.textContent = `${c.name} — IBGE: ${code}`;
                            }
                          } catch {}
                        }

                        if (__selectedCode) __selectedCode.textContent = code || '—';
                        if (__btnApply) __btnApply.disabled = !(__ufChosen && __cityChosen);
                      });

                      __cityList.appendChild(b);
                    }
                  }
                }
              } catch (e) {
                __cities = [];
                if (__cityList) __cityList.innerHTML = `<div class="ibge-item error">Erro ao carregar cidades: ${String(e.message || e)}</div>`;
              }
            });
            __ufList.appendChild(item);
          }
        }
      }

    } catch (e) {
      if (__ufList) __ufList.innerHTML = `<div class="ibge-item error">Erro ao carregar UFs: ${String(e.message || e)}</div>`;
    }
  })();

  // retorna promise
  return new Promise((resolve) => {
    __resolver = resolve;
  });
}
