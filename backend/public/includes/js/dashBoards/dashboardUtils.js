// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dashboardUtils.js — Shared utilities for dashboard widgets         ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝


// ======================================================================
// AUTH TOKEN
// ======================================================================

function getToken() {
  return (
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    ''
  );
}


// ======================================================================
// MONEY — BRL
// ======================================================================

export function moneyBR(value) {
  return Number(value || 0).toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  );
}


// ======================================================================
// CURRENT DATE — DD/MM/YYYY
// ======================================================================

export function currentDateBR() {
  return new Date().toLocaleDateString(
    'pt-BR'
  );
}


// ======================================================================
// CURRENT MONTH — MM/YYYY
// ======================================================================

export function currentMonthBR() {
  const now =
    new Date();

  return (
    `${String(
      now.getMonth() + 1
    ).padStart(2, '0')}/${now.getFullYear()}`
  );
}


// ======================================================================
// FETCH DASHBOARD
// ======================================================================

export async function fetchDashboard(
  url,
  options = {}
) {

  // --------------------------------------------------------------------
  // TOKEN
  // --------------------------------------------------------------------

  const token =
    getToken();


  // --------------------------------------------------------------------
  // REQUEST
  // --------------------------------------------------------------------

  const response =
    await fetch(
      url,
      {
        cache: 'no-store',

        credentials:
          'same-origin',

        ...options,

        headers: {
          Accept:
            'application/json',

          ...(token
            ? {
              Authorization:
                `Bearer ${token}`,
            }
            : {}),

          ...(options.headers || {}),
        },
      }
    );


  // --------------------------------------------------------------------
  // RESPONSE BODY
  // --------------------------------------------------------------------

  let data =
    null;


  try {

    data =
      await response.json();

  } catch {

    data =
      null;

  }


  // --------------------------------------------------------------------
  // ERROR
  // --------------------------------------------------------------------

  if (!response.ok) {

    const message =
      data?.message ||
      data?.error ||
      data?.reason ||
      `${url} -> HTTP ${response.status}`;


    const error =
      new Error(
        message
      );


    error.status =
      response.status;

    error.data =
      data;

    error.url =
      url;


    throw error;
  }


  // --------------------------------------------------------------------
  // SUCCESS
  // --------------------------------------------------------------------

  return data;
}