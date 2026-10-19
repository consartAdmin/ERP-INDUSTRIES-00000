// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.infra.js — Infra (toast/auth/fetch/crash)           ║
// ║ PRODNEX ERP                                                 ║
// ║ ✅ Toast centralizado                                       ║
// ║ ✅ JWT / autenticação                                       ║
// ║ ✅ Fetch seguro                                             ║
// ║ ✅ Cache busting                                            ║
// ║ ✅ Tratamento de sessão expirada                            ║
// ║ ✅ Tratamento global de erros                               ║
// ║ ✅ Compatível com App Features                              ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import {
  showCenterModal,
} from '/public/includes/js/centerAlertModal.js';

/* ============================================================
   TOAST / MODAIS
============================================================ */

export const toast = {
  info: (
    title,
    message,
    ms = 3800
  ) => showCenterModal({
    variant: 'info',
    title,
    message,
    timeoutMs: ms,
  }),

  success: (
    title,
    message,
    ms = 4200
  ) => showCenterModal({
    variant: 'success',
    title,
    message,
    timeoutMs: ms,
  }),

  warn: (
    title,
    message
  ) => showCenterModal({
    variant: 'warning',
    title,
    message,
  }),

  error: (
    title,
    message
  ) => showCenterModal({
    variant: 'error',
    title,
    message,
  }),
};

/* ============================================================
   LOGIN
============================================================ */

// Ajuste somente se o caminho de login mudar.
export const LOGIN_URL =
  '/login.html';

/* ============================================================
   AUTH TOKEN
============================================================ */

export function getAuthToken() {
  const candidates = [
    () => localStorage.getItem('token'),
    () => localStorage.getItem('access_token'),
    () => localStorage.getItem('accessToken'),
    () => localStorage.getItem('jwt'),
    () => localStorage.getItem('auth_token'),
    () => localStorage.getItem('consart_token'),

    () => sessionStorage.getItem('token'),
    () => sessionStorage.getItem('access_token'),
    () => sessionStorage.getItem('accessToken'),
  ];

  for (const fn of candidates) {
    try {
      const value =
        fn();

      if (
        value &&
        String(value)
          .trim()
          .length > 20
      ) {
        return String(value)
          .trim();
      }
    } catch {
      // Ignora storage indisponível.
    }
  }

  /*
   * Alguns fluxos antigos armazenam autenticação
   * dentro de objetos JSON.
   */
  const jsonKeys = [
    'user',
    'auth',
    'session',
  ];

  for (const key of jsonKeys) {
    try {
      const raw =
        localStorage.getItem(key) ||
        sessionStorage.getItem(key);

      if (!raw) {
        continue;
      }

      const obj =
        JSON.parse(raw);

      const token =
        obj?.token ||
        obj?.access_token ||
        obj?.accessToken;

      if (
        token &&
        String(token)
          .trim()
          .length > 20
      ) {
        return String(token)
          .trim();
      }
    } catch {
      // JSON inválido ou storage indisponível.
    }
  }

  return null;
}

/* ============================================================
   AUTH HEADERS
============================================================ */

export function authHeaders(
  extra = {}
) {
  const token =
    getAuthToken();

  const headers = {
    Accept:
      'application/json',

    ...extra,
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  return headers;
}

/* ============================================================
   AUTH FAILURE
============================================================ */

let __authFailLock =
  false;

function clearStoredAuthentication() {
  try {
    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'access_token'
    );

    localStorage.removeItem(
      'accessToken'
    );

    localStorage.removeItem(
      'jwt'
    );

    localStorage.removeItem(
      'auth_token'
    );

    localStorage.removeItem(
      'consart_token'
    );

    sessionStorage.removeItem(
      'token'
    );

    sessionStorage.removeItem(
      'access_token'
    );

    sessionStorage.removeItem(
      'accessToken'
    );
  } catch {
    // Storage pode estar indisponível.
  }
}

