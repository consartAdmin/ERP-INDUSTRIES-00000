// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerEdit.actions.js — Edição de Clientes (PRODNEX ERP | ESM)     ║
// ║ - Alinhado com customerEdit.html (campo único "name")                ║
// ║ - Integração SellerForCustomer (vínculo vendedor x cliente)          ║
// ║ - ✅ IBGE NOVO: ibgeLocations (UF select + cidades datalist)        ║
// ║ - ✅ IBGE MODAL: /public/modalsSearch/ibgeLocationModal.js          ║
// ║ - ✅ AUTO: preenche UF + Cidade + Código IBGE (Cidade)              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { initIbgeLocationModal } from '/public/modalsSearch/ibgeLocationModal.js';
import './customersEdit.tab.nfe.js';
import {
  initFinancialDefaults,
  fillFinancialDefaults,
  readFinancialDefaults,
} from '/public/includes/js/customerFinancialDefaults.js';
import { initCustomerQuickAdd } from './customersEdit.quickAdd.js';

// ---------------------------------------------------------------------
// API BASE & ROTAS
// ---------------------------------------------------------------------
const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');


// ---------------------------------------------------------------------
// CONST ROUTES
// ---------------------------------------------------------------------
const ROUTES = Object.freeze({
  customers:
    `${API_BASE}/api/customers`,

  customerById:
    (id) => `${API_BASE}/api/customers/${encodeURIComponent(id)}`,

  customerCreditByCustomer:
    (id) => `${API_BASE}/api/customers-credit/customer/${encodeURIComponent(id)}`,

  priceTables:
    `${API_BASE}/api/customer-price-tables/price-tables`,

  customerPriceTable:
    (id) => `${API_BASE}/api/customer-price-tables/customers/${encodeURIComponent(id)}/price-table`,

  // ---------------------------------------------------------------------
  // 🔹 segmentos vindos da customerSegmentsController
  // ---------------------------------------------------------------------
  segmentos: `${API_BASE}/api/customer-segments`,

  // ---------------------------------------------------------------------
  // 🔹 classificacoes vindos da classificacoesController
  // ---------------------------------------------------------------------
  classificacoes: `${API_BASE}/api/classificacoes`,

  // ---------------------------------------------------------------------
  // 🔹 sellers vindos da sellersController
  // --------------------------------------------------------------------- 
  sellers: `${API_BASE}/api/sellers`,
  vendedores: `${API_BASE}/api/vendedores`,

  // Link seller ↔ customer
  sellerForCustomer: `${API_BASE}/api/seller-for-customer`,
  sellerForCustomerByCustomer: (id) =>
    `${API_BASE}/api/seller-for-customer/by-customer/${encodeURIComponent(id)}`,

  // CNPJ público via backend
  consultaCnpj: (cnpj) => `${API_BASE}/api/public-cnpj/${cnpj}`,

  // ✅ IBGE (MÓDULO REAL)
  ibgeUfs: `${API_BASE}/api/ibge-locations/ufs`,
  ibgeCitiesByUF: (uf) => `${API_BASE}/api/ibge-locations/cities/${encodeURIComponent(uf)}`,
  ibgeCitiesSearch: (uf, q, limit = 80, offset = 0) =>
    `${API_BASE}/api/ibge-locations/cities/${encodeURIComponent(uf)}?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`,
  ibgeResolveCity: (uf, city) =>
    `${API_BASE}/api/ibge-locations/resolve?uf=${encodeURIComponent(uf)}&city=${encodeURIComponent(city)}`,

  asaasSync:
    (customerId) =>
      `${API_BASE}/api/integracoes/asaas/clientes/${encodeURIComponent(customerId)}/sync`,
});

// ---------------------------------------------------------------------
// Helpers DOM / strings
// ---------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const get = (id) => document.getElementById(id)?.value ?? '';
const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };

function onlyDigits(s) { return String(s ?? '').replace(/\D+/g, ''); }
function trimOrNull(s) { const v = String(s ?? '').trim(); return v || null; }
function normalizePersonType(value) {
  const v = String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (
    v === 'F' ||
    v === 'PF' ||
    v === 'FISICA' ||
    v === 'PESSOA FISICA'
  ) {
    return 'F';
  }

  return 'J';
}

const isPF = () =>
  normalizePersonType(
    $('#person_type')?.value
  ) === 'F';

