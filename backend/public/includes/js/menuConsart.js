// menuConsart.js — Menu Global PRODNEX ERP (ESM)
// Busca mostra somente links existentes e não bloqueados no menu.
// O script de permissões deve marcar links bloqueados com hidden=true,
// style.display='none' ou class='modulo-bloqueado'.
// Itens com `feature` ficam ocultos quando a appFeature correspondente está desativada.

import { initProductLocationsFeature } from './productLocationsFeature.js';

// O menu vem da tabela public."moduleSystem" (tela "Criação de Módulos").
// Formato de cada item: { type: 'dropdown'|'submenu'|'link', id, htmlId,
// label, href, className, feature, external, children }.
// id = id do módulo (userModules); itens públicos vêm com id null.
const MENU_API_URL = '/api/module-system/menu';
const MENU_CACHE_KEY = 'consart:menu-config';

let MENU_CONFIG = [];

function readMenuCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY) || 'null');
    return Array.isArray(cached) ? cached : null;
  } catch {
    return null;
  }
}

function writeMenuCache(menu) {
  try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menu)); } catch { }
}

// Busca o menu na API; se a API falhar, usa a última versão salva no navegador.
async function loadMenuConfig() {
  try {
    const response = await fetch(MENU_API_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false || !Array.isArray(payload.data)) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    writeMenuCache(payload.data);
    return payload.data;
  } catch (error) {
    const cached = readMenuCache();
    console.warn('[MENU] Falha ao carregar o menu da API' +
      (cached ? '; usando a última versão salva.' : '.'), error);
    return cached || [];
  }
}

function createLink(item, extraClass = '') {
  const a = document.createElement('a');
  a.textContent = item.label;
  a.href = (item.href || '#').trim();
  if (item.id != null) a.dataset.moduloId = String(item.id);
  if (item.feature) a.dataset.feature = item.feature;
  if (extraClass) a.classList.add(extraClass);
  if (item.external) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = 'Suporte via WhatsApp: (31) 9 8923-0220';
  }
  return a;
}

function createSubmenu(item) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('dropdown-submenu');
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = item.label;
  const content = document.createElement('div');
  content.classList.add('dropdown-submenu-content');
  (item.children || []).forEach(child => content.appendChild(createLink(child)));
  wrapper.append(link, content);
  let openTimeout;
  let closeTimeout;
  wrapper.addEventListener('mouseenter', () => {
    clearTimeout(closeTimeout);
    openTimeout = setTimeout(() => {
      content.classList.add('open');
      const rect = content.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        content.style.left = 'auto';
        content.style.right = '100%';
      }
    }, 120);
  });
  wrapper.addEventListener('mouseleave', () => {
    clearTimeout(openTimeout);
    closeTimeout = setTimeout(() => content.classList.remove('open'), 220);
  });
  return wrapper;
}

function createDropdown(item) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('dropdown');
  if (item.id != null) wrapper.dataset.moduloId = String(item.id);
  if (item.htmlId) wrapper.id = item.htmlId;
  const btn = document.createElement('div');
  btn.classList.add('menu-item');
  btn.textContent = item.label;
  const content = document.createElement('div');
  content.classList.add('dropdown-content');
  (item.children || []).forEach(child => {
    if (child.type === 'submenu') content.appendChild(createSubmenu(child));
    else if (child.type === 'link') content.appendChild(createLink(child));
  });
  wrapper.append(btn, content);
  let openTimeout;
  let closeTimeout;
  wrapper.addEventListener('mouseenter', () => {
    clearTimeout(closeTimeout);
    openTimeout = setTimeout(() => {
      content.classList.add('open');
      const rect = content.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        content.style.left = 'auto';
        content.style.right = '0';
      }
    }, 120);
  });
  wrapper.addEventListener('mouseleave', () => {
    clearTimeout(openTimeout);
    closeTimeout = setTimeout(() => content.classList.remove('open'), 220);
  });
  return wrapper;
}

function flattenMenu(items, parentPath = '') {
  return items.flatMap(item => {
    const path = parentPath ? `${parentPath} › ${item.label}` : item.label;
    const current = item.type === 'link' ? [{
      id: item.id != null ? String(item.id) : null, label: item.label, href: item.href.trim(), path,
    }] : [];
    return item.children ? current.concat(flattenMenu(item.children, path)) : current;
  });
}

