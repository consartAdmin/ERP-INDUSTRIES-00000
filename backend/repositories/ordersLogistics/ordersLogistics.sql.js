// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogistics.sql.js — SELECT base de logística e itens          ║
// ╚════════════════════════════════════════════════════════════════════╝

export const BASE_SELECT_LOGISTICS = `
  SELECT
    logistics_id,
    order_id,
    status,
    picker_user_id,
    checker_user_id,
    packer_user_id,
    shipper_user_id,
    picking_started_at,
    picking_finished_at,
    checking_started_at,
    checking_finished_at,
    packing_started_at,
    packing_finished_at,
    shipping_method,
    shipping_code,
    shipping_date,
    shipping_obs,
    nfe_key,
    nf_number,
    nf_series,
    blind_check_enabled,
    blind_check_status,
    has_discrepancy,
    discrepancy_note,
    created_at,
    updated_at
  FROM "ordersLogistics"
`;

export const BASE_SELECT_ITEMS = `
  SELECT
    item_log_id,
    logistics_id,
    order_item_id,
    sku,
    product_name,
    qty_ordered,
    qty_picked,
    qty_checked,
    discrepancy_qty,
    location,
    obs,
    updated_at
  FROM "ordersLogisticsItems"
`;