function normUF(v) {
  return String(v || '').trim().toUpperCase().slice(0, 2);
}
function normName(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

// ---------------------------------------------------------------------
// Util: debounce (evita chamadas excessivas)
// ---------------------------------------------------------------------
function debounce(fn, ms = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------------
// Pessoa Física / Jurídica — ajusta campos do formulário
// ---------------------------------------------------------------------
function updatePersonTypeUI() {
  const physicalPerson = isPF();

  const tradeNameLabel =
    document.getElementById('tradeNameLabel');

  const legalNameField =
    document.getElementById('fieldLegalName');

  const stateRegistrationField =
    document.getElementById('fieldStateRegistration');

  const municipalRegistrationField =
    document.getElementById('fieldMunicipalRegistration');

  const btnCNPJ =
    document.getElementById('btnBuscarCNPJ');

  const taxLabel =
    document.getElementById('tax_id_label');

  if (physicalPerson) {
    // ---------------------------------------------------------------
    // PESSOA FÍSICA
    // ---------------------------------------------------------------

    // Nome Fantasia -> Nome Completo
    if (tradeNameLabel) {
      tradeNameLabel.textContent = 'Nome Completo';
    }

    // CNPJ/CPF -> CPF
    setLabelTitle(
      taxLabel,
      'CPF'
    );

    // Oculta Razão Social
    if (legalNameField) {
      legalNameField.hidden = true;
    }

    // Oculta I.E.
    if (stateRegistrationField) {
      stateRegistrationField.hidden = true;
    }

    // Oculta I.M.
    if (municipalRegistrationField) {
      municipalRegistrationField.hidden = true;
    }

    // Oculta Buscar CNPJ
    if (btnCNPJ) {
      btnCNPJ.hidden = true;
    }

  } else {
    // ---------------------------------------------------------------
    // PESSOA JURÍDICA
    // ---------------------------------------------------------------

    // Nome Completo -> Nome Fantasia
    if (tradeNameLabel) {
      tradeNameLabel.textContent = 'Nome Fantasia';
    }

    // CPF -> CNPJ/CPF
    setLabelTitle(
      taxLabel,
      'CNPJ/CPF'
    );

    // Mostra Razão Social
    if (legalNameField) {
      legalNameField.hidden = false;
    }

    // Mostra I.E.
    if (stateRegistrationField) {
      stateRegistrationField.hidden = false;
    }

    // Mostra I.M.
    if (municipalRegistrationField) {
      municipalRegistrationField.hidden = false;
    }

    // Mostra Buscar CNPJ
    if (btnCNPJ) {
      btnCNPJ.hidden = false;
    }
  }

  // Atualiza máscara CPF/CNPJ
  renderTax();
}

// ---------------------------------------------------------------------
// CPF/CNPJ preservando dígitos brutos
// ---------------------------------------------------------------------
function fmtCPF(d) {
  d = String(d || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}
function fmtCNPJ(d) {
  d = String(d || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}
function setTaxRaw(val) {
  const el = document.getElementById('tax_id');
  if (!el) return;
  el.dataset.raw = onlyDigits(val).slice(0, 14);
}
function getTaxRaw() {
  const el = document.getElementById('tax_id');
  if (!el) return '';
  return el.dataset?.raw ? String(el.dataset.raw) : onlyDigits(el.value).slice(0, 14);
}
function renderTax() {
  const el = document.getElementById('tax_id');
  if (!el) return;
  const raw = getTaxRaw();
  el.value = isPF() ? fmtCPF(raw) : fmtCNPJ(raw);
}

function setLabelTitle(labelEl, text) {
  if (!labelEl) return;
  const tn = Array.from(labelEl.childNodes).find(
    (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== ''
  );
  if (tn) tn.textContent = text + ' ';
  else labelEl.insertBefore(document.createTextNode(text + ' '), labelEl.firstChild);
}

// ---------------------------------------------------------------------
// SellerForCustomer — estado
// ---------------------------------------------------------------------
const SELLER_SELECT_ID = 'customer-seller-select';
let currentSellerLink = null;

// ---------------------------------------------------------------------
// ✅ IBGE cache (NOVO)
// ---------------------------------------------------------------------
let IBGE_CACHE = {
  states: [],           // [{ uf:'SP', name:'SP' }]
  citiesByUF: new Map() // 'SP' -> ['São Paulo', ...] (não obrigatório)
};

// ---------------------------------------------------------------------
// Fetch JSON flexível (aceita vários formatos)
// ---------------------------------------------------------------------
async function fetchJsonTry(urls = []) {
  let lastErr = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status} (${url})`); continue; }

      const js = await r.json();

      // 1) direto
      if (Array.isArray(js)) return js;

      // 2) envelope comum {ok,data}
      if (js?.ok && js?.data != null) {
        if (Array.isArray(js.data)) return js.data;
        if (Array.isArray(js.data?.rows)) return js.data.rows;
        if (Array.isArray(js.data?.items)) return js.data.items;
        if (Array.isArray(js.data?.result)) return js.data.result;
        if (Array.isArray(js.data?.data)) return js.data.data;
      }

      // 3) outros formatos comuns
      if (Array.isArray(js?.data)) return js.data;
      if (Array.isArray(js?.rows)) return js.rows;
      if (Array.isArray(js?.items)) return js.items;
      if (Array.isArray(js?.result)) return js.result;

      // 4) paginação {data:{rows:[]}}
      if (Array.isArray(js?.data?.rows)) return js.data.rows;
      if (Array.isArray(js?.data?.items)) return js.data.items;

      lastErr = new Error(`Resposta inesperada (${url})`);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Falha ao buscar JSON');
}

// ---------------------------------------------------------------------
// ✅ IBGE Resolve -> Código IBGE (Cidade)
// ---------------------------------------------------------------------
function extractIbgeCodeFromResolvePayload(js) {
  // aceita vários formatos: {ok:true,data:{ibgeCode}} | {data:{ibge_code}} | {ibgeCode} | [ {ibgeCode} ]
  const root = js?.data ?? js;

  if (Array.isArray(root) && root[0]) {
    const it = root[0];
    return it.ibgeCode ?? it.ibge_code ?? it.codigo_ibge ?? it.codigo ?? it.city_ibge_code ?? it.ibge_city_code ?? null;
  }

  if (root && typeof root === 'object') {
    return root.ibgeCode ?? root.ibge_code ?? root.codigo_ibge ?? root.codigo ?? root.city_ibge_code ?? root.ibge_city_code ?? null;
  }

  return null;
}

async function resolveAndSetIbgeCityCode(uf, city) {
  const UF = normUF(uf);
  const CITY = String(city || '').trim();
  if (!UF || CITY.length < 2) return;

  const codeEl = document.getElementById('ibge_city_code');
  if (!codeEl) return;

  try {
    const r = await fetch(ROUTES.ibgeResolveCity(UF, CITY), { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return; // não trava o usuário
    const js = await r.json().catch(() => ({}));

    const code = extractIbgeCodeFromResolvePayload(js);
    if (code != null && String(code).trim() !== '') {
      set('ibge_city_code', String(code).trim());
    }
  } catch {
    // silencioso
  }
}

// ---------------------------------------------------------------------
// ✅ IBGE UI init (select UF + datalist cidades) — FINAL (rotas novas)
// ---------------------------------------------------------------------
async function initIbgeAddressUI() {
  // ✅ Modal IBGE (seu módulo real)
  // OBS: no seu HTML você usa /public/modalsSearch/ibgeCustomersModalSearch.js
  // então o import correto NÃO é ibgeLocationModal.js
  // (vamos tentar chamar se existir, e se não existir, seguimos sem travar)
  try {
    if (typeof initIbgeLocationModal === 'function') {
      initIbgeLocationModal({
        openButtonId: 'btnOpenUfModal',
        stateSelectId: 'state',
        cityInputId: 'city',
        ibgeInputId: 'ibge_city_code',
      });
    }
  } catch (e) {
    console.warn('[ibge] init modal skip:', e);
  }

  const ufEl = document.getElementById('state');   // INPUT (no seu HTML)
  const cityEl = document.getElementById('city');    // INPUT
  const cityList = document.getElementById('cityList');// DATALIST

  if (!ufEl || !cityEl) return;

  // ✅ Se UF for SELECT, carregamos opções. Se for INPUT, só normalizamos.
  if (ufEl.tagName === 'SELECT') {
    try { await loadIbgeStatesIntoSelect(); } catch (e) { console.warn('[ibge] states:', e); }
  }

  // 1) Ao trocar UF: limpa cidade/lista/código
  const onUfChange = () => {
    const uf = normUF(ufEl.value);

    if (!uf) {
      cityEl.value = '';
      if (cityList) cityList.innerHTML = '';
      set('ibge_city_code', '');
      return;
    }

    // Se UF mudou e a cidade estava vazia, limpa lista e código
    if (!String(cityEl.value || '').trim()) {
      if (cityList) cityList.innerHTML = '';
      set('ibge_city_code', '');
    }
  };

  ufEl.addEventListener('change', onUfChange);
  ufEl.addEventListener('blur', onUfChange);
  ufEl.addEventListener('input', debounce(() => {
    // só normaliza em tempo real sem travar digitação
    const before = ufEl.value;
    const after = normUF(before);
    if (after !== before) ufEl.value = after;
  }, 120));

  // 2) Enquanto digita cidade: busca com q=
  const onCityInput = debounce(async () => {
    const uf = normUF(ufEl.value);
    const q = String(cityEl.value || '').trim();

    if (!cityList) return;
    if (!uf || q.length < 2) {
      cityList.innerHTML = '';
      set('ibge_city_code', '');
      return;
    }

    try {
      await loadIbgeCitiesIntoDatalist(uf, q);
    } catch (e) {
      console.warn('[ibge] cities:', e);
      cityList.innerHTML = '';
    }
  }, 250);

  cityEl.addEventListener('input', onCityInput);

  // 3) Ao sair/confirmar cidade: resolve código IBGE
  const resolveOnExit = async () => {
    const uf = normUF(ufEl.value);
    const city = String(cityEl.value || '').trim();
    if (!uf || city.length < 2) return;
    await resolveAndSetIbgeCityCode(uf, city);
  };

  cityEl.addEventListener('blur', resolveOnExit);
  cityEl.addEventListener('change', resolveOnExit);

  // 4) Se já veio UF/Cidade preenchidos: tenta resolver código se vazio
  const uf0 = normUF(ufEl.value);
  const city0 = String(cityEl.value || '').trim();
  const code0 = String(get('ibge_city_code') || '').trim();

  if (uf0 && city0.length >= 2) {
    try { if (cityList) await loadIbgeCitiesIntoDatalist(uf0, city0); } catch { }
    if (!code0) await resolveAndSetIbgeCityCode(uf0, city0);
  }
}

async function loadIbgeStatesIntoSelect() {
  const ufSelect = document.getElementById('state');
  if (!ufSelect || ufSelect.tagName !== 'SELECT') return;

  // ✅ fallback para rotas diferentes (evita 404)
  const arr = await fetchJsonTry([
    ROUTES.ibgeUfs,                    // /api/ibge-locations/ufs (novo)
    `${API_BASE}/api/ibge/ufs`,        // legado
    `${API_BASE}/api/ibgeUfs`,         // legado
    `${API_BASE}/api/ibge-ufs`,        // variações
    `${API_BASE}/api/ibgeUf`,
  ]);

  const states = (Array.isArray(arr) ? arr : [])
    .map((it) => {
      const uf = normUF(it.uf || it.UF || it.sigla || it.state || it.state_uf || it.code);
      const name = String(
        it.name || it.nome || it.uf_name || it.estado_nome || it.state_name || it.estado || it.label || ''
      ).trim();
      if (!uf || uf.length !== 2) return null;
      return { uf, name: name || uf };
    })
    .filter(Boolean);

  // Dedup + sort
  const map = new Map();
  for (const s of states) {
    if (!map.has(s.uf)) map.set(s.uf, s);
    else if ((s.name || '').length > (map.get(s.uf).name || '').length) map.set(s.uf, s);
  }

  const finalStates = Array.from(map.values()).sort((a, b) => a.uf.localeCompare(b.uf, 'pt-BR'));
  IBGE_CACHE.states = finalStates;

  const current = normUF(ufSelect.value);
  ufSelect.innerHTML = '<option value="">Selecione…</option>';

  for (const s of finalStates) {
    const o = document.createElement('option');

    o.value = s.uf;

    o.textContent =
      s.name &&
        s.name.toUpperCase() !== s.uf.toUpperCase()
        ? `${s.uf} — ${s.name}`
        : s.uf;

    ufSelect.appendChild(o);
  }

  if (current) ufSelect.value = current;
}

async function loadIbgeCitiesIntoDatalist(uf, q = '') {
  uf = normUF(uf);
  const cityList = document.getElementById('cityList');
  if (!cityList) return;

  if (!uf) {
    cityList.innerHTML = '';
    return;
  }

  // ✅ se não digitou, não puxa lista gigante
  const query = String(q || '').trim();
  if (query.length < 2) {
    renderCitiesDatalist([]);
    return;
  }

  const arr = await fetchJsonTry([
    ROUTES.ibgeCitiesSearch(uf, query, 120, 0),
  ]);

  const cities = (Array.isArray(arr) ? arr : [])
    .map((it) => String(it.nome || it.name || it.city || it.municipio || '').trim())
    .filter(Boolean);

  const uniq = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  renderCitiesDatalist(uniq);
}

function renderCitiesDatalist(cities) {
  const cityList = document.getElementById('cityList');
  if (!cityList) return;
  cityList.innerHTML = '';
  for (const c of cities) {
    const o = document.createElement('option');
    o.value = c;
    cityList.appendChild(o);
  }
}

// Util: setar UF + Cidade garantindo lista carregada + (opcional) resolve código
async function setUFAndCityFromIbge(uf, cityName, { resolveCode = true } = {}) {
  const ufEl = document.getElementById('state');
  const cityEl = document.getElementById('city');

  const UF = normUF(uf);
  if (!UF || !ufEl || !cityEl) return;

  if (ufEl.tagName === 'SELECT') {
    if (!IBGE_CACHE.states?.length) {
      try { await loadIbgeStatesIntoSelect(); } catch { }
    }
    ufEl.value = UF;

    if (cityName) {
      const desired = String(cityName).trim();
      cityEl.value = desired;

      if (desired.length >= 2) {
        try { await loadIbgeCitiesIntoDatalist(UF, desired); } catch { }
        if (resolveCode) {
          await resolveAndSetIbgeCityCode(UF, desired);
        }
      }
    }
  } else {
    set('state', UF);
    if (cityName) set('city', cityName);
    if (resolveCode && cityName) await resolveAndSetIbgeCityCode(UF, cityName);
  }
}

// ---------------------------------------------------------------------
// ✅ IBGE MODAL bridge (pós-apply garante código IBGE se não veio)
// ---------------------------------------------------------------------
function initIbgeModalBridge() {
  const btnApply = document.getElementById('ibgeLocationApply');
  if (!btnApply) return;

  btnApply.addEventListener('click', async () => {
    setTimeout(async () => {
      const uf = normUF(get('state'));
      const city = String(get('city') || '').trim();
      const code = String(get('ibge_city_code') || '').trim();

      if (uf && city && !code) {
        await resolveAndSetIbgeCityCode(uf, city);
      }
    }, 80);
  });
}

// ---------------------------------------------------------------------
// Tabs — Dados Gerais / Notas Fiscais
// ---------------------------------------------------------------------
function initCustomerTabs() {
  const tabButtons = Array.from(
    document.querySelectorAll('.tab[data-tab]')
  );

  const tabPanels = Array.from(
    document.querySelectorAll('.tab-panel')
  );

  if (!tabButtons.length || !tabPanels.length) {
    console.warn('[customerEdit] Abas ou painéis não encontrados.');
    return;
  }

  function activateTab(selectedButton) {
    const targetId = selectedButton.dataset.tab;
    const targetPanel = document.getElementById(targetId);

    if (!targetPanel) {
      console.error(
        `[customerEdit] Painel não encontrado: ${targetId}`
      );
      return;
    }

    tabButtons.forEach((button) => {
      const selected = button === selectedButton;

      button.classList.toggle('is-active', selected);

      button.setAttribute(
        'aria-selected',
        selected ? 'true' : 'false'
      );

      button.tabIndex = selected ? 0 : -1;
    });

    tabPanels.forEach((panel) => {
      const selected = panel === targetPanel;

      panel.classList.toggle('is-active', selected);
      panel.hidden = !selected;
    });
  }

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      activateTab(button);
    });

    button.addEventListener('keydown', (event) => {
      let nextIndex = index;

      if (event.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabButtons.length;
      } else if (event.key === 'ArrowLeft') {
        nextIndex =
          (index - 1 + tabButtons.length) %
          tabButtons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabButtons.length - 1;
      } else {
        return;
      }

      event.preventDefault();

      const nextButton = tabButtons[nextIndex];

      activateTab(nextButton);
      nextButton.focus();
    });
  });

  const initialButton =
    tabButtons.find((button) =>
      button.classList.contains('is-active')
    ) || tabButtons[0];

  activateTab(initialButton);
}

// ---------------------------------------------------------------------
// Bootstrap da página (chamado por customersEdit.init.js)
export async function initializeCustomersEdit() {
  initCustomerTabs();
  bindUI();
  masks();
  await loadSelects(); // segmento + classificação
  await initFinancialDefaults(); // plano de contas / categoria / subcategoria

  // "+" de cadastro rápido: segmento / vendedor / tipo de status
  initCustomerQuickAdd({
    reloadSegments: () => fillSelect('business_segment', ROUTES.segmentos),
    reloadSellers: loadSellersOptions,
  });

  // ✅ inicializa UF/Cidade via IBGE NOVO (API + datalist + modal)
  await initIbgeAddressUI();

  // ✅ mantém o bridge (pós-apply do modal)
  initIbgeModalBridge();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  if (!id) {
    showCenterModal({
      variant: 'warning',
      title: 'Editar Cliente',
      message: 'Parâmetro ?id ausente.'
    });
    return;
  }

  set('customer_id', id);
  await loadCustomer(id);
  await initCustomerPriceTable(id);
  await initSellerModule(id);
}

// ---------------------------------------------------------------------
// ASAAS — Criar ou vincular cliente
// ---------------------------------------------------------------------
async function syncCustomerWithAsaas() {
  const button = $('#btnGerarAsaas');
  const input = $('#asaas_id');

  const customerId =
    get('customer_id') ||
    new URLSearchParams(window.location.search).get('id');

  if (!button || !input) {
    console.error(
      '[ASAAS] Botão #btnGerarAsaas ou campo #asaas_id não encontrado.'
    );
    return;
  }

  if (!customerId) {
    showCenterModal({
      variant: 'warning',
      title: 'Integração ASAAS',
      message: 'Não foi possível identificar o cliente.'
    });
    return;
  }

  if (input.value.trim()) {
    const confirmed = window.confirm(
      'Este cliente já possui um ASAAS ID.\n' +
      'Deseja sincronizá-lo novamente?'
    );

    if (!confirmed) return;
  }

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Gerando...';

  try {
    const url = ROUTES.asaasSync(customerId);

    console.log('[ASAAS] Sincronizando cliente:', {
      customerId,
      url
    });

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();

    let result = {};

    try {
      result = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      result = {
        message: responseText
      };
    }

    console.log('[ASAAS] Resposta:', response.status, result);

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        result.details ||
        `Erro HTTP ${response.status}`
      );
    }

    const asaasId =
      result.asaas_id ||
      result.asaasId ||
      result.customerId ||
      result.customer_id ||
      result.customer?.id ||
      result.customer?.asaas_id ||
      result.cliente?.asaas_id ||
      result.cliente?.asaasId ||
      result.cliente?.id ||
      result.data?.asaas_id ||
      result.data?.asaasId ||
      result.data?.customerId ||
      result.data?.customer_id ||
      result.data?.customer?.id ||
      result.data?.cliente?.asaas_id ||
      result.id ||
      '';

    if (!asaasId) {
      throw new Error(
        result.message ||
        'A sincronização foi concluída, mas o backend não retornou o ASAAS ID.'
      );
    }

    input.value = String(asaasId);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    showCenterModal({
      variant: 'success',
      title: 'Integração ASAAS',
      message: `Cliente vinculado com sucesso. ASAAS ID: ${asaasId}`
    });
  } catch (error) {
    console.error('[ASAAS] Falha ao sincronizar cliente:', error);

    showCenterModal({
      variant: 'error',
      title: 'Erro na integração ASAAS',
      message:
        error?.message ||
        'Não foi possível gerar o ASAAS ID.'
    });
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ---------------------------------------------------------------------
// UI & Eventos básicos
// ---------------------------------------------------------------------
function bindUI() {
  $('#btnCancelar')?.addEventListener('click', () => history.back());

  $('#btnGerarAsaas')?.addEventListener(
    'click',
    syncCustomerWithAsaas
  );

  $('#btnObservacoes')?.addEventListener('click', () => {
    showCenterModal({
      variant: 'info',
      title: 'Observações',
      message: 'Futuro módulo de observações do cliente.'
    });
  });

  $('#formCliente')?.addEventListener('submit', onSubmit);
  $('#postal_code')?.addEventListener('blur', buscarCEP);
  $('#btnBuscarCNPJ')?.addEventListener('click', buscarCNPJ);
  $('#credit_limit')?.addEventListener('input', () => {
    const limit = Number(String(get('credit_limit')).replace(',', '.')) || 0;
    const used = Number(String(get('credit_used')).replace(',', '.')) || 0;
    set('credit_available', Math.max(limit - used, 0).toFixed(2));
  });

  $('#person_type')?.addEventListener(
    'change',
    updatePersonTypeUI
  );

  const tax = document.getElementById('tax_id');
  tax?.addEventListener('input', () => {
    setTaxRaw(tax.value);
    renderTax();
  });
}

// ---------------------------------------------------------------------
// Carregamento de cliente
// ---------------------------------------------------------------------
async function loadCustomer(id) {
  try {
    // 1) tenta rota REST /:id (se existir no futuro)
    // 2) fallback: busca lista e filtra
    let c = null;

    // tentativa 1 (pode falhar hoje, mas deixa pronto)
    try {
      const r1 = await fetch(ROUTES.customerById(id), { headers: { Accept: 'application/json' } });
      if (r1.ok) {
        const js1 = await r1.json().catch(() => ({}));
        c = js1?.data ?? js1;
      }
    } catch { }

    // fallback atual (seu backend hoje)
    if (!c || typeof c !== 'object') {
      const r = await fetch(`${ROUTES.customers}?page=1&pageSize=500`, { headers: { Accept: 'application/json' } });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(js?.error || js?.message || `HTTP ${r.status}`);

      const rows = js?.rows || js?.data?.rows || [];
      c = rows.find(x => String(x.customer_id) === String(id));
      if (!c) throw new Error('Cliente não encontrado na lista.');
    }

    await fill(c);
    await loadCustomerCredit(id);
  } catch (e) {
    console.error(e);
    showCenterModal({
      variant: 'error',
      title: 'Carregar',
      message: `Não foi possível carregar o cliente. (${e.message})`,
    });
  }
}

async function fill(c = {}) {
  // Tipo pessoa
  const personType = normalizePersonType(
    c.customer_type ??
    c.customerType ??
    c.person_type ??
    c.tipo_pessoa ??
    c.tipo ??
    'J'
  );

  // Nome Fantasia
  const tradeName =
    c.trade_name ||
    c.tradeName ||
    c.fantasy_name ||
    c.nome_fantasia ||
    c.name ||
    '';

  // Razão Social
  const legalName =
    c.legal_name ||
    c.legalName ||
    c.razao_social ||
    c.name ||
    '';

  // Documento
  const tax =
    c.tax_id || c.cnpj_cpf || c.cnpjCpf || c.taxId || '';

  // Telefones
  const phone =
    c.phone_number || c.phone || c.telefone || '';

  const mobile =
    c.mobile_number || c.cellphone || c.celular || '';

  // Ativo
  const active =
    (c.is_active != null ? c.is_active : (c.active != null ? c.active : true));

  // -------------------------
  // 1) Dados gerais
  // -------------------------
  set('person_type', personType || 'J');
  updatePersonTypeUI();

  set('trade_name', tradeName);
  set('legal_name', legalName);

  setTaxRaw(tax);
  renderTax();

  set('state_registration', c.state_registration ?? c.ie ?? '');
  set('municipal_registration', c.municipal_registration ?? c.im ?? '');

  // Crédito: limite configurável e valores calculados pela posição financeira.
  set('credit_limit', Number(c.credit_limit ?? 0).toFixed(2));
  set('credit_used', Number(c.credit_used ?? c.amount_to_pay ?? 0).toFixed(2));
  set('credit_available', Number(c.credit_available ?? 0).toFixed(2));

  // -------------------------
  // 2) Contato
  // -------------------------
  set('contact_name', c.contact_name ?? c.responsavel ?? '');
  set('email', c.email ?? '');
  set('phone_number', phone ?? '');
  set('mobile_number', mobile ?? '');

  // -------------------------
  // 3) Contato financeiro
  // -------------------------
  set('financial_contact_name', c.financial_contact_name ?? '');
  set('financial_contact_email', c.financial_contact_email ?? '');
  set('financial_contact_phone', c.financial_contact_phone ?? '');
  set('financial_contact_mobile', c.financial_contact_mobile ?? '');
  set('billing_email', c.billing_email ?? '');
  set('invoice_email', c.invoice_email ?? '');
  set('financial_contact_notes', c.financial_contact_notes ?? '');

  // Classificação padrão para a Movimentação de Caixa
  fillFinancialDefaults(c).catch((err) =>
    console.error('[customersEdit] classificação padrão:', err)
  );

  // -------------------------
  // 4) Endereço
  // -------------------------
  set('postal_code', c.postal_code ?? c.cep ?? '');
  set('street_type', c.street_type ?? c.tipo_logradouro ?? '');
  set('street_name', c.street_name ?? c.logradouro ?? '');
  set('street_number', c.street_number ?? c.numero ?? '');
  set('address_complement', c.address_complement ?? c.complemento ?? '');
  set('neighborhood', c.neighborhood ?? c.bairro ?? '');
  set('city', c.city ?? c.cidade ?? '');
  set('state', c.state ?? c.uf ?? '');

  // ✅ IBGE city code (se vier do backend)
  set('ibge_city_code',
    c.ibge_city_code ??
    c.codigo_ibge ??
    c.ibge_code ??
    c.city_ibge_code ??
    ''
  );

  // -------------------------
  // 5) Endereço de entrega
  // Aceita resposta plana (customer_ad_*) e os envelopes mais comuns.
  // -------------------------
  const deliveryAddress =
    c.delivery_address ||
    c.deliveryAddress ||
    c.customer_address_delivery ||
    c.customerAddressDelivery ||
    c;
  const hasDeliveryEnvelope = deliveryAddress !== c;

  set('customer_ad_id',
    deliveryAddress.customer_ad_id ?? c.customer_ad_id ?? ''
  );
  set('customer_ad_street_type', deliveryAddress.customer_ad_street_type ?? '');
  set('customer_ad_street_name', deliveryAddress.customer_ad_street_name ?? '');
  set('customer_ad_street_number', deliveryAddress.customer_ad_street_number ?? '');
  set('customer_ad_address_complement', deliveryAddress.customer_ad_address_complement ?? '');
  set('customer_ad_neighborhood', deliveryAddress.customer_ad_neighborhood ?? '');
  set('customer_ad_city', deliveryAddress.customer_ad_city ?? '');
  set('customer_ad_state', normUF(deliveryAddress.customer_ad_state ?? ''));
  set('customer_ad_active', String(
    deliveryAddress.customer_ad_active ??
    (hasDeliveryEnvelope ? deliveryAddress.active : undefined) ??
    true
  ));

  // -------------------------
  // 6) Complementares
  // -------------------------
  set('business_segment', c.business_segment ?? c.segmento ?? '');
  set('classification', c.classification ?? c.classificacao ?? '');
  set('is_active', String(!!active));

  set('asaas_id', c.asaas_id ?? c.asaasId ?? '');

  // -------------------------
  // ✅ Depois de preencher UF/Cidade, garante UI IBGE consistente
  // (não puxa lista gigante; só resolve o código se estiver vazio)
  // -------------------------
  const uf = normUF(get('state'));
  const city = String(get('city') || '').trim();
  const code = String(get('ibge_city_code') || '').trim();

  if (uf && city && !code) {
    await resolveAndSetIbgeCityCode(uf, city);
  }
}

function fillCustomerCredit(credit = {}) {
  set('credit_limit', Number(credit.credit_limit ?? 0).toFixed(2));
  set('credit_used', Number(credit.credit_used ?? credit.amount_to_pay ?? 0).toFixed(2));
  set('credit_available', Number(credit.credit_available ?? 0).toFixed(2));
}

async function loadCustomerCredit(customerId) {
  try {
    const response = await fetch(ROUTES.customerCreditByCustomer(customerId), {
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) {
      fillCustomerCredit();
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
    }
    fillCustomerCredit(data?.data ?? data);
  } catch (error) {
    console.error('[customerEdit] loadCustomerCredit:', error);
    fillCustomerCredit();
  }
}

async function saveCustomerCredit(customerId, creditLimit) {
  const response = await fetch(ROUTES.customerCreditByCustomer(customerId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ credit_limit: creditLimit }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Falha ao salvar limite de crédito (HTTP ${response.status})`
    );
  }

  fillCustomerCredit(data?.data ?? data);
}

// ---------------------------------------------------------------------
// Tabela de preços do cliente
// ---------------------------------------------------------------------
async function initCustomerPriceTable(customerId) {
  const select = $('#price_table_id');
  if (!select || !customerId) return;

  select.disabled = true;
  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    const tablesResponse = await fetch(ROUTES.priceTables, {
      headers: { Accept: 'application/json' },
    });
    const tablesData = await tablesResponse.json().catch(() => []);

    if (!tablesResponse.ok) {
      throw new Error(
        tablesData?.error || tablesData?.message || `HTTP ${tablesResponse.status}`
      );
    }

    const tables = Array.isArray(tablesData)
      ? tablesData
      : (tablesData?.data ?? tablesData?.rows ?? []);

    select.innerHTML = '<option value="">Selecione...</option>';
    for (const table of tables) {
      const option = document.createElement('option');
      option.value = String(table.price_id);
      option.textContent = table.name || `Tabela ${table.price_id}`;
      select.appendChild(option);
    }

    const assignmentResponse = await fetch(ROUTES.customerPriceTable(customerId), {
      headers: { Accept: 'application/json' },
    });

    if (assignmentResponse.ok) {
      const assignmentData = await assignmentResponse.json().catch(() => ({}));
      const assignment = assignmentData?.data ?? assignmentData;
      select.value = String(assignment?.price_id ?? '');
    } else if (assignmentResponse.status !== 404) {
      const assignmentError = await assignmentResponse.json().catch(() => ({}));
      throw new Error(
        assignmentError?.error || assignmentError?.message || `HTTP ${assignmentResponse.status}`
      );
    }

    select.disabled = false;
  } catch (error) {
    console.error('[customerEdit] initCustomerPriceTable:', error);
    select.innerHTML = '<option value="">Erro ao carregar</option>';
    showCenterModal({
      variant: 'error',
      title: 'Tabela de Preços',
      message: `Não foi possível carregar as tabelas de preços. (${error.message})`,
    });
  }
}

async function saveCustomerPriceTable(customerId, priceId) {
  const response = await fetch(ROUTES.customerPriceTable(customerId), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ priceId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Falha ao salvar tabela de preços (HTTP ${response.status})`
    );
  }

  return data?.data ?? data;
}

// ---------------------------------------------------------------------
// Submit (PUT /api/customers/:id) + SellerForCustomer
// ---------------------------------------------------------------------
async function onSubmit(e) {
  e.preventDefault();

  // ✅ ID blindado: hidden (#customer_id) + fallback URL (?id=)
  let id = String(get('customer_id') || '').trim();
  if (!id) {
    const params = new URLSearchParams(window.location.search);
    id = String(params.get('id') || '').trim();
  }

  if (!id) {
    return showCenterModal({
      variant: 'warning',
      title: 'Validação',
      message: 'ID inválido.'
    });
  }

  const tipoPessoa = $('#person_type')?.value || 'J';
  const tradeName = trimOrNull(get('trade_name'));
  const legalName = trimOrNull(get('legal_name'));

  const rawDigitsAll = getTaxRaw();
  const tax_id_out = isPF()
    ? String(rawDigitsAll).slice(0, 11)
    : String(rawDigitsAll).slice(0, 14);

  const sellerSelect = document.getElementById(SELLER_SELECT_ID);
  const sellerIdValue = String(sellerSelect?.value || '').trim();

  // ✅ normalizações leves
  const uf = normUF(get('state')); // garante 2 chars e upper
  const postal = onlyDigits(get('postal_code')).slice(0, 8);
  const ibgeCode = onlyDigits(get('ibge_city_code')).slice(0, 7);
  const deliveryUf = normUF(get('customer_ad_state'));
  const creditLimit = Number(String(get('credit_limit')).replace(',', '.'));
  const priceTableId = Number(get('price_table_id'));

  const payload = {
    customer_type: tipoPessoa,

    trade_name: tradeName,
    legal_name: legalName,

    tax_id: tax_id_out,

    business_segment: trimOrNull(get('business_segment')),
    classification: trimOrNull(get('classification')),
    salesperson: sellerIdValue ? trimOrNull(sellerIdValue) : null,
    is_active: String(get('is_active')).toLowerCase() === 'true',

    email: trimOrNull(get('email')),
    postal_code: postal ? postal : null,
    street_type: trimOrNull(get('street_type')),
    street_name: trimOrNull(get('street_name')),
    street_number: trimOrNull(get('street_number')),
    address_complement: trimOrNull(get('address_complement')),
    neighborhood: trimOrNull(get('neighborhood')),
    city: trimOrNull(get('city')),
    state: uf ? uf : null,

    // ✅ Código IBGE cidade
    ibge_city_code: ibgeCode ? ibgeCode : null,

    contact_name: trimOrNull(get('contact_name')),
    phone_number: trimOrNull(get('phone_number')),
    mobile_number: trimOrNull(get('mobile_number')),

    // ✅ Contato financeiro
    financial_contact_name: trimOrNull(get('financial_contact_name')),
    financial_contact_email: trimOrNull(get('financial_contact_email')),
    financial_contact_phone: trimOrNull(get('financial_contact_phone')),
    financial_contact_mobile: trimOrNull(get('financial_contact_mobile')),
    billing_email: trimOrNull(get('billing_email')),
    invoice_email: trimOrNull(get('invoice_email')),
    financial_contact_notes: trimOrNull(get('financial_contact_notes')),

    // ✅ Classificação padrão (Movimentação de Caixa)
    ...readFinancialDefaults(),

    // Endereço de entrega vinculado por customers.customer_ad_id.
    // Os campos planos preservam compatibilidade com o PUT atual.
    customer_ad_id: trimOrNull(get('customer_ad_id')),
    customer_ad_street_type: trimOrNull(get('customer_ad_street_type')),
    customer_ad_street_name: trimOrNull(get('customer_ad_street_name')),
    customer_ad_street_number: trimOrNull(get('customer_ad_street_number')),
    customer_ad_address_complement: trimOrNull(get('customer_ad_address_complement')),
    customer_ad_neighborhood: trimOrNull(get('customer_ad_neighborhood')),
    customer_ad_city: trimOrNull(get('customer_ad_city')),
    customer_ad_state: deliveryUf || null,
    customer_ad_active: String(get('customer_ad_active')).toLowerCase() === 'true',

    asaas_id: trimOrNull(get('asaas_id')),
    state_registration: trimOrNull(get('state_registration')),
    municipal_registration: trimOrNull(get('municipal_registration'))
  };

  // ✅ PF não usa IE/IM
  if (isPF()) {
    payload.state_registration = null;
    payload.municipal_registration = null;
  }

  // -------------------------------------------------------------------
  // ✅ Validações
  // -------------------------------------------------------------------
  if (isPF()) {
    if (!payload.legal_name && !payload.trade_name) {
      return showCenterModal({
        variant: 'warning',
        title: 'Validação',
        message: 'Informe o Nome.'
      });
    }

    // Para PF, mantém os dois campos coerentes
    payload.legal_name =
      payload.legal_name ||
      payload.trade_name;

    payload.trade_name =
      payload.trade_name ||
      payload.legal_name;

    if (tax_id_out.length !== 11) {
      return showCenterModal({ variant: 'warning', title: 'Validação', message: 'Informe um CPF com 11 dígitos.' });
    }
  } else {
    if (!payload.trade_name) {
      return showCenterModal({ variant: 'warning', title: 'Validação', message: 'Informe o Nome Fantasia / Nome.' });
    }
    if (!payload.legal_name) {
      return showCenterModal({ variant: 'warning', title: 'Validação', message: 'Informe a Razão Social / Nome.' });
    }
    if (tax_id_out.length !== 14) {
      return showCenterModal({ variant: 'warning', title: 'Validação', message: 'Informe um CNPJ com 14 dígitos.' });
    }
  }

  // (opcional) valida UF se preenchido
  if (payload.state && String(payload.state).length !== 2) {
    return showCenterModal({ variant: 'warning', title: 'Validação', message: 'UF inválida. Use 2 letras (ex: MG).' });
  }

  if (payload.customer_ad_state && payload.customer_ad_state.length !== 2) {
    return showCenterModal({
      variant: 'warning',
      title: 'Validação',
      message: 'A UF do endereço de entrega deve ter 2 letras (ex: MG).'
    });
  }


  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    return showCenterModal({
      variant: 'warning',
      title: 'Validação',
      message: 'O limite de crédito deve ser um valor igual ou maior que zero.'
    });
  }

  if (!Number.isSafeInteger(priceTableId) || priceTableId <= 0) {
    return showCenterModal({
      variant: 'warning',
      title: 'Validação',
      message: 'Selecione uma tabela de preços para o cliente.'
    });
  }

  try {
    const r = await fetch(ROUTES.customerById(id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });

    const js = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = js?.error || js?.message || (js?.details?.message) || `HTTP ${r.status}`;
      throw new Error(msg);
    }

    // Mantém no formulário o ID eventualmente criado pelo backend no PUT.
    const savedCustomer = js?.data ?? js?.customer ?? js;
    const savedDeliveryAddress =
      savedCustomer?.delivery_address ||
      savedCustomer?.deliveryAddress ||
      savedCustomer?.customer_address_delivery ||
      savedCustomer?.customerAddressDelivery ||
      savedCustomer;
    const savedDeliveryAddressId =
      savedDeliveryAddress?.customer_ad_id ?? savedCustomer?.customer_ad_id;
    if (savedDeliveryAddressId != null) {
      set('customer_ad_id', savedDeliveryAddressId);
    }

    // Salva o limite e atualiza gasto/disponível pelo módulo de crédito.
    await saveCustomerCredit(id, creditLimit);

    // Salva uma única tabela de preços ativa para o cliente.
    await saveCustomerPriceTable(id, priceTableId);

    // ✅ mantém seu vínculo seller ↔ customer
    await saveSellerForCustomerRelation(id);

    showCenterModal({
      variant: 'success',
      title: 'Salvo',
      message: 'Alterações gravadas com sucesso!',
      timeoutMs: 2000
    });
  } catch (e) {
    console.error(e);
    showCenterModal({
      variant: 'error',
      title: 'Falha',
      message: `Não foi possível salvar. ${e?.message ? `(${e.message})` : ''}`
    });
  }
}

// ---------------------------------------------------------------------
// Combos (Segmento, Classificação)
// ---------------------------------------------------------------------
async function loadSelects() {
  await Promise.all([
    fillSelect('business_segment', ROUTES.segmentos),
    fillSelect('classification', ROUTES.classificacoes)
  ]).catch(console.warn);
}

async function fillSelect(id, url) {
  const el = document.getElementById(id);
  if (!el) return;

  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const js = await r.json().catch(() => ({}));

    const root = js?.data ?? js;
    const arr =
      Array.isArray(root) ? root :
        Array.isArray(root?.rows) ? root.rows :
          Array.isArray(root?.items) ? root.items :
            Array.isArray(js?.rows) ? js.rows :
              Array.isArray(js?.items) ? js.items :
                [];

    el.innerHTML = '<option value="">Selecione…</option>';

    arr.forEach(it => {
      let value = '';
      let text = '';

      if (id === 'business_segment' && (it.segment_code || it.segment_name)) {
        value = it.segment_code || it.segment_name;
        text = it.segment_name
          ? `${it.segment_name} (${it.segment_code || ''})`.trim()
          : it.segment_code;
      } else {
        value = it?.id ?? it?.codigo ?? it?.code ?? it?.nome ?? it?.name ?? '';
        text = it?.nome ?? it?.descricao ?? it?.description ?? it?.name ?? String(value);
      }

      if (!value && !text) return;

      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      el.appendChild(o);
    });
  } catch (e) {
    console.warn('fillSelect', id, e);
  }
}

// ---------------------------------------------------------------------
// Módulo SellerForCustomer (Vendedor x Cliente)
// ---------------------------------------------------------------------
async function initSellerModule(customerId) {
  try {
    await loadSellersOptions();
    await loadCurrentSellerForCustomer(customerId);
  } catch (e) {
    console.error('[customerEdit] initSellerModule error:', e);
  }
}

async function loadSellersOptions() {
  const el = document.getElementById(SELLER_SELECT_ID);
  if (!el) return;

  el.innerHTML = '<option value="">Selecione…</option>';

  const urls = [ROUTES.sellers, ROUTES.vendedores].filter(Boolean);
  let data = null;

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        console.warn('[customerEdit] loadSellersOptions HTTP', r.status, 'em', url);
        continue;
      }
      data = await r.json();
      break;
    } catch (e) {
      console.warn('[customerEdit] loadSellersOptions erro em', url, e);
    }
  }

  if (!data) return;

  const root = data?.data ?? data;
  const arr =
    Array.isArray(root?.items) ? root.items :
      Array.isArray(root?.rows) ? root.rows :
        Array.isArray(root?.data) ? root.data :
          (Array.isArray(root) ? root : []);

  arr.forEach(s => {
    const id = s.id ?? s.seller_id ?? s.codigo ?? s.code;
    if (id == null) return;

    const name =
      s.nickname ??
      s.apelido ??
      s.name ??
      s.nome ??
      s.description ??
      `Vendedor #${id}`;

    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    el.appendChild(o);
  });
}

