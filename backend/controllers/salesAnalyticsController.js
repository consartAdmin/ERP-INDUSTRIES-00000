// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesAnalyticsController.js — Sales Analytics Controller           ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadSalesAnalytics } from '../repositories/salesAnalytics/salesAnalytics.index.js';


export async function getSalesAnalytics(req, res) {
    try {
        const data = await loadSalesAnalytics({
            state: String(req.query?.state || '').trim().toUpperCase(),
            category: String(req.query?.category || '').trim(),
            startDate: String(req.query?.startDate || '').trim(),
            endDate: String(req.query?.endDate || '').trim(),
        });

        return res.json({
            ok: true,
            filters: data?.filters || {},
            summary: data?.summary || {},
            abcProducts: Array.isArray(data?.abcProducts) ? data.abcProducts : [],
            abcCustomers: Array.isArray(data?.abcCustomers) ? data.abcCustomers : [],
            salesByCategory: Array.isArray(data?.salesByCategory) ? data.salesByCategory : [],
            salesByMonth: Array.isArray(data?.salesByMonth) ? data.salesByMonth : [],
            quantityByMonth: Array.isArray(data?.quantityByMonth) ? data.quantityByMonth : [],
        });
    } catch (error) {
        console.error('[salesAnalyticsController] getSalesAnalytics:', error);

        return res.status(Number(error?.status) || 500).json({
            ok: false,
            code: error?.code || 'SALES_ANALYTICS_ERROR',
            message: error?.message || 'Unable to load sales analytics dashboard.',
        });
    }
}
