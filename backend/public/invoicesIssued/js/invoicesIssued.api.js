// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.api.js — Comunicação com backend                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { API_BASE, NFE_STATUS_API_BASE } from './invoicesIssued.config.js';
import { extractAlerts } from './invoicesIssued.utils.js';

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      data = null,
      alerts = [],
    } = {},
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.alerts = alerts;
  }
}

// ======================================================================
// AUTH TOKEN
// ======================================================================

function getAuthToken() {
  const candidates = [
    localStorage.getItem('auth_token'),
    localStorage.getItem('token'),
    sessionStorage.getItem('auth_token'),
    sessionStorage.getItem('token'),
  ];

  for (const value of candidates) {
    const token = String(value || '').trim();

    if (token) {
      return token;
    }
  }

  return null;
}

// ======================================================================
// API FETCH
// ======================================================================

export async function apiFetch(
  url,
  options = {},
) {
  const token = getAuthToken();

  const res = await fetch(url, {
    credentials: 'include',

    ...options,

    headers: {
      'Content-Type': 'application/json',

      ...(token
        ? {
          Authorization: `Bearer ${token}`,
        }
        : {}),

      ...(options.headers || {}),
    },
  });

  const rawText = await res.text();

  let data = {};

  try {
    data = rawText
      ? JSON.parse(rawText)
      : {};
  } catch {
    data = rawText
      ? { message: rawText }
      : {};
  }

  if (!res.ok || data?.ok === false) {
    const alerts = extractAlerts(
      data,
      {
        includeRoot: true,
      },
    );

    throw new ApiError(
      alerts[0]?.message ||
      data?.message ||
      data?.error ||
      `Erro HTTP ${res.status}`,
      {
        status: res.status,
        data,
        alerts,
      },
    );
  }

  return data;
}

// ======================================================================
// INVOICES
// ======================================================================

export async function listInvoices(
  queryString,
) {
  return apiFetch(
    `${API_BASE}?${queryString}`,
  );
}

export async function getInvoiceById(
  id,
) {
  return apiFetch(
    `${API_BASE}/${id}`,
  );
}

export async function createInvoice(
  payload,
) {
  return apiFetch(
    API_BASE,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function updateInvoice(
  id,
  payload,
) {
  return apiFetch(
    `${API_BASE}/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function syncInvoicesIssued() {
  return apiFetch(
    `${API_BASE}/sync-faturadas`,
    {
      method: 'POST',
    },
  );
}

// ======================================================================
// NF-e STATUS MAP
// ======================================================================

export async function listNfeStatusMap({ activeOnly = true } = {}) {
  const params = new URLSearchParams({
    activeOnly: activeOnly ? 'true' : 'false',
  });

  return apiFetch(
    `${NFE_STATUS_API_BASE}?${params.toString()}`,
  );
}

export async function syncInvoiceFromOrder(orderId) {
  return apiFetch(
    `${API_BASE}/sync-from-order/${encodeURIComponent(orderId)}`,
    { method: 'POST' },
  );
}

export async function refreshBudgetNfeStatus(budgetId) {
  return apiFetch(
    `/api/budgets-issued/${encodeURIComponent(budgetId)}/status`,
  );
}

export async function getInvoicesKpis({ dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();

  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const qs = params.toString();

  return apiFetch(
    `${API_BASE}/kpis${qs ? `?${qs}` : ''}`
  );
}