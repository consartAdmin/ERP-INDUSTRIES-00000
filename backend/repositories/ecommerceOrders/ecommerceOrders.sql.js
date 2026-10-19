// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrders.sql.js — WHERE dinâmico da listagem de pedidos     ║
// ╚════════════════════════════════════════════════════════════════════╝

/* --------------------------------------------------------------------- */
/* WHERE dinâmico para consulta/listagem                                  */
/* --------------------------------------------------------------------- */

export function buildOrdersWhere({
  date_from,
  date_to,
  billingType,
  status,      // 🔹 novo filtro opcional de status do Asaas
  qText,
}) {
  const where = [];
  const params = [];
  let i = 1;

  if (date_from) {
    where.push(`o.created_at >= $${i++}`);
    params.push(date_from);
  }
  if (date_to) {
    where.push(`o.created_at <= $${i++}`);
    params.push(date_to);
  }

  if (billingType) {
    where.push(`o.asaas_billing_type = $${i++}`);
    params.push(String(billingType));
  }

  if (status) {
    where.push(`o.asaas_status = $${i++}`);
    params.push(String(status));
  }

  if (qText) {
    where.push(`
      (
        o.asaas_payment_id ILIKE $${i}
        OR o.shipping_provider ILIKE $${i}
        OR o.shipping_service  ILIKE $${i}
        OR o.shipping_rule     ILIKE $${i}
      )
    `);
    params.push(`%${qText}%`);
    i++;
  }

  const sqlWhere = where.length ? ` WHERE ${where.join(' AND ')} ` : '';
  return { sqlWhere, params };
}