async function loadCurrentSellerForCustomer(customerId) {
  const el = document.getElementById(SELLER_SELECT_ID);
  if (!el || !customerId) return;

  try {
    const r = await fetch(ROUTES.sellerForCustomerByCustomer(customerId), {
      headers: { 'Accept': 'application/json' }
    });
    const js = await r.json().catch(() => ({}));

    const root = js?.data ?? js;
    const items =
      Array.isArray(root?.items) ? root.items :
        Array.isArray(root?.rows) ? root.rows :
          Array.isArray(root) ? root :
            [];

    const active = items.find(it => it.link_active !== false && it.link_active !== 0) || items[0];

    if (active) {
      currentSellerLink = active;
      const sellerId = active.id ?? active.seller_id;
      if (sellerId != null) el.value = String(sellerId);
    }
  } catch (e) {
    console.error('[customerEdit] loadCurrentSellerForCustomer error:', e);
  }
}

async function saveSellerForCustomerRelation(customerId) {
  const el = document.getElementById(SELLER_SELECT_ID);
  if (!el || !customerId) return;

  const newSellerIdRaw = el.value || '';
  const newSellerId = newSellerIdRaw ? Number(newSellerIdRaw) : null;

  const hasLink = !!currentSellerLink;
  const currentSellerId = hasLink
    ? Number(currentSellerLink.id ?? currentSellerLink.seller_id ?? 0)
    : null;
  const linkId = hasLink
    ? (currentSellerLink.link_id ?? currentSellerLink.id ?? null)
    : null;

  if (!newSellerId && !hasLink) return;

  if (
    hasLink &&
    newSellerId &&
    currentSellerId === newSellerId &&
    currentSellerLink.link_active !== false &&
    currentSellerLink.active !== false
  ) return;

  try {
    if (!newSellerId && hasLink && linkId != null) {
      await fetch(`${ROUTES.sellerForCustomer}/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
      currentSellerLink = null;
      return;
    }

    if (hasLink && linkId != null && newSellerId) {
      const r = await fetch(`${ROUTES.sellerForCustomer}/${encodeURIComponent(linkId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ seller_id: newSellerId, active: true })
      });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(js?.message || js?.error || `HTTP ${r.status}`);
      currentSellerLink = js?.data?.item || js?.item || null;
      return;
    }

    if (!hasLink && newSellerId) {
      const r = await fetch(ROUTES.sellerForCustomer, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ seller_id: newSellerId, customer_id: Number(customerId), active: true })
      });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(js?.message || js?.error || `HTTP ${r.status}`);
      currentSellerLink = js?.data?.item || js?.item || null;
    }
  } catch (e) {
    console.error('[customerEdit] saveSellerForCustomerRelation error:', e);
    showCenterModal({
      variant: 'warning',
      title: 'Vínculo Vendedor',
      message: 'Cliente salvo, mas houve erro ao vincular o vendedor.'
    });
  }
}

