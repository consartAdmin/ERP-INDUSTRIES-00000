// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerPriceTablesQuery.repository.js — consultas de tabela preço ║
// ║ Tabelas: public."customerPriceTables", public.prices               ║
// ║ Todas as funções recebem `db` (pool ou client) como 1º argumento   ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function listActivePriceTables(db) {
  const { rows } = await db.query(`
    SELECT price_id, name, description
    FROM public.prices
    WHERE active = true
    ORDER BY price_id
  `);

  return rows;
}

export async function getCustomerPriceTable(db, customerId) {
  const { rows } = await db.query(`
    SELECT
      cpt.customer_id,
      cpt.price_id,
      p.name,
      p.description,
      cpt.created_at,
      cpt.updated_at
    FROM public."customerPriceTables" AS cpt
    JOIN public.customers AS c
      ON c.customer_id = cpt.customer_id
      AND c.is_active = true
    JOIN public.prices AS p
      ON p.price_id = cpt.price_id
      AND p.active = true
    WHERE cpt.customer_id = $1
  `, [customerId]);

  return rows[0] || null;
}

export async function listCustomerPricedProducts(
  db,
  customerId,
  options = {}
) {
  const search = String(options.search || '').trim();
  const limit = Math.min(options.limit || 100, 500);
  const offset = options.offset || 0;

  const { rows } = await db.query(`
    SELECT
      p.product_id,
      p.product_code,
      p.description,
      p.manufacturer_ref,
      pp.price_id,
      pr.name AS price_table_name,
      pp.sale_price
    FROM public."customerPriceTables" AS cpt
    JOIN public.prices AS pr
      ON pr.price_id = cpt.price_id
      AND pr.active = true
    JOIN public."productsPrices" AS pp
      ON pp.price_id = cpt.price_id
    JOIN public.products AS p
      ON p.product_id::text = pp.product_id
      AND p.is_active = true
    WHERE cpt.customer_id = $1
      AND (
        $2 = ''
        OR p.product_code ILIKE '%' || $2 || '%'
        OR p.description ILIKE '%' || $2 || '%'
        OR COALESCE(p.manufacturer_ref, '') ILIKE '%' || $2 || '%'
      )
    ORDER BY p.description, p.product_code
    LIMIT $3
    OFFSET $4
  `, [customerId, search, limit, offset]);

  return rows;
}
