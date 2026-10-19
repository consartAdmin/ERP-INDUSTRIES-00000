// ╔══════════════════════════════════════════════════════════════════════╗
// ║ includeDashboard.js — Dashboard orchestrator                       ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝


// ======================================================================
// DASHBOARD IMPORTS
// ======================================================================

import { dailyReceivablesDashboard }
  from './dailyReceivables.js';

import { dailyPayablesDashboard }
  from './dailyPayables.js';

import { monthlyReceivablesDashboard }
  from './monthlyReceivables.js';

import { monthlyPayablesDashboard }
  from './monthlyPayables.js';

import { totalReceivablesDashboard }
  from './totalReceivables.js?v=20260914-1';

import { totalPayablesDashboard }
  from './totalPayables.js?v=20260914-1';

import { customerOverdueDashboard }
  from './customerOverdue.js';

import { overdueExpensesDashboard }
  from './overdueExpenses.js';

import * as receivablesChartModule
  from './receivablesChart.js?v=20260914-2';

import * as payablesChartModule
  from './payablesChart.js?v=20260914-2';

import { salesAnalyticsDashboard }
  from './salesAnalytics.js';

import { salesTaxesDashboard }
  from './salesTaxes.js';
import { taxAssessmentDashboard }
  from './taxAssessment.js';

const receivablesChartDashboard =
  receivablesChartModule.receivablesChartDashboard ??
  receivablesChartModule.default;

const payablesChartDashboard =
  payablesChartModule.payablesChartDashboard ??
  payablesChartModule.default;


// ======================================================================
// ACCESS / LAYOUT IMPORTS
// ======================================================================

import {
  getDashboardAccess,
  applyDashboardAccess,
} from './dashboardAccess.js';

// ======================================================================
// DASHBOARD REGISTRY
// ======================================================================

const DASHBOARDS = [

  // --------------------------------------------------------------------
  // DAILY
  // --------------------------------------------------------------------

  dailyReceivablesDashboard,
  dailyPayablesDashboard,


  // --------------------------------------------------------------------
  // MONTHLY
  // --------------------------------------------------------------------

  monthlyReceivablesDashboard,
  monthlyPayablesDashboard,
  totalReceivablesDashboard,
  totalPayablesDashboard,


  // --------------------------------------------------------------------
  // OVERDUE
  // --------------------------------------------------------------------

  customerOverdueDashboard,
  overdueExpensesDashboard,


  // --------------------------------------------------------------------
  // FINANCIAL CHARTS
  // --------------------------------------------------------------------

  receivablesChartDashboard,
  payablesChartDashboard,


  // --------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------

  salesAnalyticsDashboard,
  salesTaxesDashboard,
  taxAssessmentDashboard,
];

const DASHBOARD_PAGES = Object.freeze([
  {
    id: 'financial',
    title: 'Financeiro',
    description: 'Contas a pagar, contas a receber e inadimplência',
    keys: new Set([
      'daily-receivables',
      'daily-payables',
      'monthly-receivables',
      'monthly-payables',
      'total-receivables',
      'total-payables',
      'customer-overdue',
      'overdue-expenses',
      'receivables-chart',
      'payables-chart',
    ]),
  },
  {
    id: 'analytics',
    title: 'Vendas',
    description: 'Curvas ABC, lucro bruto e indicadores comerciais',
    keys: new Set([
      'sales-analytics',
    ]),
  },
  {
    id: 'taxes',
    title: 'Impostos',
    description: 'Impostos sobre vendas por tipo e por produto',
    keys: new Set([
      'sales-taxes',
    ]),
  },
  {
    id: 'tax-assessment',
    title: 'Apuração',
    description: 'Débito × crédito dos impostos, saldo a recolher e IRPJ/CSLL',
    keys: new Set([
      'tax-assessment',
    ]),
  },
]);

function getDashboardPageByKey(key) {
  return DASHBOARD_PAGES.find((page) => page.keys.has(key))?.id || 'analytics';
}

