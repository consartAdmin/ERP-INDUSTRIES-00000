// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ labels.utils.js — Base da API (mutável), toParams e request             ║
// ║ - Uses apiBase.js (window.apiBase / getApiBase) when available          ║
// ║ - Standard response: { ok, data, error, status }                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

// 🌐 Default base (fallback — real base comes from apiBase.js in browser)
// Obs.: apiBase e setApiBase ficam no mesmo arquivo (binding ESM mutável).
export let apiBase = 'http://localhost:8080';

/**
 * Resolves API base in this order:
 *  1) window.apiBase (set by apiBase.js)
 *  2) window.getApiBase() if available
 *  3) local variable apiBase
 *  4) hard fallback 'http://localhost:8080'
 */
function getBase() {
  let base = null;

  if (typeof window !== 'undefined') {
    if (window.apiBase) {
      base = window.apiBase;
    } else if (typeof window.getApiBase === 'function') {
      try {
        base = window.getApiBase();
      } catch (err) {
        console.error('[labelsApi] Error calling window.getApiBase:', err);
      }
    }
  }

  if (!base) {
    base = apiBase || 'http://localhost:8080';
  }

  return base.toString().replace(/\/+$/, ''); // remove trailing slashes
}

// Allows runtime override via script or E2E tests (Node, etc.)
export function setApiBase(base) {
  apiBase = (base || '').toString().replace(/\/+$/, '');
}

// Base path for this module
export function labelsBase() {
  return `${getBase()}/api/labels`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Utils
────────────────────────────────────────────────────────────────────────── */

export const toParams = (obj = {}) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

export async function request(url, { method = 'GET', body, headers } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json?.ok === false) {
      const msg =
        json?.error ||
        json?.message ||
        `HTTP ${res.status} - ${res.statusText}`;

      return {
        ok: false,
        error: msg,
        status: res.status,
        data: json?.data ?? null,
      };
    }

    return {
      ok: true,
      data: json?.data ?? json,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Network error',
      status: 0,
      data: null,
    };
  }
}
