// ╔════════════════════════════════════════════════════════════════════╗
// ║ batchCrmDealsCreate.repository.js — createBatchDeals               ║
// ║ Cria negociações em lote via crmDealsApi.createDeal                ║
// ╚════════════════════════════════════════════════════════════════════╝

import crmDealsApi from '../crmDeals/crmDeals.index.js';
import { text, numberOrNull, buildCustomerName } from './batchCrmDeals.utils.js';

export async function createBatchDeals({ customers = [], defaults = {} } = {}) {
  if (!Array.isArray(customers) || !customers.length) {
    return {
      ok: false,
      error: 'CUSTOMERS_REQUIRED',
    };
  }

  const results = [];
  let created = 0;
  let failed = 0;

  for (const customer of customers) {
    const customerId = numberOrNull(customer.customer_id);
    const customerName = buildCustomerName(customer);

    if (!customerId) {
      failed += 1;
      results.push({
        ok: false,
        customer_id: customer.customer_id ?? null,
        customer_name: customerName,
        error: 'INVALID_CUSTOMER_ID',
      });
      continue;
    }

    const payload = {
      customer_id: customerId,
      customer_name: customerName,

      stage_code: text(defaults.stage_code) || 'NOVO',
      seller_id: numberOrNull(defaults.seller_id),
      estimated_value: numberOrNull(defaults.estimated_value),

      lead_source_id: numberOrNull(defaults.lead_source_id),
      status_type_id: numberOrNull(defaults.status_type_id),

      tag: text(defaults.tag) || null,
      next_step: text(defaults.next_step) || null,
      notes: text(defaults.notes) || null,
    };

    try {
      const result = await crmDealsApi.createDeal(payload);

      if (result.ok) {
        created += 1;

        results.push({
          ok: true,
          id: result.data?.id ?? null,
          customer_id: customerId,
          customer_name: result.data?.customer_name ?? customerName,
          stage_id: result.data?.stage_id ?? null,
          stage_code: result.data?.stage_code ?? payload.stage_code,
        });
      } else {
        failed += 1;

        results.push({
          ok: false,
          customer_id: customerId,
          customer_name: customerName,
          error: result.error || 'CREATE_DEAL_ERROR',
        });
      }
    } catch (err) {
      failed += 1;

      results.push({
        ok: false,
        customer_id: customerId,
        customer_name: customerName,
        error: err?.message || 'CREATE_DEAL_EXCEPTION',
      });
    }
  }

  return {
    ok: true,
    summary: {
      total: customers.length,
      created,
      failed,
    },
    results,
  };
}
