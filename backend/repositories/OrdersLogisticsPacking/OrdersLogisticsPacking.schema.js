// ╔════════════════════════════════════════════════════════════════════╗
// ║ OrdersLogisticsPacking.schema.js — VIEW de itens não embalados     ║
// ║ public.v_order_items_not_fully_packed (usa productsBarCode)        ║
// ╚════════════════════════════════════════════════════════════════════╝

export async function ensureNotPackedView(client) {
  await client.query(`
    CREATE OR REPLACE VIEW public.v_order_items_not_fully_packed AS
    SELECT
      oi.order_item_id,
      oi.order_id,
      oi.sku,
      oi.description,
      oi.unit,
      oi.quantity AS ordered_qty,

      COALESCE(packed.packed_qty, 0) AS packed_qty,
      GREATEST(oi.quantity - COALESCE(packed.packed_qty, 0), 0) AS remaining_qty,

      COALESCE(pbc.weight_kg, 0) AS unit_weight_kg,
      COALESCE(pbc.height_cm, 0) AS unit_height_cm,
      COALESCE(pbc.width_cm, 0) AS unit_width_cm,
      COALESCE(pbc.length_cm, 0) AS unit_length_cm

    FROM public.order_items oi

    LEFT JOIN (
      SELECT
        order_item_id,
        SUM(quantity) AS packed_qty
      FROM public."orderVolumeItems"
      GROUP BY order_item_id
    ) packed ON packed.order_item_id = oi.order_item_id

    LEFT JOIN LATERAL (
      SELECT
        pbc.weight_kg,
        pbc.height_cm,
        pbc.width_cm,
        pbc.length_cm
      FROM public."productsBarCode" pbc
      WHERE pbc.product_code::text = oi.sku::text
        AND pbc.is_active IS TRUE
      ORDER BY
        COALESCE(pbc.standard, false) DESC,
        CASE
          WHEN pbc.unit::text = oi.unit::text THEN 0
          ELSE 1
        END ASC,
        pbc.updated_at DESC,
        pbc.barcode_id DESC
      LIMIT 1
    ) pbc ON true

    WHERE GREATEST(oi.quantity - COALESCE(packed.packed_qty, 0), 0) > 0;
  `);
}
