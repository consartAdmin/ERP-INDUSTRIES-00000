// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ibgeCustomersModalSearch.js — Modal IBGE (UF/Cidade) | PRODNEX ERP    ║
// ║ Path: /public/modalsSearch/ibgeCustomersModalSearch.js                ║
// ║                                                                      ║
// ║ Export: openIbgeCustomersModalSearch({ onApply, initialUF, initialCity })
// ║  - onApply({ uf, city, ibgeCode })                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

const IBGE = Object.freeze({
  ufs:    'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome',
  cities: (ufSigla) => `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(ufSigla)}/municipios?orderBy=nome`,
});

let _cache = {
  ufs: null,
  citiesByUf: new Map(), // ufSigla -> array
};

const qs  = (s, el = document) => el.querySelector(s);
const el  = (tag, attrs = {}) => Object.assign(document.createElement(tag), attrs);

function normalize(str){ return String(str || '').trim().toLowerCase(); }

async function fetchJson(url){
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`IBGE request failed: ${r.status} ${r.statusText}`);
  return r.json();
}

async function getUfs(){
  if (_cache.ufs) return _cache.ufs;
  const data = await fetchJson(IBGE.ufs);
  // shape: [{id, sigla, nome, ...}]
  _cache.ufs = Array.isArray(data) ? data : [];
  return _cache.ufs;
}

async function getCities(ufSigla){
  const key = String(ufSigla || '').toUpperCase();
  if (!key) return [];
  if (_cache.citiesByUf.has(key)) return _cache.citiesByUf.get(key);
  const data = await fetchJson(IBGE.cities(key));
  _cache.citiesByUf.set(key, Array.isArray(data) ? data : []);
  return _cache.citiesByUf.get(key);
}

