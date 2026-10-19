// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsPrices.multiple.js — Estratégia de múltiplos preços       ║
// ║ CONSART ERP | Node.js ESM                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

const TB = 'public."productsPrices"';

const isFiniteNum = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const toNumOrNull = (value) =>
  isFiniteNum(value)
    ? Number(value)
    : null;

/**
 * Normaliza o código do produto.
 *
 * IMPORTANTE:
 * Agora productsPrices utiliza product_code
 * como referência do produto.
 */
function normalizeProductCode(productCode) {
  return String(productCode ?? '').trim();
}

/**
 * Converte a linha retornada pelo PostgreSQL
 * para o formato utilizado pela aplicação.
 */
function mapRow(row = {}) {
  const priceId =
    row.price_id ??
    row.tabela_preco_id;

  const salePrice =
    row.sale_price ??
    row.preco_venda;

  return {
    product_price_id:
      row.product_price_id == null
        ? null
        : Number(row.product_price_id),

    product_code:
      row.product_code == null
        ? null
        : String(row.product_code),

    price_id:
      priceId == null
        ? null
        : Number(priceId),

    sale_price:
      salePrice == null
        ? null
        : Number(salePrice),

    markup_percent:
      row.markup_percent == null
        ? null
        : Number(row.markup_percent),

    gross_profit_pct:
      row.gross_profit_pct == null
        ? null
        : Number(row.gross_profit_pct),

    created_at:
      row.created_at ?? null,

    updated_at:
      row.updated_at ?? null,

    user_id:
      row.user_id == null
        ? null
        : Number(row.user_id),
  };
}

/**
 * Normaliza um item da lista de preços.
 */
function normalizePriceInput(price = {}) {
  return {
    price_id:
      Number(
        price.price_id ??
        price.tabela_preco_id,
      ),

    sale_price:
      toNumOrNull(
        price.sale_price ??
        price.preco_venda,
      ),

    markup_percent:
      toNumOrNull(
        price.markup_percent,
      ),

    gross_profit_pct:
      toNumOrNull(
        price.gross_profit_pct,
      ),

    user_id:
      price.user_id == null
        ? null
        : Number(price.user_id),
  };
}

/**
 * Lista todos os preços cadastrados
 * para determinado product_code.
 */
export async function getPricesByProduct(productCode) {
  const code =
    normalizeProductCode(productCode);

  if (!code) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PRODUCT_CODE_REQUIRED',
      error: 'productCode is required.',
    };
  }

  try {
    const { rows } =
      await pool.query(
        `
        SELECT
          product_price_id,
          product_code,
          price_id,
          sale_price,
          markup_percent,
          gross_profit_pct,
          created_at,
          updated_at,
          user_id
        FROM ${TB}
        WHERE product_code = $1
        ORDER BY price_id ASC
        `,
        [code],
      );

    const data =
      rows.map(mapRow);

    return {
      ok: true,
      rows: data,
      data,
    };
  } catch (error) {
    console.error(
      '[productsPrices.multiple:getPricesByProduct]',
      error,
    );

    return {
      ok: false,
      statusCode: 500,
      error:
        'Failed to list product prices.',
    };
  }
}

/**
 * Cria ou atualiza múltiplos preços
 * para determinado product_code.
 *
 * UNIQUE esperado:
 *
 * (product_code, price_id)
 */
export async function upsertProductPrices(
  productCode,
  prices,
) {
  const code =
    normalizeProductCode(productCode);

  const list =
    Array.isArray(prices)
      ? prices.filter(Boolean)
      : [];

  if (!code) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PRODUCT_CODE_REQUIRED',
      error: 'productCode is required.',
    };
  }

  if (!list.length) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PRICES_REQUIRED',
      error:
        'prices must be a non-empty array.',
    };
  }

  const items =
    list.map(normalizePriceInput);

  const invalidItem =
    items.find(
      (item) =>
        !Number.isInteger(
          item.price_id,
        ) ||
        item.price_id <= 0,
    );

  if (invalidItem) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_PRICE_ID',
      error:
        'Every item must include a valid price_id.',
    };
  }

  const invalidUser =
    items.find(
      (item) =>
        item.user_id !== null &&
        !Number.isInteger(
          item.user_id,
        ),
    );

  if (invalidUser) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_USER_ID',
      error:
        'user_id must be a valid integer.',
    };
  }

  const client =
    await pool.connect();

  try {
    await client.query('BEGIN');

    const data = [];

    for (const item of items) {
      const { rows } =
        await client.query(
          `
          INSERT INTO ${TB}
          (
            product_code,
            price_id,
            sale_price,
            markup_percent,
            gross_profit_pct,
            user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )

          ON CONFLICT (
            product_code,
            price_id
          )

          DO UPDATE SET
            sale_price =
              EXCLUDED.sale_price,

            markup_percent =
              EXCLUDED.markup_percent,

            gross_profit_pct =
              EXCLUDED.gross_profit_pct,

            user_id =
              COALESCE(
                EXCLUDED.user_id,
                ${TB}.user_id
              ),

            updated_at =
              CURRENT_TIMESTAMP

          RETURNING
            product_price_id,
            product_code,
            price_id,
            sale_price,
            markup_percent,
            gross_profit_pct,
            created_at,
            updated_at,
            user_id
          `,
          [
            code,
            item.price_id,
            item.sale_price,
            item.markup_percent,
            item.gross_profit_pct,
            item.user_id,
          ],
        );

      data.push(
        mapRow(rows[0]),
      );
    }

    await client.query(
      'COMMIT',
    );

    return {
      ok: true,
      rows: data,
      data,
    };
  } catch (error) {
    await client.query(
      'ROLLBACK',
    );

    console.error(
      '[productsPrices.multiple:upsertProductPrices]',
      error,
    );

    return {
      ok: false,
      statusCode: 500,
      error:
        'Failed to upsert product prices.',
    };
  } finally {
    client.release();
  }
}

