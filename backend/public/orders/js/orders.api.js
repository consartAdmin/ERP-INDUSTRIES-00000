'use strict';

// ----------------------------------------------------------------------
// FILE: orders.api.js
// MODULE: Orders
// PRODNEX ERP
// API helpers do módulo de pedidos
// ----------------------------------------------------------------------

const BASE = '/api/orders';

export async function getOrderPayments(orderId) {
  if (!orderId) {
    return { ok: false, error: 'orderId inválido' };
  }

  try {
    const res = await fetch(`${BASE}/${orderId}/payments`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    const raw = await res.text();

    let json = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = { ok: false, error: 'Resposta inválida', raw };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        ...(json || {})
      };
    }

    return json || { ok: true, payments: [], installments: [] };
  } catch (err) {
    console.error('[orders.api.getOrderPayments] ERR:', err);
    return {
      ok: false,
      error: 'Erro de conexão'
    };
  }
}