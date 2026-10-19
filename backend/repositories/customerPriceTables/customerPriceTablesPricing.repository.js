// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerPriceTablesPricing.repository.js — precifica itens orçam.  ║
// ║ Usa a tabela de preço vinculada ao cliente (409 se ausente)        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getCustomerPriceTable } from './customerPriceTablesQuery.repository.js';

export async function priceBudgetItems(db, customerId, items) {
  const assignment = await getCustomerPriceTable(db, customerId);

  if (!assignment) {
    const error = new Error(
      'Customer has no active price table assignment'
    );
    error.status = 409;
    throw error;
  }

  const productCodes = items.map((item) => item.productCode);

  const { rows } = await db.query(`
    SELECT
      p.product_id,
      p.product_code,
      p.description,
      p.manufacturer_ref,
      pp.sale_price
    FROM public.products AS p
    JOIN public."productsPrices" AS pp
      ON pp.product_id = p.product_id::text
      AND pp.price_id = $1
    WHERE p.is_active = true
      AND p.product_code = ANY($2::varchar[])
  `, [assignment.price_id, productCodes]);

  const productsByCode = new Map(
    rows.map((row) => [row.product_code, row])
  );

  const missingProductCodes = productCodes.filter(
    (productCode) => !productsByCode.has(productCode)
  );

  if (missingProductCodes.length > 0) {
    const error = new Error(
      'Some products are missing from the customer price table'
    );

    error.status = 409;
    error.details = [...new Set(missingProductCodes)];

    throw error;
  }

  return {
    customerId,
    priceId: assignment.price_id,
    priceTableName: assignment.name,

    items: items.map(({ productCode, quantity }) => {
      const product = productsByCode.get(productCode);

      return {
        productId: String(product.product_id),
        sku: product.product_code,
        description: product.description,
        manufacturerRef: product.manufacturer_ref,
        quantity,
        unitPrice: product.sale_price,
        priceId: assignment.price_id,
      };
    }),
  };
}