function initDashboardPagination(root, userId) {
  const grid = root.querySelector('.dash-grid');
  if (!grid) return;

  root._dashboardPaginationAbort?.abort();
  const paginationAbort = new AbortController();
  const listenerOptions = { signal: paginationAbort.signal };
  root._dashboardPaginationAbort = paginationAbort;

  grid.querySelectorAll('.dash-card[data-dashboard-key]').forEach((card) => {
    card.dataset.dashboardPage = getDashboardPageByKey(card.dataset.dashboardKey);
  });

  root.querySelector('.dashboard-pages-nav')?.remove();

  const navigation = document.createElement('nav');
  navigation.className = 'dashboard-pages-nav';
  navigation.setAttribute('aria-label', 'Páginas do dashboard');
  navigation.innerHTML = `
    <button class="dashboard-page-arrow" type="button" data-dashboard-previous aria-label="Página anterior">‹</button>
    <div class="dashboard-page-heading" aria-live="polite">
      <strong data-dashboard-page-title></strong>
      <span data-dashboard-page-description></span>
    </div>
    <div class="dashboard-page-dots" role="tablist" aria-label="Selecionar página">
      ${DASHBOARD_PAGES.map((page, index) => `
        <button type="button" class="dashboard-page-dot" role="tab"
          data-dashboard-page-index="${index}" aria-label="${page.title}"></button>
      `).join('')}
    </div>
    <span class="dashboard-page-counter" data-dashboard-page-counter></span>
    <button class="dashboard-page-arrow" type="button" data-dashboard-next aria-label="Próxima página">›</button>
  `;
  root.insertBefore(navigation, grid);

  const storageKey = `consart.dashboard.activePage.${userId}`;
  let activeIndex = Number(localStorage.getItem(storageKey));
  if (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= DASHBOARD_PAGES.length) {
    activeIndex = 0;
  }

  const showPage = (requestedIndex) => {
    activeIndex = (requestedIndex + DASHBOARD_PAGES.length) % DASHBOARD_PAGES.length;
    const activePage = DASHBOARD_PAGES[activeIndex];

    grid.querySelectorAll('.dash-card[data-dashboard-page]').forEach((card) => {
      card.hidden = card.dataset.dashboardPage !== activePage.id;
    });

    navigation.querySelector('[data-dashboard-page-title]').textContent = activePage.title;
    navigation.querySelector('[data-dashboard-page-description]').textContent = activePage.description;
    navigation.querySelector('[data-dashboard-page-counter]').textContent = `${activeIndex + 1} / ${DASHBOARD_PAGES.length}`;
    navigation.querySelectorAll('[data-dashboard-page-index]').forEach((dot, index) => {
      const selected = index === activeIndex;
      dot.classList.toggle('is-active', selected);
      dot.setAttribute('aria-selected', String(selected));
      dot.tabIndex = selected ? 0 : -1;
    });

    root.dataset.dashboardPage = activePage.id;
    localStorage.setItem(storageKey, String(activeIndex));
    window.dispatchEvent(new Event('resize'));
  };

  navigation.querySelector('[data-dashboard-previous]').addEventListener('click', () => showPage(activeIndex - 1), listenerOptions);
  navigation.querySelector('[data-dashboard-next]').addEventListener('click', () => showPage(activeIndex + 1), listenerOptions);
  navigation.querySelectorAll('[data-dashboard-page-index]').forEach((dot) => {
    dot.addEventListener('click', () => showPage(Number(dot.dataset.dashboardPageIndex)), listenerOptions);
  });

  root.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowLeft') showPage(activeIndex - 1);
    if (event.key === 'ArrowRight') showPage(activeIndex + 1);
  }, listenerOptions);

  let touchStartX = null;
  root.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true, signal: paginationAbort.signal });
  root.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(distance) >= 60) showPage(activeIndex + (distance < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true, signal: paginationAbort.signal });

  showPage(activeIndex);
}


// ======================================================================
// LOGGED USER
// ======================================================================

function getLoggedUserId() {
  try {

    // ------------------------------------------------------------------
    // FIRST TRY LOCAL / SESSION STORAGE
    // ------------------------------------------------------------------

    const storedValue =
      localStorage.getItem('usuarioId') ||
      localStorage.getItem('userId') ||
      sessionStorage.getItem('usuarioId') ||
      sessionStorage.getItem('userId');


    if (storedValue) {

      const storedUserId =
        Number(
          storedValue
        );


      if (
        Number.isInteger(
          storedUserId
        ) &&
        storedUserId > 0
      ) {
        return storedUserId;
      }
    }


    // ------------------------------------------------------------------
    // FALLBACK: DECODE USER ID FROM JWT
    // ------------------------------------------------------------------

    const token =
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      '';


    if (!token) {

      console.warn(
        '[includeDashboard] Authentication token not found.'
      );

      return null;
    }


    const tokenParts =
      token.split('.');


    if (
      tokenParts.length < 2
    ) {

      console.warn(
        '[includeDashboard] Invalid authentication token.'
      );

      return null;
    }


    const payloadBase64 =
      tokenParts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');


    const normalizedBase64 =
      payloadBase64.padEnd(
        payloadBase64.length +
        (
          (
            4 -
            (
              payloadBase64.length %
              4
            )
          ) %
          4
        ),
        '='
      );


    const payload =
      JSON.parse(
        atob(
          normalizedBase64
        )
      );


    const rawUserId =
      payload.userId ??
      payload.usuarioId ??
      payload.user_id ??
      payload.usuario_id ??
      payload.id ??
      null;


    const userId =
      Number(
        rawUserId
      );


    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {

      console.warn(
        '[includeDashboard] User ID not found in authentication token.',
        payload
      );

      return null;
    }


    return userId;

  } catch (error) {

    console.error(
      '[includeDashboard] Failed to resolve logged user ID:',
      error
    );

    return null;
  }
}


