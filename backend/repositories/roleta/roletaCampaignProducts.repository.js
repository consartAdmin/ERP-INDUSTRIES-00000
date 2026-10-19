// ╔════════════════════════════════════════════════════════════════════╗
// ║ roletaCampaignProducts.repository.js — Produtos da campanha        ║
// ║ getCampaignProducts / listCampaignProductsAdmin / add / remove     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_PRODUCTS } from './roleta.constants.js';

/**
 * Get products for a campaign (only active)
 * - If join with public.products fails in your schema, fallback to product_code only.
 */
export async function getCampaignProducts(campaign_id) {
  // Try JOIN with products table (your earlier assumption)
  try {
    const { rows } = await pool.query(
      `SELECT p.product_code,
              COALESCE(pr.name, p.product_code) AS name,
              GREATEST(p.weight, 1) AS weight
       FROM ${TB_PRODUCTS} p
       LEFT JOIN public.products pr ON pr.product_code = p.product_code
       WHERE p.campaign_id=$1
         AND p.is_active=TRUE
       ORDER BY p.id ASC`,
      [campaign_id]
    );
    return rows;
  } catch (e) {
    // Fallback if public.products or column doesn't exist
    const { rows } = await pool.query(
      `SELECT p.product_code,
              p.product_code AS name,
              GREATEST(p.weight, 1) AS weight
       FROM ${TB_PRODUCTS} p
       WHERE p.campaign_id=$1
         AND p.is_active=TRUE
       ORDER BY p.id ASC`,
      [campaign_id]
    );
    return rows;
  }
}

export async function listCampaignProductsAdmin(campaign_id) {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.campaign_id, p.product_code, p.weight, p.is_active,
              pr.name
       FROM ${TB_PRODUCTS} p
       LEFT JOIN public.products pr ON pr.product_code = p.product_code
       WHERE p.campaign_id = $1
       ORDER BY p.id DESC`,
      [campaign_id]
    );
    return rows;
  } catch {
    const { rows } = await pool.query(
      `SELECT p.id, p.campaign_id, p.product_code, p.weight, p.is_active
       FROM ${TB_PRODUCTS} p
       WHERE p.campaign_id = $1
       ORDER BY p.id DESC`,
      [campaign_id]
    );
    return rows;
  }
}

export async function addCampaignProduct({ campaign_id, product_code, weight, is_active }) {
  await pool.query(
    `INSERT INTO ${TB_PRODUCTS} (campaign_id, product_code, weight, is_active)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (campaign_id, product_code)
     DO UPDATE SET weight=EXCLUDED.weight, is_active=EXCLUDED.is_active`,
    [campaign_id, product_code, weight, is_active]
  );
}

export async function removeCampaignProductById(id) {
  await pool.query(`DELETE FROM ${TB_PRODUCTS} WHERE id=$1`, [id]);
}
