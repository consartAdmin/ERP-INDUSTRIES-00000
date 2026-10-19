// ============================================================================
// sessionTimeOutConfig.js — gerenciamento de timeout de sessão
// Local: /public/includes/js/sessionTimeOutConfig.js
// ============================================================================

(() => {
  if (window.__CONSART_STO__) return;

  const API = (window.apiBase || '') + '/api/session-config';
  const LS_KEY = 'consart.sessionTimeout.cfg';

  const DEFAULTS = {
    enabled: false,
    idle_minutes: 10,
    warn_seconds: 0,
    silent: true,
    redirect_url: '/public/login/login.html'
  };

  const PATH = (location.pathname || '').toLowerCase();
  const IS_LOGIN =
    PATH.endsWith('/login') ||
    PATH.endsWith('/login/') ||
    PATH.includes('/public/login/login.html');

  const merge = (a, b) => Object.assign({}, a, b || {});
  const safeInt = (v, min = -Infinity) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    const f = Math.floor(n);
    return f >= min ? f : NaN;
  };

  const lsGet = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return { ...DEFAULTS };
      const o = JSON.parse(raw || '{}');
      return merge(DEFAULTS, o);
    } catch {
      return { ...DEFAULTS };
    }
  };
  const lsSet = cfg => { try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch {} };
  const lsClear = () => { try { localStorage.removeItem(LS_KEY); } catch {} };

  let cfg = lsGet();
  let warnTimer = null, logoutTimer = null, tickInt = null, isRedirecting = false;

  const clearTimers = () => {
    if (warnTimer) { clearTimeout(warnTimer); warnTimer = null; }
    if (logoutTimer) { clearTimeout(logoutTimer); logoutTimer = null; }
    if (tickInt) { clearInterval(tickInt); tickInt = null; }
  };

  const showWarn = () => {
    let box = document.getElementById('session-warning');
    if (!box) {
      box = document.createElement('div');
      box.id = 'session-warning';
      box.style.cssText = [
        'position:fixed;right:16px;bottom:16px;z-index:9999',
        'background:#111827;color:#fff;padding:12px 14px',
        'border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.25)',
        'display:flex;gap:10px;align-items:center'
      ].join(';');
      box.innerHTML =
        'Sessão expira em <strong id="sw-ct"></strong>s ' +
        '<button id="sw-stay" class="btn">Continuar</button>';
      document.body.appendChild(box);
      document.getElementById('sw-stay').addEventListener(
        'click',
        () => { hideWarn(); start(); },
        { passive: true }
      );
    }

    let remaining = safeInt(cfg.warn_seconds, 0);
    if (!Number.isFinite(remaining) || remaining < 0) remaining = 0;

    const ct = document.getElementById('sw-ct');
    ct.textContent = String(remaining);

    if (tickInt) { clearInterval(tickInt); tickInt = null; }

    tickInt = setInterval(() => {
      remaining -= 1;
      ct.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) { clearInterval(tickInt); tickInt = null; }
    }, 1000);

    box.style.display = 'flex';
  };

  const hideWarn = () => {
    const box = document.getElementById('session-warning');
    if (box) box.style.display = 'none';
    if (tickInt) { clearInterval(tickInt); tickInt = null; }
  };

  const redirect = () => {
    if (isRedirecting) return;
    isRedirecting = true;
    try { hideWarn(); } catch {}
    const url = cfg.redirect_url || DEFAULTS.redirect_url;
    if (!IS_LOGIN) setTimeout(() => { location.href = url; }, 10);
    else isRedirecting = false;
  };

  const start = () => {
    clearTimers();

    const idleOk = safeInt(cfg.idle_minutes, 1);
    const warnOk = safeInt(cfg.warn_seconds, 0);

    if (!cfg.enabled) return;
    if (!Number.isFinite(idleOk)) return;

    const idleMs = idleOk * 60 * 1000;
    const warnMs = Number.isFinite(warnOk) ? warnOk * 1000 : 0;

    if (warnMs > 0 && !cfg.silent && warnMs < idleMs)
      warnTimer = setTimeout(() => { try { showWarn(); } catch {} }, Math.max(0, idleMs - warnMs));

    logoutTimer = setTimeout(() => { try { if (!cfg.silent) alert('Sessão expirada!'); } catch {} redirect(); }, Math.max(0, idleMs));
  };

  ['click','mousemove','keydown','scroll','touchstart','wheel'].forEach(ev => {
    document.addEventListener(ev, () => start(), { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') start(); });

  window.addEventListener('storage', e => {
    try {
      if (e && (e.key === LS_KEY || e.key == null)) { cfg = lsGet(); start(); }
    } catch (err) { console.warn('[sessionTimeout] storage handler falhou', err); }
  });

  window.__CONSART_STO__ = {
    get cfg() { return cfg; },
    disable() { cfg.enabled = false; lsSet(cfg); clearTimers(); hideWarn(); },
    enable(mins = 10) { cfg.enabled = true; cfg.idle_minutes = safeInt(mins, 1); lsSet(cfg); start(); },
    clearLS() { lsClear(); }
  };

  if (IS_LOGIN) return;

  (async () => {
    try {
      const r = await fetch(API, { credentials: 'include' });
      if (r.ok) {
        const s = await r.json();
        const merged = merge(DEFAULTS, {
          enabled: !!s.enabled,
          idle_minutes: safeInt(s.idle_minutes, 1),
          warn_seconds: safeInt(s.warn_seconds, 0),
          silent: !!s.silent,
          redirect_url: s.redirect_url || DEFAULTS.redirect_url
        });
        cfg = merge(DEFAULTS, merged);
        lsSet(cfg);
      }
    } catch (e) { console.warn('[sessionTimeout] erro buscando configuração:', e?.message || e); }
    if (!cfg.enabled) return;
    start();
  })();
})();