// ======================================================================
// NORMALIZE DASHBOARD ACCESS
// ======================================================================

function normalizeAllowedDashboards(
  value
) {

  if (value instanceof Set) {
    return value;
  }


  if (Array.isArray(value)) {

    return new Set(
      value
        .map((item) => {

          if (
            typeof item === 'string'
          ) {
            return item;
          }


          if (
            item &&
            typeof item === 'object'
          ) {
            return (
              item.key ??
              item.dashboard_key ??
              item.dashboardKey ??
              item.name ??
              null
            );
          }


          return null;

        })
        .filter(Boolean)
    );
  }


  if (
    value &&
    typeof value === 'object'
  ) {

    // Example:
    // {
    //   daily-sales: true,
    //   sales-analytics: true
    // }

    return new Set(
      Object.entries(value)
        .filter(
          ([, enabled]) =>
            Boolean(enabled)
        )
        .map(
          ([key]) =>
            key
        )
    );
  }


  return new Set();
}


// ======================================================================
// RENDER DASHBOARDS
// ======================================================================

function renderDashboards(
  root,
  allowedDashboards
) {

  const grid =
    root.querySelector(
      '.dash-grid'
    );


  if (!grid) {

    console.warn(
      '[includeDashboard] .dash-grid not found.'
    );

    return [];
  }


  const inheritedAccess = {
    'receivables-chart': 'daily-receivables',
    'payables-chart': 'daily-payables',
    'total-receivables': 'daily-receivables',
    'total-payables': 'daily-payables',
    'sales-taxes': 'sales-analytics',
    'tax-assessment': 'sales-analytics',
  };

  const authorizedDashboards =
    DASHBOARDS.filter((dashboard) => {
      const parentKey = inheritedAccess[dashboard.key];
      return allowedDashboards.has(dashboard.key) ||
        (parentKey && allowedDashboards.has(parentKey));
    });


  grid.innerHTML =
    authorizedDashboards
      .map(
        (dashboard) =>
          dashboard.render()
      )
      .join('');


  return authorizedDashboards;
}


// ======================================================================
// LOAD ONLY AUTHORIZED DASHBOARDS
// ======================================================================

async function loadAuthorizedDashboards(
  root,
  authorizedDashboards
) {

  if (
    !Array.isArray(
      authorizedDashboards
    )
  ) {

    console.warn(
      '[includeDashboard] authorizedDashboards must be an array.',
      authorizedDashboards
    );

    return;
  }


  const tasks =
    authorizedDashboards.map(
      async (dashboard) => {

        try {

          if (
            typeof dashboard?.load !==
            'function'
          ) {

            console.warn(
              `[includeDashboard] Dashboard "${dashboard?.key}" has no load() function.`
            );

            return;
          }


          await dashboard.load(
            root
          );

        } catch (error) {

          console.error(
            `[includeDashboard] Failed to load dashboard "${dashboard?.key}":`,
            error
          );

        }
      }
    );


  await Promise.all(
    tasks
  );
}


// ======================================================================
// INIT
// ======================================================================

