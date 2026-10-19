// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesTaxesDashboardController.js — Sales Taxes Dashboard Controller ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadSalesTaxes } from '../repositories/salesTaxes/salesTaxes.repository.js';


export async function getSalesTaxesDashboard(req, res) {
    try {
        const data = await loadSalesTaxes({
            startDate: String(req.query?.startDate || '').trim(),
            endDate: String(req.query?.endDate || '').trim(),
        });

        // regimeContext is internal (used by the apuração slide).
        const { regimeContext, ...response } = data;

        return res.json({
            ok: true,
            ...response,
        });
    } catch (error) {
        console.error('[salesTaxesDashboardController] getSalesTaxesDashboard:', error);

        return res.status(Number(error?.status) || 500).json({
            ok: false,
            code: error?.code || 'SALES_TAXES_ERROR',
            message: error?.message || 'Unable to load sales taxes dashboard.',
        });
    }
}