// ---------------------------------------------------------------------
// Normaliza tipos de logradouro
// ---------------------------------------------------------------------
function normalizeStreetType(value = '') {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '');

  const TYPES = {
    R: 'RUA',
    RUA: 'RUA',

    AV: 'AVENIDA',
    AVE: 'AVENIDA',
    AVENIDA: 'AVENIDA',

    AL: 'ALAMEDA',
    ALAMEDA: 'ALAMEDA',

    TV: 'TRAVESSA',
    TRAV: 'TRAVESSA',
    TRAVESSA: 'TRAVESSA',

    ROD: 'RODOVIA',
    RDV: 'RODOVIA',
    RODOVIA: 'RODOVIA',

    EST: 'ESTRADA',
    ESTR: 'ESTRADA',
    ESTRADA: 'ESTRADA',

    PC: 'PRAÇA',
    PCA: 'PRAÇA',
    PRAÇA: 'PRAÇA',
    PRACA: 'PRAÇA',

    LG: 'LARGO',
    LARGO: 'LARGO',

    VIA: 'VIA',

    VL: 'VIELA',
    VIELA: 'VIELA',

    BEC: 'BECO',
    BECO: 'BECO',

    PASS: 'PASSAGEM',
    PASSAGEM: 'PASSAGEM',

    CONJ: 'CONJUNTO',
    CONJUNTO: 'CONJUNTO',

    QD: 'QUADRA',
    QUADRA: 'QUADRA',

    ST: 'SETOR',
    SETOR: 'SETOR',

    SERV: 'SERVIDÃO',
    SERVIDAO: 'SERVIDÃO',
    SERVIDÃO: 'SERVIDÃO'
  };

  return TYPES[raw] || raw;
}

