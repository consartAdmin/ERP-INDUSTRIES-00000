// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImagesQuery.repository.js — Tabelas de preço e produtos       ║
// ║ Tabelas: prices, products, productsPrices, productsImages          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { safeText, safeLimit, normalizePriceId } from './promoImages.sanitizers.js';
import { normalizeImageUrl } from './promoImages.utils.js';

export async function listPriceTables() {
  const { rows } = await pool.query(`
    SELECT
      price_id::integer AS id,
      name,
      description,
      active
    FROM public."prices"
    WHERE active = true
    ORDER BY name
  `);

  return rows;
}

export async function searchProducts({
  price_id = null,
  tabela_preco_id = null,
  q = '',
  limit = 30,
} = {}) {
  const finalPriceId = normalizePriceId(price_id ?? tabela_preco_id);

  if (!finalPriceId) {
    const err = new Error('Informe price_id válido.');
    err.status = 400;
    throw err;
  }

  const term = `%${safeText(q)}%`;
  const finalLimit = safeLimit(limit);

  const { rows } = await pool.query(
    `
    SELECT
      p.product_id,
      p.product_code::text,
      p.description::text,

      'UN'::text AS unit,

      COALESCE(pp.sale_price, 0)::numeric AS price,

      pi.image_url::text AS image_url

    FROM public.products p

    INNER JOIN public."productsPrices" pp
      ON pp.product_id = p.product_id::text
     AND pp.price_id = $1::integer

    LEFT JOIN LATERAL (
      SELECT img.image_url
        FROM public."productsImages" img
       WHERE img.product_code = p.product_code
         AND img.is_active = TRUE
       ORDER BY
         (img.barcode_id IS NULL) DESC,
         img.is_primary DESC,
         img.position ASC,
         img.product_image_id ASC
       LIMIT 1
    ) pi ON TRUE

    WHERE (
         $2::text = '%%'
      OR p.product_code::text ILIKE $2::text
      OR p.description::text ILIKE $2::text
    )

    ORDER BY p.description

    LIMIT $3::integer
    `,
    [
      finalPriceId,
      term,
      finalLimit,
    ]
  );

  return rows.map((row) => ({
    ...row,
    image_url: normalizeImageUrl(row),
  }));
}

export async function getProductForPromo({ price_id, tabela_preco_id, product_code }) {
  const rows = await searchProducts({
    price_id: price_id ?? tabela_preco_id,
    q: product_code,
    limit: 20,
  });

  const cleanCode = safeText(product_code);

  return (
    rows.find((r) => safeText(r.product_code) === cleanCode) ||
    rows[0] ||
    null
  );
}