/**
 * Atualiza um preço específico
 * identificado por:
 *
 * product_code + price_id
 */
export async function updateProductPrice(
  productCode,
  priceId,
  patch = {},
) {
  const code =
    normalizeProductCode(productCode);

  const normalizedPriceId =
    Number(priceId);

  if (
    !code ||
    !Number.isInteger(
      normalizedPriceId,
    ) ||
    normalizedPriceId <= 0
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_PRODUCT_PRICE_KEY',
      error:
        'productCode and priceId are required.',
    };
  }

  const salePrice =
    toNumOrNull(
      patch.sale_price ??
      patch.preco_venda,
    );

  const markupPercent =
    toNumOrNull(
      patch.markup_percent,
    );

  const grossProfitPct =
    toNumOrNull(
      patch.gross_profit_pct,
    );

  const userId =
    patch.user_id == null
      ? null
      : Number(patch.user_id);

  if (
    userId !== null &&
    !Number.isInteger(userId)
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_USER_ID',
      error:
        'user_id must be a valid integer.',
    };
  }

  try {
    const { rows } =
      await pool.query(
        `
        UPDATE ${TB}
        SET
          sale_price =
            COALESCE(
              $3,
              sale_price
            ),

          markup_percent =
            COALESCE(
              $4,
              markup_percent
            ),

          gross_profit_pct =
            COALESCE(
              $5,
              gross_profit_pct
            ),

          user_id =
            COALESCE(
              $6,
              user_id
            ),

          updated_at =
            CURRENT_TIMESTAMP

        WHERE product_code = $1
          AND price_id = $2

        RETURNING
          product_price_id,
          product_code,
          price_id,
          sale_price,
          markup_percent,
          gross_profit_pct,
          created_at,
          updated_at,
          user_id
        `,
        [
          code,
          normalizedPriceId,
          salePrice,
          markupPercent,
          grossProfitPct,
          userId,
        ],
      );

    if (!rows.length) {
      return {
        ok: false,
        statusCode: 404,
        code:
          'PRODUCT_PRICE_NOT_FOUND',
        error:
          'Product price not found.',
      };
    }

    const data =
      mapRow(rows[0]);

    return {
      ok: true,
      rows: [data],
      data,
    };
  } catch (error) {
    console.error(
      '[productsPrices.multiple:updateProductPrice]',
      error,
    );

    return {
      ok: false,
      statusCode: 500,
      error:
        'Failed to update product price.',
    };
  }
}

/**
 * Remove um preço específico
 * pelo product_code + price_id.
 */
export async function deleteProductPrice(
  productCode,
  priceId,
) {
  const code =
    normalizeProductCode(productCode);

  const normalizedPriceId =
    Number(priceId);

  if (
    !code ||
    !Number.isInteger(
      normalizedPriceId,
    ) ||
    normalizedPriceId <= 0
  ) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_PRODUCT_PRICE_KEY',
      error:
        'productCode and priceId are required.',
    };
  }

  try {
    const { rows } =
      await pool.query(
        `
        DELETE FROM ${TB}
        WHERE product_code = $1
          AND price_id = $2

        RETURNING
          product_price_id,
          product_code,
          price_id,
          sale_price,
          markup_percent,
          gross_profit_pct,
          created_at,
          updated_at,
          user_id
        `,
        [
          code,
          normalizedPriceId,
        ],
      );

    if (!rows.length) {
      return {
        ok: false,
        statusCode: 404,
        code:
          'PRODUCT_PRICE_NOT_FOUND',
        error:
          'Product price not found.',
      };
    }

    const data =
      mapRow(rows[0]);

    return {
      ok: true,
      rows: [data],
      data,
    };
  } catch (error) {
    console.error(
      '[productsPrices.multiple:deleteProductPrice]',
      error,
    );

    return {
      ok: false,
      statusCode: 500,
      error:
        'Failed to delete product price.',
    };
  }
}

export default {
  getPricesByProduct,
  upsertProductPrices,
  updateProductPrice,
  deleteProductPrice,
};