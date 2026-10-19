// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsManufacturesRoutes.js                                 ║
// ║ MODULE: Manufacturers Search                                        ║
// ║ DESCRIPTION: Rotas para buscar fabricantes e produtos por fabricante ║
// ║ TABLES: public.manufacturers, public.products, public."productsStock"║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import pool from '../config/db.js';

const router = Router();

/* ╔══════════════════════════════════════════════════════════════════╗
   ║ GET /api/products-manufactures                                  ║
   ║ Busca fabricantes                                                ║
   ╚══════════════════════════════════════════════════════════════════╝ */
router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || req.query.search || '').trim();
        const limit = Math.min(Number(req.query.limit || 50), 100);

        const params = [];
        let where = 'WHERE active = true';

        if (q) {
            params.push(`%${q}%`);
            where += `
        AND (
          trade_name ILIKE $1
          OR corporate_name ILIKE $1
          OR tax_id ILIKE $1
          OR email ILIKE $1
          OR phone ILIKE $1
          OR mobile ILIKE $1
        )
      `;
        }

        params.push(limit);

        const sql = `
      SELECT
        manufacturer_id AS id,
        manufacturer_id,
        trade_name AS name,
        trade_name,
        corporate_name,
        tax_id,
        email,
        phone,
        mobile,
        website,
        city,
        state,
        active,
        created_at,
        updated_at
      FROM public.manufacturers
      ${where}
      ORDER BY trade_name ASC
      LIMIT $${params.length}
    `;

        const { rows } = await pool.query(sql, params);

        return res.json({
            ok: true,
            rows,
        });
    } catch (error) {
        console.error('[productsManufacturesRoutes][GET /]', error);

        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
});

/* ╔══════════════════════════════════════════════════════════════════╗
   ║ GET /api/products-manufactures/products                         ║
   ║ Busca produtos vinculados ao fabricante + estoque mínimo/máximo  ║
   ╚══════════════════════════════════════════════════════════════════╝ */
router.get('/products', async (req, res) => {
    try {
        const manufacturerId = Number(
            req.query.manufacturer_id ||
            req.query.manufacture_id ||
            req.query.id ||
            0
        );

        const manufacturerName = String(
            req.query.manufacturer_name ||
            req.query.manufacture_name ||
            req.query.name ||
            req.query.q ||
            ''
        ).trim();

        const limit = Math.min(Number(req.query.limit || 500), 1000);

        const filter = String(req.query.filter || 'all').trim();

        const params = [];
        const where = [];

        if (manufacturerId) {
            params.push(manufacturerId);
            where.push(`m.manufacturer_id = $${params.length}`);
        } else if (manufacturerName) {
            params.push(`%${manufacturerName}%`);
            where.push(`m.trade_name ILIKE $${params.length}`);
        }

        /* ╔══════════════════════════════════════════════════════════════╗
           ║ STOCK FILTERS                                               ║
           ╚══════════════════════════════════════════════════════════════╝ */

        if (filter === 'stock_gt_zero') {
            where.push(`
    COALESCE(ps.stock_qty, 0) > 0
  `);
        }

        if (filter === 'below_min') {
            where.push(`
    COALESCE(ps.stock_min, 0) > 0
    AND COALESCE(ps.stock_qty, 0) < COALESCE(ps.stock_min, 0)
  `);
        }

        if (filter === 'above_max') {
            where.push(`
    COALESCE(ps.stock_max, 0) > 0
    AND COALESCE(ps.stock_qty, 0) > COALESCE(ps.stock_max, 0)
  `);
        }

        if (filter === 'inside_range') {
            where.push(`
    COALESCE(ps.stock_min, 0) > 0
    AND COALESCE(ps.stock_max, 0) > 0
    AND COALESCE(ps.stock_qty, 0) >= COALESCE(ps.stock_min, 0)
    AND COALESCE(ps.stock_qty, 0) <= COALESCE(ps.stock_max, 0)
  `);
        }

        params.push(limit);

        const sql = `
      WITH products_normalized AS (
        SELECT
          p.*,
          to_jsonb(p) AS pj,

          NULLIF(to_jsonb(p)->>'manufacturer_id', '')::integer AS manufacturer_id_safe,
          NULLIF(to_jsonb(p)->>'product_manufacturer_id', '')::integer AS product_manufacturer_id_safe,
          NULLIF(to_jsonb(p)->>'product_stock_id', '')::bigint AS product_stock_id_safe
        FROM public.products p
      )

      SELECT
        pn.pj->>'product_id' AS product_id,

        COALESCE(
          pn.pj->>'product_code',
          pn.pj->>'code',
          pn.pj->>'sku'
        ) AS product_code,

        COALESCE(
          pn.pj->>'product_code',
          pn.pj->>'code',
          pn.pj->>'sku'
        ) AS sku,

        COALESCE(
          pn.pj->>'description',
          pn.pj->>'product_name',
          pn.pj->>'name'
        ) AS description,

        COALESCE(
          pn.pj->>'unit',
          pn.pj->>'unidade',
          pn.pj->>'um',
          'UN'
        ) AS unit,

        COALESCE(
          NULLIF(pn.pj->>'cost_price', '')::numeric,
          NULLIF(pn.pj->>'preco_custo', '')::numeric,
          NULLIF(pn.pj->>'cost', '')::numeric,
          0
        ) AS cost_price,

        pn.product_stock_id_safe AS product_stock_id,

        COALESCE(ps.stock_qty, 0) AS stock_qty,
        COALESCE(ps.stock_min, 0) AS stock_min,
        COALESCE(ps.stock_max, 0) AS stock_max,

        m.manufacturer_id,
        m.trade_name AS manufacturer_name
      FROM products_normalized pn

      LEFT JOIN public."productsStock" ps
        ON ps.product_stock_id = pn.product_stock_id_safe

      LEFT JOIN public.manufacturers m
        ON m.manufacturer_id = COALESCE(
          pn.manufacturer_id_safe,
          pn.product_manufacturer_id_safe
        )

      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}

      ORDER BY
        COALESCE(
          pn.pj->>'description',
          pn.pj->>'product_name',
          pn.pj->>'name',
          pn.pj->>'product_code'
        ) ASC

      LIMIT $${params.length}
    `;

        const { rows } = await pool.query(sql, params);

        return res.json({
            ok: true,
            rows,
        });
    } catch (error) {
        console.error('[productsManufacturesRoutes][GET /products]', error);

        return res.status(500).json({
            ok: false,
            error: error.message,
        });
    }
});

export default router;