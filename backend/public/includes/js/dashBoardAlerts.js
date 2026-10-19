/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ dashBoardAlerts.js — Alertas Dashboard                              ║
 * ║ PRODNEX ERP                                                         ║
 * ║                                                                      ║
 * ║ - E-mail                                                             ║
 * ║ - NF-e                                                               ║
 * ║ - Pedidos sem NF-e                                                   ║
 * ║ - Better Date To Buy                                                 ║
 * ║ - Estoque Crítico                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

console.log('🔵 dashBoardAlerts.js carregado');


// ─────────────────────────────────────────────────────────────
// APIs
// ─────────────────────────────────────────────────────────────
const DASH_ALERTS_API =
  '/api/dashboard/alerts';

const ORDERS_PENDING_NFE_API =
  '/api/orders/pending-nfe';

const STOCK_ALERTS_API =
  '/api/dashboard/stock-alerts';


// ─────────────────────────────────────────────────────────────
// LINKS
// ─────────────────────────────────────────────────────────────
const ORDERS_PAGE_URL =
  '/public/orders/orders.html';

const STOCK_PAGE_URL =
  '/public/productsStock/productsStock.html';


// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const moneyBRAlerts =
  typeof moneyBR === 'function'
    ? moneyBR
    : (v) =>
      'R$ ' +
      Number(v || 0)
        .toFixed(2)
        .replace('.', ',')
        .replace(
          /\B(?=(\d{3})+(?!\d))/g,
          '.'
        );

