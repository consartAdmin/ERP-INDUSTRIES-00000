// ╔════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrderItems.sql.js — WHERE dinâmico dos itens              ║
// ╚════════════════════════════════════════════════════════════════════╝

/* --------------------------------------------------------------------- */
/* WHERE dinâmico (para caso você queira filtros adicionais no futuro)    */
/* --------------------------------------------------------------------- */

export function buildItemsWhere({ order_id, product_code, search }) {
  const where = [];
  const params = [];
  let i = 1;

  if (order_id) {
    where.push(`i.order_id = $${i++}`);
    params.push(order_id);
  }

  if (product_code) {
    where.push(`i.product_code::text = $${i++}::text`);
    params.push(String(product_code));
  }

  if (search) {
    where.push(`
      (
        i.product_code ILIKE $${i}
        OR i.name      ILIKE $${i}
      )
    `);
    params.push(`%${search}%`);
    i++;
  }

  const sqlWhere = where.length ? ` WHERE ${where.join(' AND ')} ` : '';
  return { sqlWhere, params };
}