export function handleAuthFail(
  status,
  bodyText = ''
) {
  /*
   * Sessão expirada / não autenticada.
   */
  if (status === 401) {
    if (__authFailLock) {
      return true;
    }

    __authFailLock =
      true;

    clearStoredAuthentication();

    showCenterModal({
      variant:
        'warning',

      title:
        'Sessão expirada',

      message:
        'Faça login novamente para continuar.',

      buttons: [
        {
          label:
            'Ir para Login',

          variant:
            'primary',

          action: () => {
            window.location.href =
              LOGIN_URL;
          },
        },
      ],
    });

    setTimeout(() => {
      if (
        document.visibilityState !==
        'hidden'
      ) {
        try {
          window.location.href =
            LOGIN_URL;
        } catch {
          // Ignora erro de navegação.
        }
      }
    }, 2500);

    return true;
  }

  /*
   * Erro interno do backend.
   */
  if (status >= 500) {
    toast.error(
      'Servidor',

      bodyText
        ? bodyText.slice(
          0,
          220
        )
        : 'Erro interno no servidor.'
    );

    return true;
  }

  return false;
}

/* ============================================================
   FETCH SAFE
============================================================ */

/**
 * Wrapper padrão de fetch do módulo Budgets.
 *
 * Retorna:
 *
 * {
 *   ok,
 *   status,
 *   res,
 *   text,
 *   json
 * }
 *
 * Compatível também com:
 *
 * /api/app-features/:featureCode/resolve
 *
 * Exemplo:
 *
 * const out = await fetchSafe(
 *   ROUTES.nfeIssuanceSource,
 *   {
 *     method: 'GET',
 *     headers: authHeaders(),
 *     cache: 'no-store',
 *   }
 * );
 */
export async function fetchSafe(
  url,
  opts = {}
) {
  const mergedHeaders = {
    Accept:
      'application/json',

    'Cache-Control':
      'no-store, no-cache, must-revalidate, proxy-revalidate',

    Pragma:
      'no-cache',

    ...(opts.headers || {}),
  };

  const headers =
    authHeaders(
      mergedHeaders
    );

  /*
   * Permite receber:
   *
   * /api/...
   *
   * ou URL absoluta.
   */
  const requestUrl =
    new URL(
      url,
      window.location.origin
    );

  /*
   * Cache-buster.
   *
   * Importante principalmente para App Features,
   * porque uma alteração no banco deve refletir
   * imediatamente ao recarregar a página.
   */
  requestUrl.searchParams.set(
    '_ts',
    String(Date.now())
  );

  const response =
    await fetch(
      requestUrl.toString(),
      {
        cache:
          'no-store',

        credentials:
          'include',

        ...opts,

        headers,
      }
    );

  const text =
    await response
      .text()
      .catch(() => '');

  let json =
    null;

  if (text) {
    try {
      json =
        JSON.parse(text);
    } catch {
      json =
        null;
    }
  }

  return {
    ok:
      response.ok,

    status:
      response.status,

    res:
      response,

    text,

    json,
  };
}

/* ============================================================
   GLOBAL CRASH HANDLERS
============================================================ */

export function installGlobalCrashHandlers() {
  /*
   * JavaScript runtime error.
   */
  window.addEventListener(
    'error',
    (event) => {
      try {
        console.error(
          '[budgets][error]',
          event?.error ||
          event?.message ||
          event
        );

        toast.error(
          'Erro na tela',
          String(
            event?.error?.message ||
            event?.message ||
            'Falha inesperada.'
          )
        );
      } catch {
        // Nunca deixar o próprio handler quebrar a tela.
      }
    }
  );

  /*
   * Promise rejeitada sem catch.
   */
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      try {
        console.error(
          '[budgets][unhandledrejection]',
          event?.reason ||
          event
        );

        toast.error(
          'Erro inesperado',
          String(
            event?.reason?.message ||
            event?.reason ||
            'Promise rejeitada.'
          )
        );
      } catch {
        // Nunca deixar o próprio handler quebrar a tela.
      }
    }
  );
}