async function initIncludeDashboard() {

  const root =
    document.getElementById(
      'includeDashBoard'
    );


  if (!root) {

    console.warn(
      '[includeDashboard] #includeDashBoard not found.'
    );

    return;
  }


  // --------------------------------------------------------------------
  // PROTECT AGAINST DOUBLE INITIALIZATION
  // --------------------------------------------------------------------

  if (
    root.dataset.dashboardInitializing ===
    '1'
  ) {
    return;
  }


  root.dataset.dashboardInitializing =
    '1';


  /*
   * Keep everything invisible until:
   *
   * 1. User is identified
   * 2. Permissions are loaded
   * 3. Authorized cards are rendered
   * 4. Dashboard data is loaded
   * 5. Layout is initialized
   */

  root.hidden =
    true;


  try {

    // ------------------------------------------------------------------
    // LOGGED USER
    // ------------------------------------------------------------------

    const userId =
      getLoggedUserId();


    if (!userId) {

      console.warn(
        '[includeDashboard] Logged user ID not found.'
      );

      return;
    }


    console.log(
      '[includeDashboard] Logged user ID:',
      userId
    );


    // ------------------------------------------------------------------
    // GET DASHBOARD ACCESS
    // ------------------------------------------------------------------

    const dashboardAccessResponse =
      await getDashboardAccess(
        userId
      );


    /*
     * Protect includeDashboard.js even if dashboardAccess.js
     * returns Array/Object instead of Set.
     */

    const allowedDashboards =
      normalizeAllowedDashboards(
        dashboardAccessResponse
      );

    // Financial charts inherit the permission of their related summary.
    // This keeps existing dashboard-access records backward compatible.
    if (allowedDashboards.has('daily-receivables')) {
      allowedDashboards.add('receivables-chart');
    }

    if (allowedDashboards.has('daily-payables')) {
      allowedDashboards.add('payables-chart');
    }

    // The taxes slide inherits the Vendas (sales-analytics) permission.
    if (allowedDashboards.has('sales-analytics')) {
      allowedDashboards.add('sales-taxes');
      allowedDashboards.add('tax-assessment');
    }


    console.log(
      '[includeDashboard] Raw dashboard access:',
      dashboardAccessResponse
    );


    console.log(
      '[includeDashboard] Allowed dashboards:',
      [...allowedDashboards]
    );


    // ------------------------------------------------------------------
    // RENDER ONLY AUTHORIZED DASHBOARDS
    // ------------------------------------------------------------------

    const authorizedDashboards =
      renderDashboards(
        root,
        allowedDashboards
      );


    console.log(
      '[includeDashboard] Authorized dashboard modules:',
      authorizedDashboards.map(
        (dashboard) =>
          dashboard.key
      )
    );


    // ------------------------------------------------------------------
    // NO DASHBOARDS
    // ------------------------------------------------------------------

    if (
      !authorizedDashboards.length
    ) {

      console.log(
        '[includeDashboard] User has no dashboards enabled.'
      );


      root.hidden =
        true;


      root.dataset.dashboardInitialized =
        '1';


      return;
    }


    // ------------------------------------------------------------------
    // APPLY ACCESS
    // ------------------------------------------------------------------

    /*
     * Unauthorized dashboards were not rendered.
     *
     * Keep this call for compatibility with dashboardAccess.js
     * in case it also controls child elements/buttons.
     */

    if (
      typeof applyDashboardAccess ===
      'function'
    ) {

      applyDashboardAccess(
        root,
        allowedDashboards
      );
    }


    // ------------------------------------------------------------------
    // LOAD AUTHORIZED DASHBOARD DATA
    // ------------------------------------------------------------------

    /*
     * IMPORTANT:
     *
     * authorizedDashboards = Array of dashboard modules
     *
     * Example:
     *
     * [
     *   dailyReceivablesDashboard,
     *   receivablesChartDashboard,
     *   salesAnalyticsDashboard
     * ]
     *
     * Therefore loadAuthorizedDashboards() receives this ARRAY.
     */

    await loadAuthorizedDashboards(
      root,
      authorizedDashboards
    );

    initDashboardPagination(root, userId);

    // ------------------------------------------------------------------
    // SHOW DASHBOARD
    // ------------------------------------------------------------------

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    root.classList.remove('dashboard-is-loading');
    root.classList.add('dashboard-is-ready');
    root.setAttribute('aria-busy', 'false');

    window.dispatchEvent(new Event('resize'));


    // ------------------------------------------------------------------
    // MARK AS INITIALIZED
    // ------------------------------------------------------------------

    root.dataset.dashboardInitialized =
      '1';


    console.log(
      '[includeDashboard] Dashboard initialization completed.'
    );

  } catch (error) {

    console.error(
      '[includeDashboard] Initialization failed:',
      error
    );


    root.hidden =
      true;

  } finally {

    delete root.dataset
      .dashboardInitializing;

  }
}


// ======================================================================
// MANUAL RELOAD
// ======================================================================

async function reloadIncludeDashboard() {

  const root =
    document.getElementById(
      'includeDashBoard'
    );


  if (!root) {
    return;
  }


  // --------------------------------------------------------------------
  // RESET STATE
  // --------------------------------------------------------------------

  delete root.dataset
    .dashboardInitialized;


  delete root.dataset
    .dashboardInitializing;


  // --------------------------------------------------------------------
  // CLEAR OLD DASHBOARD CONTENT BEFORE RELOAD
  // --------------------------------------------------------------------

  const grid =
    root.querySelector(
      '.dash-grid'
    );


  if (grid) {
    grid.innerHTML =
      '';
  }


  // --------------------------------------------------------------------
  // INITIALIZE AGAIN
  // --------------------------------------------------------------------

  await initIncludeDashboard();
}


// ======================================================================
// BOOT
// ======================================================================

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initIncludeDashboard,
    {
      once: true,
    }
  );

} else {

  initIncludeDashboard();

}


// ======================================================================
// GLOBAL HELPERS
// ======================================================================

window.initIncludeDashboard =
  initIncludeDashboard;


window.reloadIncludeDashboard =
  reloadIncludeDashboard;
