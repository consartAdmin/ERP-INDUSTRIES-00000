// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsLoad.repository.js — loadSalesAnalytics (principal)  ║
// ║ Normaliza filtros e carrega todos os blocos em paralelo            ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  normalizeState,
  normalizeCategory,
  normalizeDateRange,
} from './salesAnalytics.sanitizers.js';
import { toNumber } from './salesAnalytics.utils.js';
import { loadSummary } from './salesAnalyticsSummary.repository.js';
import { loadAbcProducts, loadAbcCustomers } from './salesAnalyticsAbc.repository.js';
import { loadSalesByCategory } from './salesAnalyticsByCategory.repository.js';
import { loadSalesByMonth, loadQuantityByMonth } from './salesAnalyticsByMonth.repository.js';

// ======================================================================
// MAIN
// ======================================================================

export async function loadSalesAnalytics({
    state = '',
    category = '',
    startDate = '',
    endDate = '',
} = {}) {

    // ------------------------------------------------------------------
    // NORMALIZE FILTERS
    // ------------------------------------------------------------------

    const normalizedRange = normalizeDateRange(startDate, endDate);

    const normalizedFilters = {
        state:
            normalizeState(
                state
            ),

        category:
            normalizeCategory(
                category
            ),

        startDate: normalizedRange.startDate,
        endDate: normalizedRange.endDate,
    };


    // ------------------------------------------------------------------
    // LOAD ANALYTICS IN PARALLEL
    // ------------------------------------------------------------------

    const [
        summary,
        abcProducts,
        abcCustomers,
        salesByCategory,
        salesByMonth,
        quantityByMonth,
    ] = await Promise.all([

        /*
         * Official source:
         * public."invoicesIssued"
         *
         * Expected values:
         * - totalRevenue
         * - totalUnits
         * - totalInvoices
         * - averageTicket
         */
        loadSummary(
            normalizedFilters
        ),


        /*
         * Product revenue based on issued and valid invoices.
         */
        loadAbcProducts(
            normalizedFilters
        ),


        /*
         * Customer revenue based on issued and valid invoices.
         */
        loadAbcCustomers(
            normalizedFilters
        ),


        loadSalesByCategory(
            normalizedFilters
        ),


        loadSalesByMonth(
            normalizedFilters
        ),


        loadQuantityByMonth(
            normalizedFilters
        ),

    ]);


    // ------------------------------------------------------------------
    // NORMALIZE RESPONSE
    // ------------------------------------------------------------------

    return {

        filters: normalizedFilters,

        summary: {
            totalRevenue:
                toNumber(
                    summary?.totalRevenue
                ),

            totalUnits:
                toNumber(
                    summary?.totalUnits
                ),

            totalInvoices:
                Number(
                    summary?.totalInvoices ||
                    0
                ),

            averageTicket:
                toNumber(
                    summary?.averageTicket
                ),

            topProduct:
                String(
                    summary?.topProduct ||
                    '—'
                ),
        },


        abcProducts:
            Array.isArray(
                abcProducts
            )
                ? abcProducts
                : [],


        abcCustomers:
            Array.isArray(
                abcCustomers
            )
                ? abcCustomers
                : [],


        salesByCategory:
            Array.isArray(
                salesByCategory
            )
                ? salesByCategory
                : [],


        salesByMonth:
            Array.isArray(
                salesByMonth
            )
                ? salesByMonth
                : [],


        quantityByMonth:
            Array.isArray(
                quantityByMonth
            )
                ? quantityByMonth
                : [],

    };
}

