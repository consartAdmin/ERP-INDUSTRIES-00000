// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoicesPdfData.repository.js                  ║
// ║ getSalesCommissionsFromInvoicesPdfData — diagnostics + itens       ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  diagnosticsSalesCommissionsFromInvoices,
  listSalesCommissionsFromInvoices,
} from './salesCommissionsFromInvoicesQuery.repository.js';

export async function getSalesCommissionsFromInvoicesPdfData({
    dateStart = null,
    dateEnd = null,
    salesperson = null,
    priceId = null,
} = {}) {
    const diagnostics = await diagnosticsSalesCommissionsFromInvoices({
        dateStart,
        dateEnd,
        salesperson,
        priceId,
    });

    const items = await listSalesCommissionsFromInvoices({
        dateStart,
        dateEnd,
        salesperson,
        priceId,
        limit: 5000,
        offset: 0,
    });

    return {
        ok: true,
        filters: {
            dateStart,
            dateEnd,
            salesperson,
            priceId,
        },
        diagnostics,
        total: items.total,
        rows: items.rows || [],
    };
}