function ensureModal(){
  let overlay = qs('#ibgeCustomersModalOverlay');
  if (overlay) return overlay;

  overlay = el('div', { id: 'ibgeCustomersModalOverlay', className: 'ibge-modal-overlay', hidden: true, ariaHidden: 'true' });

  overlay.innerHTML = `
    <div class="ibge-modal" role="dialog" aria-modal="true" aria-labelledby="ibgeCustomersTitle">
      <div class="ibge-modal-header">
        <h3 id="ibgeCustomersTitle">Selecionar UF e Cidade (IBGE)</h3>
        <button type="button" class="ibge-modal-close" data-ibge-close aria-label="Fechar">✕</button>
      </div>

      <div class="ibge-modal-body">
        <div class="ibge-grid">
          <div class="ibge-panel">
            <label class="ibge-label">UF</label>
            <input type="text" id="ibgeCustomersUfSearch" class="ibge-input" placeholder="Buscar UF (ex: RJ, Rio...)">
            <div id="ibgeCustomersUfList" class="ibge-list" role="listbox" aria-label="Lista de UFs"></div>
          </div>

          <div class="ibge-panel">
            <label class="ibge-label">Cidade</label>
            <input type="text" id="ibgeCustomersCitySearch" class="ibge-input" placeholder="Buscar cidade... (selecione uma UF)" disabled>
            <div id="ibgeCustomersCityList" class="ibge-list" role="listbox" aria-label="Lista de Cidades"></div>
          </div>
        </div>

        <div class="ibge-selected">
          <div><strong>UF:</strong> <span id="ibgeCustomersSelectedUf">—</span></div>
          <div><strong>Cidade:</strong> <span id="ibgeCustomersSelectedCity">—</span></div>
          <div><strong>Cód. IBGE:</strong> <span id="ibgeCustomersSelectedCode">—</span></div>
        </div>
      </div>

      <div class="ibge-modal-footer">
        <button type="button" class="btn btn-toolbar btn-sm" data-ibge-cancel>Cancelar</button>
        <button type="button" class="btn btn-toolbar btn-sm" data-ibge-apply disabled>Aplicar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function renderList(container, items, { getLabel, getCode, activeKey, onPick }){
  container.innerHTML = '';
  if (!items.length){
    const empty = el('div', { className: 'ibge-item', textContent: 'Nenhum resultado.' });
    empty.style.cursor = 'default';
    empty.style.opacity = '0.7';
    container.appendChild(empty);
    return;
  }

  for (const it of items){
    const label = getLabel(it);
    const code  = getCode ? getCode(it) : null;
    const key   = activeKey ? activeKey(it) : label;

    const row = el('div', { className: 'ibge-item', role: 'option' });
    row.innerHTML = code ? `<span>${label}</span><code>${code}</code>` : `<span>${label}</span>`;
    if (activeKey && key === activeKey.__selected) row.classList.add('is-active');

    row.addEventListener('click', () => onPick(it));
    container.appendChild(row);
  }
}

function setOpen(overlay, isOpen){
  overlay.hidden = !isOpen;
  overlay.style.display = isOpen ? 'flex' : 'none';
  overlay.classList.toggle('is-open', isOpen);
  overlay.setAttribute('aria-hidden', String(!isOpen));
}

export async function openIbgeCustomersModalSearch({
  onApply,
  initialUF = '',
  initialCity = '',
} = {}) {
  if (typeof onApply !== 'function') {
    console.warn('[ibgeCustomersModalSearch] onApply não informado. O modal vai funcionar, mas não aplicará nada.');
  }

  const overlay = ensureModal();

  const ufSearch    = qs('#ibgeCustomersUfSearch', overlay);
  const citySearch  = qs('#ibgeCustomersCitySearch', overlay);
  const ufList      = qs('#ibgeCustomersUfList', overlay);
  const cityList    = qs('#ibgeCustomersCityList', overlay);

  const selUf       = qs('#ibgeCustomersSelectedUf', overlay);
  const selCity     = qs('#ibgeCustomersSelectedCity', overlay);
  const selCode     = qs('#ibgeCustomersSelectedCode', overlay);

  const btnClose    = qs('[data-ibge-close]', overlay);
  const btnCancel   = qs('[data-ibge-cancel]', overlay);
  const btnApply    = qs('[data-ibge-apply]', overlay);

  let state = {
    ufs: [],
    cities: [],
    selectedUf: null,      // {sigla, nome, id}
    selectedCity: null,    // {id, nome}
    ibgeCode: null,        // city.id (IBGE)
  };

  function syncSelected(){
    selUf.textContent   = state.selectedUf ? `${state.selectedUf.sigla} — ${state.selectedUf.nome}` : '—';
    selCity.textContent = state.selectedCity ? state.selectedCity.nome : '—';
    selCode.textContent = state.ibgeCode ? String(state.ibgeCode) : '—';

    const canApply = !!(state.selectedUf && state.selectedCity && state.ibgeCode);
    btnApply.disabled = !canApply;
  }

  function resetCity(){
    state.cities = [];
    state.selectedCity = null;
    state.ibgeCode = null;
    citySearch.value = '';
    citySearch.disabled = true;
    citySearch.placeholder = 'Buscar cidade... (selecione uma UF)';
    cityList.innerHTML = '';
    syncSelected();
  }

  function close(){
    setOpen(overlay, false);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function apply(){
    if (btnApply.disabled) return;
    const payload = {
      uf: state.selectedUf?.sigla || '',
      city: state.selectedCity?.nome || '',
      ibgeCode: state.ibgeCode || null,
    };
    try { onApply?.(payload); } catch (e) { console.error(e); }
    close();
  }

  function onKeyDown(e){
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Enter' && !btnApply.disabled) { e.preventDefault(); apply(); }
  }

  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnApply.addEventListener('click', apply);

  // Load UFs
  try{
    state.ufs = await getUfs();
  } catch (e){
    console.error('[IBGE] Erro ao buscar UFs:', e);
    state.ufs = [];
  }

  // UF filter + render
  const renderUfs = () => {
    const q = normalize(ufSearch.value);
    const filtered = state.ufs.filter(u => {
      const nome = normalize(u.nome);
      const sigla = normalize(u.sigla);
      return !q || nome.includes(q) || sigla.includes(q);
    });

    const activeKey = (u) => `${u.sigla}`;
    activeKey.__selected = state.selectedUf ? `${state.selectedUf.sigla}` : null;

    renderList(ufList, filtered, {
      getLabel: (u) => `${u.sigla} — ${u.nome}`,
      getCode:  (u) => u.id,
      activeKey,
      onPick: async (u) => {
        state.selectedUf = { id: u.id, sigla: u.sigla, nome: u.nome };
        resetCity();
        syncSelected();

        citySearch.disabled = false;
        citySearch.placeholder = `Buscar cidade... (${u.sigla})`;
        citySearch.focus();

        try{
          state.cities = await getCities(u.sigla);
        } catch (e){
          console.error('[IBGE] Erro ao buscar cidades:', e);
          state.cities = [];
        }
        renderCities();
      },
    });
  };

  const renderCities = () => {
    const q = normalize(citySearch.value);
    const filtered = state.cities.filter(c => !q || normalize(c.nome).includes(q));

    const activeKey = (c) => `${c.id}`;
    activeKey.__selected = state.selectedCity ? `${state.selectedCity.id}` : null;

    renderList(cityList, filtered, {
      getLabel: (c) => c.nome,
      getCode:  (c) => c.id,
      activeKey,
      onPick: (c) => {
        state.selectedCity = { id: c.id, nome: c.nome };
        state.ibgeCode = c.id;
        syncSelected();
      },
    });
  };

  ufSearch.oninput = renderUfs;
  citySearch.oninput = renderCities;

  // Preselect if provided
  if (initialUF){
    const uf = state.ufs.find(u => String(u.sigla).toUpperCase() === String(initialUF).toUpperCase())
           || state.ufs.find(u => normalize(u.nome) === normalize(initialUF));
    if (uf){
      state.selectedUf = { id: uf.id, sigla: uf.sigla, nome: uf.nome };
      citySearch.disabled = false;
      citySearch.placeholder = `Buscar cidade... (${uf.sigla})`;
      try{
        state.cities = await getCities(uf.sigla);
      } catch (e){
        console.error('[IBGE] Erro ao buscar cidades:', e);
        state.cities = [];
      }

      if (initialCity){
        const city = state.cities.find(c => normalize(c.nome) === normalize(initialCity));
        if (city){
          state.selectedCity = { id: city.id, nome: city.nome };
          state.ibgeCode = city.id;
        }
      }
    }
  }

  // initial render
  renderUfs();
  if (state.selectedUf) renderCities();
  syncSelected();

  // open
  setOpen(overlay, true);
  document.addEventListener('keydown', onKeyDown, true);

  // focus
  setTimeout(() => {
    if (!state.selectedUf) ufSearch.focus();
    else citySearch.focus();
  }, 0);

  return { close };
}
