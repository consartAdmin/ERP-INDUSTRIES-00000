// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsImagens.sql.js — SELECT base (com aliases legados) e ORDER BY ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB, TB_PRODUCTS } from './productsImagens.constants.js';

export const BASE_SELECT = `
  SELECT
    img.product_image_id,
    img.product_image_id AS product_imagem_id,
    img.product_code,
    p.product_id,
    img.barcode_id,
    img.image_url,
    img.image_path,
    img.image_alt,
    img.is_primary,
    img.position,
    img.created_at,
    img.updated_at,
    img.is_active
  FROM ${TB} img
  LEFT JOIN ${TB_PRODUCTS} p
    ON p.product_code = img.product_code
`;

export const ORDER_BY = 'ORDER BY img.barcode_id ASC NULLS FIRST, img.position ASC, img.product_image_id ASC';
