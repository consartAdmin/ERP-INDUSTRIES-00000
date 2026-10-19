// ╔══════════════════════════════════════════════════════════════════╗
// ║ auth.js — Verificação de login e autenticação JWT (PRODNEX ERP)   ║
// ║ ✅ Protege páginas: valida token, expiração e redireciona p/ login ║
// ║ ✅ Expõe helpers globais: CONSART_AUTH.getToken/getPayload/...      ║
// ║ ✅ Dispatch event: "consart:auth" (status changes)                 ║
// ║ ✅ Evita loop de redirect e trata login page                        ║
// ╚══════════════════════════════════════════════════════════════════╝

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Configurações
  // -------------------------------------------------------------------
  const CFG = {
    redirectLogin: '/public/login/login.html', // Página de login
    checkIntervalMs: 5000,                     // Intervalo de verificação
    debug: true,                               // Logs no console
    tokenKey: 'auth_token',                    // chave no storage
    storage: 'auto',                           // 'auto' | 'local' | 'session'
    graceSeconds: 5,                           // tolerância (clock drift)
  };

  const log = (...a) => { if (CFG.debug) console.log('[Auth]', ...a); };
  const warn = (...a) => { if (CFG.debug) console.warn('[Auth]', ...a); };

  // -------------------------------------------------------------------
  // Utils
  // -------------------------------------------------------------------
  function isLoginPage() {
    try {
      const p = String(window.location.pathname || '');
      return p === CFG.redirectLogin || p.endsWith('/login.html');
    } catch {
      return false;
    }
  }

  function safeAtob(b64) {
    try { return atob(b64); } catch { return null; }
  }

  function normalizeBase64Url(b64url) {
    if (!b64url) return null;
    let s = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
    s = s.padEnd(Math.ceil(s.length / 4) * 4, '=');
    return s;
  }

  // -------------------------------------------------------------------
  // Token / Payload
  // -------------------------------------------------------------------
  function getToken() {
    const k = CFG.tokenKey;

    if (CFG.storage === 'local') return localStorage.getItem(k) || null;
    if (CFG.storage === 'session') return sessionStorage.getItem(k) || null;

    return localStorage.getItem(k) || sessionStorage.getItem(k) || null;
  }

  function setToken(token, where = 'local') {
    const k = CFG.tokenKey;
    const t = token ? String(token) : '';

    // limpa antes para evitar duplicidade
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}

    if (!t) return;

    try {
      if (where === 'session') sessionStorage.setItem(k, t);
      else localStorage.setItem(k, t);
    } catch (e) {
      warn('Falha ao salvar token no storage:', e);
    }
  }

  function clearToken() {
    const k = CFG.tokenKey;
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}
  }

  function parseJwt(token) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length < 2) return null;

      const payloadB64 = normalizeBase64Url(parts[1]);
      if (!payloadB64) return null;

      const json = safeAtob(payloadB64);
      if (!json) return null;

      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function tokenValido(token) {
    if (!token) return false;

    const payload = parseJwt(token);
    if (!payload || !payload.exp) return false;

    const agora = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp);

    if (!Number.isFinite(exp)) return false;

    // tolerância para drift de relógio
    return exp > (agora + Number(CFG.graceSeconds || 0));
  }

  function getUserIdFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    // tenta campos comuns
    const raw =
      payload.user_id ??
      payload.userId ??
      payload.id ??
      payload.uid ??
      null;

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // -------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------
  function emitAuthEvent(detail) {
    try {
      window.dispatchEvent(new CustomEvent('consart:auth', { detail }));
    } catch {}
  }

  // -------------------------------------------------------------------
  // Redirect / Guard
  // -------------------------------------------------------------------
  function redirectLogin(reason = 'invalid_token') {
    if (isLoginPage()) return; // evita loop

    log('Token inválido/ausente. Redirecionando para login...', reason);

    // evita re-redirect repetido
    try {
      const url = new URL(CFG.redirectLogin, window.location.origin);
      url.searchParams.set('next', window.location.pathname + window.location.search);
      url.searchParams.set('reason', reason);
      window.location.href = url.toString();
    } catch {
      window.location.href = CFG.redirectLogin;
    }
  }

  function verificarLogin() {
    const token = getToken();
    const valid = tokenValido(token);

    if (!token || !valid) {
      emitAuthEvent({ ok: false, reason: !token ? 'missing' : 'expired_or_invalid' });
      redirectLogin(!token ? 'missing' : 'expired_or_invalid');
      return;
    }

    const payload = parseJwt(token) || {};
    const userId = getUserIdFromPayload(payload);

    emitAuthEvent({ ok: true, userId, payload });

    // log amigável
    const name = payload.name || payload.nome || payload.username || payload.email || '(sem nome)';
    log('Token válido. Usuário logado:', name, userId ? `(userId=${userId})` : '');
  }

  // -------------------------------------------------------------------
  // Public API (global)
  // -------------------------------------------------------------------
  window.CONSART_AUTH = Object.freeze({
    cfg: CFG,

    // token
    getToken,
    setToken,
    clearToken,

    // payload
    parseJwt,
    tokenValido,
    getPayload: () => parseJwt(getToken()),
    getUserId: () => getUserIdFromPayload(parseJwt(getToken())),

    // helper fetch headers
    getAuthHeaders: (extra = {}) => {
      const token = getToken();
      return {
        ...(extra || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
    },

    // guard
    checkNow: verificarLogin,
    redirectLogin,
  });

  // -------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // na página de login, não forçamos redirect; só expomos helpers
    if (!isLoginPage()) verificarLogin();
  });

  // Opcional: verifica periodicamente (somente fora do login)
  if (!isLoginPage() && Number(CFG.checkIntervalMs) > 0) {
    setInterval(verificarLogin, Number(CFG.checkIntervalMs));
  }

})();
