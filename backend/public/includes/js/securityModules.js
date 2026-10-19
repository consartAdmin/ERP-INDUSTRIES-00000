// ============================================================================
// securityModules.js — controle de permissões por módulo (versão reforçada)
// Local: /public/includes/js/securityModules.js
// ============================================================================
// CONFIGURAÇÃO OPCIONAL (antes do script):
// window.SecurityModulesConfig = {
//   debug: true,
//   failOpen: true,
//   fetchCredentials: 'include' // 'same-origin' ou 'include'
// };
// ============================================================================
(function () {
  const CFG = Object.assign({
    failOpen: false,
    scope: 'body',
    groupSelector: '.dropdown',
    itemSelector: '[data-modulo-id]',
    debug: false,
    retryOnFailMs: 800,
    retryCount: 1,
    fetchCredentials: 'same-origin'
  }, window.SecurityModulesConfig || {});

  const log  = (...a) => { if (CFG.debug) console.log('[SecurityModules]', ...a); };
  const warn = (...a) => { if (CFG.debug) console.warn('[SecurityModules]', ...a); };
  const err  = (...a) => console.error('[SecurityModules]', ...a);

  const state = { allow: new Set(), inited: false, lastData: null, mo: null };

  async function safeFetchJson(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        credentials: CFG.fetchCredentials,
        ...options
      });

      const meta = {
        url,
        ok: res.ok,
        status: res.status,
        ct: res.headers.get('content-type')
      };

      if (!res.ok) {
        const txt = await safeReadText(res);
        err('HTTP error', meta, txt?.slice?.(0, 400) || txt);
        return { ok: false, status: res.status, bodyText: txt, meta };
      }

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) {
        const txt = await safeReadText(res);
        err('Non-JSON response', meta, txt?.slice?.(0, 400) || txt);
        return { ok: false, status: res.status, bodyText: txt, meta };
      }

      const json = await res.json();
      return { ok: true, data: json, meta };
    } catch (e) {
      err('Fetch failed', url, e?.message || e);
      return { ok: false, error: e?.message || String(e), url };
    }
  }

  async function safeReadText(res) {
    try { return await res.text(); } catch { return null; }
  }

  // 🔑 Lê o ID do usuário a partir do JWT salvo pelo login (auth_token)
  function getUsuarioIdDoToken() {
    const token =
    localStorage.getItem('auth_token')  || sessionStorage.getItem('auth_token') ||
    localStorage.getItem('token')       || sessionStorage.getItem('token');
    if (!token) {
      warn('Token JWT não encontrado no localStorage/sessionStorage.');
      return null;
    }
    try {
      const payload = token.split('.')[1] || '';
      const base64 = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const p = JSON.parse(atob(base64));
      return p.id ?? p.user_id ?? p.sub ?? null;
    } catch (e) {
      err('Falha ao decodificar token JWT:', e?.message || e);
      return null;
    }
  }

  // 🔗 Carrega permissões da API (tenta duas rotas para compatibilidade)
  async function carregarPermissoes(usuarioId) {
    const urls = [
      `/api/user-modules/${encodeURIComponent(usuarioId)}/modulos`, // snake / hifen
      `/api/userModules/${encodeURIComponent(usuarioId)}/modulos`   // camelCase
    ];

    let lastError = null;

    for (const url of urls) {
      const r = await safeFetchJson(url);
      if (r.ok) {
        log('Permissões carregadas de', url, r.meta);
        return r.data;
      }
      lastError = r;
      warn('Falha ao carregar permissões em', url, r.status || r.error);
    }

    warn('Nenhuma rota de permissões respondeu com sucesso.', lastError);
    return null;
  }

  /**
   * Normaliza payload em um Set de códigos de módulos permitidos.
   * Importante: usamos **modulo_id** (código do módulo de negócio),
   * e não o id da linha em userModules.
   */
  function normalizarParaSet(payload) {
    let itens = [];

    if (Array.isArray(payload)) {
      itens = payload;
    } else if (payload) {
      // tentativas mais comuns
      if (Array.isArray(payload.rows)) itens = payload.rows;
      else if (Array.isArray(payload.data)) itens = payload.data;
      else if (payload.data && Array.isArray(payload.data.rows)) itens = payload.data.rows;
      else if (payload.data && Array.isArray(payload.data.modulos)) itens = payload.data.modulos;
      else if (Array.isArray(payload.modulos)) itens = payload.modulos;
    }

    const allow = new Set();

    itens.forEach(it => {
      // 🔑 prioriza sempre o código do módulo (modulo_id, codigo, etc.)
      const modCode = (
        it.modulo_id ??
        it.module_id ??
        it.moduloId ??
        it.moduleId ??
        it.codigo ??
        it.code ??
        it.module_code
      );
      const id = modCode != null ? String(modCode) : '';

      // Flag de permissão: assume true se não vier nada (API já filtrada)
      const flag = (
        it.permitido ??
        it.pode_acessar ??
        it.canAccess ??
        it.can_access ??
        true
      );

      if (id && flag) {
        allow.add(id);
      }
    });

    log('normalizarParaSet → allow:', Array.from(allow));
    return allow;
  }

  function aplicarNoEscopo(root) {
    try {
      // Esconde/mostra itens individuais
      root.querySelectorAll(CFG.itemSelector).forEach(el => {
        const id = String(el.getAttribute('data-modulo-id') || '');
        if (!id) return;
        const visivel = state.allow.has(id) || CFG.failOpen;
        el.style.display = visivel ? '' : 'none';
        el.toggleAttribute('data-bloqueado', !visivel);
      });

      // Esconde dropdowns vazios
      root.querySelectorAll(CFG.groupSelector).forEach(drop => {
        const filhos = Array.from(drop.querySelectorAll(CFG.itemSelector));
        if (!filhos.length) return;
        const temVisivel = filhos.some(el => el.style.display !== 'none');
        drop.style.display = temVisivel ? '' : 'none';
      });
    } catch (e) {
      warn('aplicarNoEscopo falhou:', e?.message);
    }
  }

  function aplicarPermissoesDoUsuario(data, root) {
    state.lastData = data;
    state.allow = normalizarParaSet(data);
    aplicarNoEscopo(root);
    document.dispatchEvent(new CustomEvent('securitymodules:applied', {
      detail: { allow: new Set(state.allow) }
    }));
    log('Permissões aplicadas:', Array.from(state.allow));
  }

  function getScopeRoot() {
    return document.querySelector(CFG.scope) || document.body;
  }

  async function init() {
    if (state.inited) return;
    state.inited = true;
    const root = getScopeRoot();
    let attempts = 0;

    while (attempts <= CFG.retryCount) {
      attempts++;
      try {
        const usuarioId = getUsuarioIdDoToken();
        if (!usuarioId && !CFG.failOpen) {
          err('Nenhum usuário logado detectado e failOpen está desativado.');
          break;
        }

        log('Carregando permissões para usuário', usuarioId ?? 'default/failOpen');
        const permissoes = usuarioId ? await carregarPermissoes(usuarioId) : null;

        if (permissoes) {
          aplicarPermissoesDoUsuario(permissoes, root);
          break;
        } else {
          warn('Permissões vazias. Tentativa', attempts);
          if (attempts <= CFG.retryCount) {
            await new Promise(r => setTimeout(r, CFG.retryOnFailMs));
          }
        }
      } catch (e) {
        err('Erro ao aplicar permissões:', e?.message || e);
      }
    }

    if (!state.lastData && CFG.failOpen) {
      // não carregou nada, mas failOpen=true → deixa tudo visível
      aplicarNoEscopo(root);
    }

    // Observa elementos adicionados dinamicamente
    try {
      state.mo = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) aplicarNoEscopo(n);
          }
        }
      });
      state.mo.observe(root, { childList: true, subtree: true });
    } catch (e) {
      warn('MutationObserver não iniciado:', e?.message);
    }

    // API global para debug/manual
    window.SecurityModules = {
      has: code => state.allow.has(String(code)),
      apply: node => aplicarNoEscopo(node || getScopeRoot()),
      refresh: async () => {
        const usuarioId = getUsuarioIdDoToken();
        const permissoes = usuarioId ? await carregarPermissoes(usuarioId) : null;
        if (permissoes) aplicarPermissoesDoUsuario(permissoes, getScopeRoot());
      },
      last: () => state.lastData,
      allowSet: () => new Set(state.allow)
    };

    log('✅ SecurityModules inicializado.');
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
})();