async function safeJson(url) {
  try {
    const res = await fetch(
      url,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      throw new Error(
        `${url} → ${res.status}`
      );
    }

    return await res.json();

  } catch (err) {
    console.warn(
      '[dashBoardAlerts]',
      err
    );

    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// ELEMENT REFERENCES
// ─────────────────────────────────────────────────────────────
let alertEmailCard;
let alertEmailCount;
let alertEmailStatus;

let alertNfeCard;
let alertNfeCount;
let alertNfeStatus;

let alertBudgetsOrdersCard;
let alertBudgetsOrdersCount;
let alertBudgetsOrdersStatus;


let alertStockCard;
let alertStockCount;
let alertStockStatus;


// ─────────────────────────────────────────────────────────────
// INIT ELEMENTS
// ─────────────────────────────────────────────────────────────
function initElements() {
  // EMAIL
  alertEmailCard =
    document.getElementById(
      'alert-email'
    );

  alertEmailCount =
    document.getElementById(
      'alert-email-count'
    );

  alertEmailStatus =
    alertEmailCard?.querySelector(
      '.dashboard-alert-status'
    );


  // NFE
  alertNfeCard =
    document.getElementById(
      'alert-nfe'
    );

  alertNfeCount =
    document.getElementById(
      'alert-nfe-count'
    );

  alertNfeStatus =
    alertNfeCard?.querySelector(
      '.dashboard-alert-status'
    );


  // ORDERS
  alertBudgetsOrdersCard =
    document.getElementById(
      'alert-budgets-orders'
    );

  alertBudgetsOrdersCount =
    document.getElementById(
      'alert-budgets-orders-count'
    );

  alertBudgetsOrdersStatus =
    alertBudgetsOrdersCard?.querySelector(
      '.dashboard-alert-status'
    );


  // STOCK
  alertStockCard =
    document.getElementById(
      'alert-stock'
    );

  alertStockCount =
    document.getElementById(
      'alert-stock-count'
    );

  alertStockStatus =
    document.getElementById(
      'alert-stock-status'
    );


  bindNavigation();
}


// ─────────────────────────────────────────────────────────────
// CLICK NAVIGATION
// ─────────────────────────────────────────────────────────────
function bindNavigation() {
  if (alertEmailCard) {
    alertEmailCard.addEventListener(
      'click',
      () => {
        window.location.href =
          '/public/emailInbox/emailInbox.html';
      }
    );
  }

  if (alertNfeCard) {
    alertNfeCard.addEventListener(
      'click',
      () => {
        window.location.href =
          '/public/nfeInbox/nfeInbox.html';
      }
    );
  }

  if (alertBudgetsOrdersCard) {
    alertBudgetsOrdersCard.addEventListener(
      'click',
      () => {
        window.location.href =
          ORDERS_PAGE_URL;
      }
    );
  }

  if (alertStockCard) {
    alertStockCard.addEventListener(
      'click',
      () => {
        window.location.href =
          STOCK_PAGE_URL;
      }
    );
  }
}


// ─────────────────────────────────────────────────────────────
// UPDATE EMAIL + NFE
// ─────────────────────────────────────────────────────────────
async function updateMainAlerts() {
  const data =
    await safeJson(
      DASH_ALERTS_API
    );

  if (!data?.ok) return;

  // EMAIL
  const unread =
    Number(
      data.email?.unreadCount
      || 0
    );

  if (alertEmailCount) {
    alertEmailCount.textContent =
      unread;
  }

  if (alertEmailStatus) {
    alertEmailStatus.textContent =
      unread > 0
        ? `${unread} mensagem(ns)`
        : 'Nenhuma nova mensagem';
  }

  alertEmailCard?.classList.toggle(
    'is-active',
    unread > 0
  );


  // NFE
  const nfe =
    Number(
      data.nfe?.newCount
      || 0
    );

  if (alertNfeCount) {
    alertNfeCount.textContent =
      nfe;
  }

  if (alertNfeStatus) {
    alertNfeStatus.textContent =
      nfe > 0
        ? `${nfe} nota(s) nova(s)`
        : 'Nenhuma nota nova';
  }

  alertNfeCard?.classList.toggle(
    'is-active',
    nfe > 0
  );
}


// ─────────────────────────────────────────────────────────────
// UPDATE PENDING ORDERS
// ─────────────────────────────────────────────────────────────
async function updateOrdersAlert() {
  const data =
    await safeJson(
      ORDERS_PENDING_NFE_API
    );

  if (!data?.ok) return;

  const count =
    Number(
      data.count || 0
    );

  const total =
    Number(
      data.totalAmount || 0
    );

  if (alertBudgetsOrdersCount) {
    alertBudgetsOrdersCount.textContent =
      count;
  }

  if (alertBudgetsOrdersStatus) {
    alertBudgetsOrdersStatus.textContent =
      count > 0
        ? `${count} pedido(s) | ${moneyBRAlerts(total)}`
        : 'Nenhum pedido pendente';
  }

  alertBudgetsOrdersCard?.classList.toggle(
    'is-active',
    count > 0
  );
}


// ─────────────────────────────────────────────────────────────
// UPDATE STOCK ALERT
// ─────────────────────────────────────────────────────────────
async function updateStockAlert() {
  const data =
    await safeJson(
      STOCK_ALERTS_API
    );

  if (!data?.ok) return;

  const count =
    Number(
      data.count || 0
    );

  if (alertStockCount) {
    alertStockCount.textContent =
      count;
  }

  if (alertStockStatus) {
    alertStockStatus.textContent =
      count > 0
        ? `${count} produto(s) abaixo do mínimo`
        : 'Nenhum produto abaixo do mínimo';
  }

  alertStockCard?.classList.toggle(
    'is-active',
    count > 0
  );
}


// ─────────────────────────────────────────────────────────────
// MAIN UPDATE
// ─────────────────────────────────────────────────────────────
async function atualizarDashBoardAlerts() {
  await Promise.all([
    updateMainAlerts(),
    updateOrdersAlert(),
    updateStockAlert()
  ]);
}

window.addEventListener('focus', atualizarDashBoardAlerts);

window.addEventListener('pageshow', atualizarDashBoardAlerts);

window.addEventListener('email:updated', atualizarDashBoardAlerts);

window.addEventListener('storage', (ev) => {
  if (ev.key === 'consart_email_alert_refresh') {
    atualizarDashBoardAlerts();
  }
});


// ─────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────
document.addEventListener(
  'DOMContentLoaded',
  () => {
    initElements();

    atualizarDashBoardAlerts();

    setInterval(
      atualizarDashBoardAlerts,
      30000
    );
  }
);