// ---------------------------------------------------------------------
// ✅ Split seguro: Tipo Logradouro + Nome Logradouro (ViaCEP / CNPJ)
// - Só preenche street_type se o prefixo for um tipo conhecido
// - Caso contrário: street_type='' e street_name=logradouro inteiro
// ---------------------------------------------------------------------
function splitStreetTypeAndName(raw = '') {
  const s = String(raw || '').trim();
  if (!s) return { type: '', name: '' };

  // Tipos comuns (Brasil) — pode ampliar se quiser
  const TYPES = new Map([
    ['RUA', 'RUA'],
    ['R.', 'RUA'],
    ['R', 'RUA'],

    ['AV', 'AVENIDA'],
    ['AV.', 'AVENIDA'],
    ['AVENIDA', 'AVENIDA'],

    ['ALAMEDA', 'ALAMEDA'],
    ['AL.', 'ALAMEDA'],
    ['AL', 'ALAMEDA'],

    ['TRAVESSA', 'TRAVESSA'],
    ['TV', 'TRAVESSA'],
    ['TV.', 'TRAVESSA'],

    ['RODOVIA', 'RODOVIA'],
    ['RDV', 'RODOVIA'],
    ['RDV.', 'RODOVIA'],

    ['ESTRADA', 'ESTRADA'],
    ['EST', 'ESTRADA'],
    ['EST.', 'ESTRADA'],

    ['VIA', 'VIA'],

    ['PRAÇA', 'PRAÇA'],
    ['PRACA', 'PRAÇA'],
    ['PÇA', 'PRAÇA'],
    ['PCA', 'PRAÇA'],

    ['LARGO', 'LARGO'],

    ['VIELA', 'VIELA'],
    ['PASSAGEM', 'PASSAGEM'],
    ['BECO', 'BECO'],
    ['CONJUNTO', 'CONJUNTO'],
    ['QUADRA', 'QUADRA'],
    ['SETOR', 'SETOR'],
    ['SERVIDÃO', 'SERVIDÃO'],
    ['SERVIDAO', 'SERVIDÃO'],
  ]);

  // split por espaços
  const parts = s.split(/\s+/);
  const firstRaw = parts[0] || '';

  const firstNorm = firstRaw
    .toUpperCase()
    .replace(/\./g, '');

  const mapped = TYPES.get(firstNorm);

  // ✅ Só considera tipo se for conhecido e existir "resto"
  if (mapped && parts.length >= 2) {
    return {
      type: mapped,                 // já normalizado
      name: parts.slice(1).join(' ').trim()
    };
  }

  // Sem tipo conhecido: deixa tudo no nome
  return { type: '', name: s };
}

