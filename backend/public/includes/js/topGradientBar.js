// ╔════════════════════════════════════════════════════════════╗
// ║ topGradientBar.js — CONSART                                ║
// ║ Injeta barra superior e resolve título via MENU_CONFIG      ║
// ║ (espera menu/header existir para inserir no lugar certo)    ║
// ╚════════════════════════════════════════════════════════════╝

const HEADER_SELECTORS = ['.app-header', '.topbar', '.c-header', 'header'];
const MENU_SELECTORS = ['.menu-principal', '.consart-menu', '#menuConsart'];

function $(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function stripEmojiAndArrows(label = '') {
  return String(label)
    .replace(/^[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu, '')
    .replace(/[▼▾▸▹›»]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveHrefToPathname(href) {
  try { return new URL(href, window.location.href).pathname; } catch { return ''; }
}
function normalizePath(p = '') {
  return String(p).replace(/\\/g, '/').replace(/\/{2,}/g, '/').trim();
}

function flattenMenu(items, parentTrail = []) {
  let out = [];
  for (const item of items || []) {
    const labelClean = stripEmojiAndArrows(item.label || '');
    const trail = labelClean ? [...parentTrail, labelClean] : [...parentTrail];

    if (item.type === 'link' && item.href) {
      out.push({
        id: item.id,
        labelClean,
        href: item.href,
        pathname: normalizePath(resolveHrefToPathname(item.href)),
        trail
      });
    }
    if (item.children?.length) out = out.concat(flattenMenu(item.children, trail));
  }
  return out;
}

function bestMatchByLocation(flatLinks) {
  const currentPath = normalizePath(window.location.pathname);

  let match = flatLinks.find((x) => x.pathname === currentPath);
  if (match) return match;

  match = flatLinks.find((x) => {
    const a = x.pathname || '';
    const b = currentPath || '';
    return a && b && (b.endsWith(a) || a.endsWith(b));
  });
  if (match) return match;

  const file = currentPath.split('/').filter(Boolean).pop() || '';
  if (file) {
    match = flatLinks.find((x) => (x.pathname || '').split('/').pop() === file);
    if (match) return match;
  }
  return null;
}

function autoResolveBarFromMenuConfig(menuConfig) {
  const flat = flattenMenu(menuConfig);
  const match = bestMatchByLocation(flat);
  if (!match) return null;

  const title = match.labelClean || '(Sem título)';
  const subtitle = match.trail.join(' › ');
  const tag =
    match.id != null
      ? String(match.id)
      : (match.pathname.split('/').pop() || '').replace(/\.html$/i, '');

  return { title, subtitle, tag };
}

export function initTopGradientBar({ title = '', subtitle = '', tag = '' } = {}) {
  if (document.querySelector('.c-page-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'c-page-bar c-page-bar--full-bleed';

  bar.innerHTML = `
    <div class="c-page-bar__inner">
      <div class="c-page-bar__left">
        <div class="c-page-bar__pill">
          ${title ? `<span class="c-page-bar__pill-text">${title}</span>` : ''}
        </div>
        ${subtitle ? `<div class="c-page-bar__subtitle">${subtitle}</div>` : ''}
      </div>
      <div class="c-page-bar__right">
        ${tag ? `<span class="c-page-bar__tag">${tag}</span>` : ''}
      </div>
    </div>
  `;

  // ✅ prioridade: depois do menu
  const menu = $(MENU_SELECTORS);
  if (menu && menu.parentNode) {
    menu.insertAdjacentElement('afterend', bar);
    return;
  }

  // fallback: depois do header
  const header = $(HEADER_SELECTORS);
  if (header && header.parentNode) {
    header.insertAdjacentElement('afterend', bar);
    return;
  }

  // fallback final
  document.body.prepend(bar);
}

function resolveAndInit() {
  // 1) dataset manual (compat)
  const body = document.body;
  if (body?.dataset?.pageBarTitle) {
    initTopGradientBar({
      title: body.dataset.pageBarTitle || '',
      subtitle: body.dataset.pageBarSubtitle || '',
      tag: body.dataset.pageBarTag || ''
    });
    return;
  }

  // 2) via MENU_CONFIG exposto
  const menuConfig = window.CONSART_MENU_CONFIG || window.MENU_CONFIG || null;
  if (Array.isArray(menuConfig) && menuConfig.length) {
    const resolved = autoResolveBarFromMenuConfig(menuConfig);
    if (resolved?.title) {
      initTopGradientBar(resolved);
      return;
    }
  }

  // 3) fallback por <title>
  const docTitle = (document.title || '').trim();
  const clean = docTitle.replace(/\s*\|\s*CONSART.*$/i, '').trim();
  if (clean) initTopGradientBar({ title: clean });
}

function waitForMenuOrHeaderThenInit() {
  // se já tem menu/header, manda ver
  if ($(MENU_SELECTORS) || $(HEADER_SELECTORS)) {
    resolveAndInit();
    return;
  }

  // espera aparecer menu/header
  const obs = new MutationObserver(() => {
    if ($(MENU_SELECTORS) || $(HEADER_SELECTORS)) {
      obs.disconnect();
      resolveAndInit();
    }
  });

  obs.observe(document.documentElement, { childList: true, subtree: true });

  // safety: mesmo que não apareça nada, tenta depois de um tempo
  setTimeout(() => {
    try { obs.disconnect(); } catch {}
    resolveAndInit();
  }, 1500);

  // se o menu disparar evento, pega também
  window.addEventListener(
    'consart:menu-ready',
    () => {
      resolveAndInit();
    },
    { once: true }
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForMenuOrHeaderThenInit);
} else {
  waitForMenuOrHeaderThenInit();
}
