// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerPriceTablesAssign.repository.js — vincula tabela ao cliente║
// ║ Tabela: public."customerPriceTables" (upsert por customer_id)      ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function assignCustomerPriceTable(
  db,
  customerId,
  priceId
) {
  const { rows } = await db.query(`
    INSERT INTO public."customerPriceTables" AS cpt (
      customer_id,
      price_id
    )
    SELECT
      c.customer_id,
      p.price_id
    FROM public.customers AS c
    JOIN public.prices AS p
      ON p.price_id = $2
      AND p.active = true
    WHERE c.customer_id = $1
      AND c.is_active = true
    ON CONFLICT (customer_id)
    DO UPDATE SET
      price_id = EXCLUDED.price_id,
      updated_at = now()
    RETURNING
      customer_id,
      price_id,
      created_at,
      updated_at
  `, [customerId, priceId]);

  return rows[0] || null;
}