function mountMenuSearch(menuElement) {
  const searchWrapper = document.createElement('div');
  searchWrapper.classList.add('menu-search-wrapper');
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = '🔍 Buscar módulos...';
  input.classList.add('menu-search-input');
  input.autocomplete = 'off';
  const resultsBox = document.createElement('div');
  resultsBox.classList.add('menu-search-results');
  resultsBox.hidden = true;
  const flatIndex = flattenMenu(MENU_CONFIG);
  let activeIndex = -1;
  let currentResults = [];

  // Não usa getClientRects/offsetParent: dropdown fechado não significa bloqueado.
  function moduloEstaLiberado(moduloId, href) {
    const links = menuElement.querySelectorAll('a[data-modulo-id]');
    return Array.from(links).some(link => {
      if (link.dataset.moduloId !== String(moduloId)) return false;
      if (href && link.getAttribute('href')?.trim() !== href.trim()) return false;
      const style = getComputedStyle(link);
      return link.isConnected && !link.hidden &&
        link.style.display !== 'none' && style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !link.classList.contains('modulo-bloqueado');
    });
  }

  const closeResults = () => {
    resultsBox.hidden = true;
    resultsBox.replaceChildren();
    activeIndex = -1;
    currentResults = [];
  };
  const setActive = index => {
    const rows = [...resultsBox.querySelectorAll('.menu-search-item')];
    rows.forEach(row => row.classList.remove('active'));
    if (rows[index]) {
      rows[index].classList.add('active');
      rows[index].scrollIntoView({ block: 'nearest' });
    }
  };
  const goToActive = () => {
    const item = currentResults[activeIndex];
    if (item?.href) location.assign(item.href);
  };

  input.addEventListener('input', () => {
    const value = input.value.trim().toLocaleLowerCase('pt-BR');
    if (!value) return closeResults();
    currentResults = flatIndex.filter(item => {
      const match = item.label.toLocaleLowerCase('pt-BR').includes(value) ||
        item.path.toLocaleLowerCase('pt-BR').includes(value);
      return match && moduloEstaLiberado(item.id, item.href);
    }).slice(0, 12);
    resultsBox.replaceChildren();
    activeIndex = -1;
    if (!currentResults.length) {
      const empty = document.createElement('div');
      empty.classList.add('no-results');
      empty.textContent = 'Nenhum módulo encontrado';
      resultsBox.appendChild(empty);
    } else {
      currentResults.forEach((item, index) => {
        const row = document.createElement('div');
        row.classList.add('menu-search-item');
        row.textContent = item.path;
        row.tabIndex = 0;
        row.addEventListener('mouseenter', () => {
          activeIndex = index;
          setActive(index);
        });
        row.addEventListener('click', () => location.assign(item.href));
        resultsBox.appendChild(row);
      });
    }
    resultsBox.hidden = false;
  });

  input.addEventListener('keydown', event => {
    const count = resultsBox.querySelectorAll('.menu-search-item').length;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeResults();
      input.blur();
      return;
    }
    if (!count) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % count;
      setActive(activeIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + count) % count;
      setActive(activeIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goToActive();
    }
  });

  document.addEventListener('click', event => {
    if (!searchWrapper.contains(event.target)) closeResults();
  });
  searchWrapper.append(input, resultsBox);
  menuElement.prepend(searchWrapper);
}

let menuBuildStarted = false;

async function buildMenuPrincipal() {
  if (menuBuildStarted || document.querySelector('.menu-principal')) return;
  menuBuildStarted = true;
  MENU_CONFIG = await loadMenuConfig();
  const menu = document.createElement('div');
  menu.classList.add('menu-principal');
  Object.assign(menu.style, {
    height: 'auto', minHeight: '0', bottom: 'auto', pointerEvents: 'none',
  });
  mountMenuSearch(menu);
  MENU_CONFIG.forEach(item => {
    if (item.type === 'link') menu.appendChild(createLink(item, item.className || ''));
    else if (item.type === 'dropdown') menu.appendChild(createDropdown(item));
  });
  [...menu.children].forEach(child => { child.style.pointerEvents = 'auto'; });
  const mount = document.getElementById('menuConsartMount') ||
    document.getElementById('menu-consart-mount');
  if (mount) mount.appendChild(menu);
  else document.body.prepend(menu);

  // appFeature PRODUCT_LOCATIONS: LOCATIONS_DISABLED → oculta os links de localização
  initProductLocationsFeature({ root: menu }).catch(() => { });

  // Dispara somente depois que todos os links existem no DOM.
  try {
    window.CONSART_MENU_CONFIG = MENU_CONFIG;
    window.dispatchEvent(new CustomEvent('consart:menu-ready', {
      detail: { MENU_CONFIG, menuElement: menu },
    }));
  } catch (error) {
    console.warn('[MENU] Não foi possível emitir consart:menu-ready:', error);
  }
  console.log('[MENU] Menu principal gerado e fixado no topo.');
}

function initMenuConsart() {
  buildMenuPrincipal()
    .catch(error => console.error('[MENU] Erro ao montar menu:', error));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMenuConsart, { once: true });
} else {
  initMenuConsart();
}