// ---------------------------------------------------------------------
// CEP / ViaCEP
// ---------------------------------------------------------------------
async function buscarCEP() {
  const cep = onlyDigits(get('postal_code'));
  if (cep.length !== 8) return;

  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d?.erro) throw new Error('CEP não encontrado');

    const logradouro = (d.logradouro || '').trim();

    // ✅ Split seguro (só seta tipo se for reconhecido)
    const { type, name } = splitStreetTypeAndName(logradouro);

    if (type) set('street_type', type);
    else set('street_type', ''); // opcional: limpa se não reconheceu

    set('street_name', name);

    set('neighborhood', d.bairro || '');

    await setUFAndCityFromIbge(d.uf || '', d.localidade || '', { resolveCode: true });
  } catch (e) {
    showCenterModal({ variant: 'warning', title: 'CEP', message: 'Erro ao buscar CEP.' });
  }
}

// ---------------------------------------------------------------------
// Consulta CNPJ (API Pública / Backend CONSART)
// ---------------------------------------------------------------------
async function buscarCNPJ() {
  if (isPF()) {
    return showCenterModal({
      variant: 'warning',
      title: 'Consulta CNPJ',
      message: 'Consulta de CNPJ é apenas para Pessoa Jurídica.'
    });
  }

  const cnpj = getTaxRaw();
  if (cnpj.length !== 14) {
    return showCenterModal({ variant: 'warning', title: 'CNPJ inválido', message: 'Informe 14 dígitos.' });
  }

  const btn = document.getElementById('btnBuscarCNPJ');
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando…'; }

  try {
    const r = await fetch(ROUTES.consultaCnpj(cnpj), { headers: { 'Accept': 'application/json' } });
    const js = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(js?.message || js?.error || `HTTP ${r.status}`);

    const d = js.dados || js.data || js;
    const est = d.estabelecimento || {};

    const razaoSocial =
      d.razao_social ||
      est.razao_social ||
      '';

    const nomeFantasia =
      est.nome_fantasia ||
      d.nome_fantasia ||
      razaoSocial;

    set('trade_name', nomeFantasia);
    set('legal_name', razaoSocial);

    if (est.cep) set('postal_code', String(est.cep).replace(/\D/g, ''));

    set('address_complement', est.complemento || '');
    set('neighborhood', est.bairro || '');

    const cidade = est.cidade || {};
    const estado = est.estado || {};

    await setUFAndCityFromIbge(estado.sigla || '', cidade.nome || '', { resolveCode: true });

    set('email', est.email || '');

    let telefone = '';
    if (est.ddd1 && est.telefone1) telefone = `(${est.ddd1}) ${est.telefone1}`;
    else if (est.telefone1) telefone = est.telefone1;
    set('phone_number', telefone);

    const ieArr = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
    if (ieArr.length > 0) set('state_registration', ieArr[0].inscricao_estadual || '');

    // ================================================================
    // TIPO + NOME DO LOGRADOURO
    // ================================================================

    const streetTypeApi =
      est.tipo_logradouro ||
      est.tipoLogradouro ||
      est.street_type ||
      est.streetType ||
      '';

    const streetFull =
      est.logradouro ||
      est.street ||
      est.endereco ||
      '';

    // Primeiro tenta usar o tipo já vindo da API
    if (streetTypeApi) {
      set('street_type', normalizeStreetType(streetTypeApi));

      // Se logradouro vier sem o tipo, usa direto
      set('street_name', streetFull || '');
    } else {
      // Fallback: tenta separar "RUA BIAS FORTES"
      const {
        type,
        name
      } = splitStreetTypeAndName(streetFull);

      set(
        'street_type',
        type || ''
      );

      set(
        'street_name',
        name || streetFull || ''
      );
    }

    showCenterModal({
      variant: 'success',
      title: 'CNPJ',
      message: 'Dados atualizados a partir da consulta pública.',
      timeoutMs: 1800
    });
  } catch (e) {
    console.error(e);
    showCenterModal({ variant: 'error', title: 'Consulta CNPJ', message: 'Não foi possível consultar o CNPJ.' });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Buscar CNPJ'; }
  }
}

// ---------------------------------------------------------------------
// Máscaras telefone / celular / CEP
// ---------------------------------------------------------------------
function masks() {
  const tel = $('#phone_number');
  const cel = $('#mobile_number');
  const financialTel = $('#financial_contact_phone');
  const financialCel = $('#financial_contact_mobile');
  const cep = $('#postal_code');

  tel?.addEventListener('input', () => {
    tel.value = onlyDigits(tel.value)
      .slice(0, 10)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  });

  cel?.addEventListener('input', () => {
    cel.value = onlyDigits(cel.value)
      .slice(0, 11)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  });

  financialTel?.addEventListener('input', () => {
    financialTel.value = onlyDigits(financialTel.value)
      .slice(0, 10)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  });

  financialCel?.addEventListener('input', () => {
    financialCel.value = onlyDigits(financialCel.value)
      .slice(0, 11)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  });

  cep?.addEventListener('input', () => {
    cep.value = onlyDigits(cep.value)
      .slice(0, 8)
      .replace(/(\d{5})(\d)/, '$1-$2');
  });

  // ✅ Código IBGE só números
  const ibge = $('#ibge_city_code');
  ibge?.addEventListener('input', () => {
    ibge.value = onlyDigits(ibge.value).slice(0, 7);
  });
}
