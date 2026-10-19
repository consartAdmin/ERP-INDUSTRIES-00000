// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsPrices.single.js — Estratégia de preço único              ║
// ║ CONSART ERP | Node.js ESM | price_id fixo: 1                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

const TB =
  'public."productsPrices"';

const ALIAS = 'pp';

export const SINGLE_PRICE_ID = 1;

const isFiniteNum = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const toNumOrNull = (value) =>
  isFiniteNum(value)
    ? Number(value)
    : null;

const toNumOrZero = (value) =>
  isFiniteNum(value)
    ? Number(value)
    : 0;

/**
 * Normaliza product_code.
 */
function normalizeProductCode(
  productCode,
) {
  return String(
    productCode ?? '',
  ).trim();
}

/**
 * Padroniza uma linha retornada
 * pelo PostgreSQL.
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
        : Number(
          row.product_price_id,
        ),

    product_code:
      row.product_code == null
        ? null
        : String(
          row.product_code,
        ),

    price_id:
      priceId != null
        ? toNumOrZero(priceId)
        : null,

    sale_price:
      salePrice != null
        ? toNumOrNull(
          salePrice,
        )
        : null,

    markup_percent:
      row.markup_percent != null
        ? toNumOrNull(
          row.markup_percent,
        )
        : null,

    gross_profit_pct:
      row.gross_profit_pct != null
        ? toNumOrNull(
          row.gross_profit_pct,
        )
        : null,

    created_at:
      row.created_at ?? null,

    updated_at:
      row.updated_at ?? null,

    user_id:
      row.user_id == null
        ? null
        : Number(
          row.user_id,
        ),
  };
}

/**
 * Normaliza dados recebidos
 * para preço único.
 */
function normalizePriceInput(
  price = {},
) {
  return {
    price_id:
      SINGLE_PRICE_ID,

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
        : Number(
          price.user_id,
        ),
  };
}

function invalidProductCodeResult() {
  return {
    ok: false,
    statusCode: 400,
    code:
      'PRODUCT_CODE_REQUIRED',
    error:
      'productCode is required.',
  };
}

function invalidSinglePriceResult(
  receivedPriceId,
) {
  return {
    ok: false,
    statusCode: 422,
    code:
      'PRODUCT_PRICE_MODE_SINGLE',

    error:
      `O modo de preço único permite somente o price_id ${SINGLE_PRICE_ID}.`,

    details: {
      allowedPriceId:
        SINGLE_PRICE_ID,

      receivedPriceId,
    },
  };
}

/**
 * Lista somente o preço único
 * configurado para o product_code.
 */
export async function getPricesByProduct(
  productCode,
) {
  const code =
    normalizeProductCode(
      productCode,
    );

  if (!code) {
    return invalidProductCodeResult();
  }

  try {
    const { rows } =
      await pool.query(
        `
        SELECT
          ${ALIAS}.product_price_id,
          ${ALIAS}.product_code,

          ${ALIAS}.price_id
            AS price_id,

          ${ALIAS}.sale_price
            AS sale_price,

          ${ALIAS}.price_id
            AS tabela_preco_id,

          ${ALIAS}.sale_price
            AS preco_venda,

          ${ALIAS}.markup_percent,
          ${ALIAS}.gross_profit_pct,
          ${ALIAS}.created_at,
          ${ALIAS}.updated_at,
          ${ALIAS}.user_id

        FROM ${TB} ${ALIAS}

        WHERE
          ${ALIAS}.product_code = $1

          AND
          ${ALIAS}.price_id = $2

        LIMIT 1
        `,
        [
          code,
          SINGLE_PRICE_ID,
        ],
      );

    const mapped =
      rows.map(mapRow);

    return {
      ok: true,
      mode: 'SINGLE',

      defaultPriceId:
        SINGLE_PRICE_ID,

      rows: mapped,
      data: mapped,
    };
  } catch (error) {
    console.error(
      '[productsPrices.single:getPricesByProduct] error:',
      error,
    );

    return {
      ok: false,
      statusCode: 500,

      error:
        'Failed to list the single product price.',
    };
  }
}

/**
 * Cria ou atualiza exclusivamente
 * price_id = 1.
 *
 * O vínculo agora é:
 *
 * product_code + price_id
 */
export async function upsertProductPrices(
  productCode,
  prices,
) {
  const code =
    normalizeProductCode(
      productCode,
    );

  if (!code) {
    return invalidProductCodeResult();
  }

  const list =
    Array.isArray(prices)
      ? prices.filter(Boolean)
      : [];

  if (!list.length) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PRICES_REQUIRED',
      error:
        'prices must contain one item.',
    };
  }

  if (list.length > 1) {
    return {
      ok: false,
      statusCode: 422,

      code:
        'PRODUCT_PRICE_MODE_SINGLE',

      error:
        'O modo de preço único permite somente um preço por produto.',

      details: {
        allowedPriceId:
          SINGLE_PRICE_ID,

        receivedPrices:
          list.length,
      },
    };
  }

  const receivedPriceId =
    list[0].price_id ??
    list[0].tabela_preco_id;

  if (
    receivedPriceId !==
    undefined &&
    receivedPriceId !== null &&
    Number(receivedPriceId) !==
    SINGLE_PRICE_ID
  ) {
    return invalidSinglePriceResult(
      receivedPriceId,
    );
  }

  const item =
    normalizePriceInput(
      list[0],
    );

  if (
    item.user_id !== null &&
    !Number.isInteger(
      item.user_id,
    )
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
          SINGLE_PRICE_ID,
          item.sale_price,
          item.markup_percent,
          item.gross_profit_pct,
          item.user_id,
        ],
      );

    const saved =
      mapRow(rows[0]);

    return {
      ok: true,
      mode: 'SINGLE',

      defaultPriceId:
        SINGLE_PRICE_ID,

      rows: [saved],
      data: [saved],
    };
  } catch (error) {
    console.error(
      '[productsPrices.single:upsertProductPrices] error:',
      error,
    );

    return {
      ok: false,
      statusCode: 500,

      error:
        'Failed to upsert the single product price.',
    };
  }
}

/**
 * Atualiza somente price_id = 1.
 */
export async function updateProductPrice(
  productCode,
  priceId,
  patch = {},
) {
  const code =
    normalizeProductCode(
      productCode,
    );

  if (!code) {
    return invalidProductCodeResult();
  }

  const requestedPriceId =
    Number(priceId);

  if (
    !Number.isInteger(
      requestedPriceId,
    )
  ) {
    return {
      ok: false,
      statusCode: 400,

      error:
        'productCode and priceId are required.',
    };
  }

  if (
    requestedPriceId !==
    SINGLE_PRICE_ID
  ) {
    return invalidSinglePriceResult(
      priceId,
    );
  }

  const item =
    normalizePriceInput(
      patch,
    );

  if (
    item.user_id !== null &&
    !Number.isInteger(
      item.user_id,
    )
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
          SINGLE_PRICE_ID,
          item.sale_price,
          item.markup_percent,
          item.gross_profit_pct,
          item.user_id,
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

    const updated =
      mapRow(rows[0]);

    return {
      ok: true,
      rows: [updated],
      data: updated,
    };
  } catch (error) {
    console.error(
      '[productsPrices.single:updateProductPrice] error:',
      error,
    );

    return {
      ok: false,
      statusCode: 500,

      error:
        'Failed to update the single product price.',
    };
  }
}

/**
 * Remove somente price_id = 1.
 */
export async function deleteProductPrice(
  productCode,
  priceId,
) {
  const code =
    normalizeProductCode(
      productCode,
    );

  if (!code) {
    return invalidProductCodeResult();
  }

  const requestedPriceId =
    Number(priceId);

  if (
    !Number.isInteger(
      requestedPriceId,
    )
  ) {
    return {
      ok: false,
      statusCode: 400,

      error:
        'productCode and priceId are required.',
    };
  }

  if (
    requestedPriceId !==
    SINGLE_PRICE_ID
  ) {
    return invalidSinglePriceResult(
      priceId,
    );
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
          SINGLE_PRICE_ID,
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

    const removed =
      mapRow(rows[0]);

    return {
      ok: true,
      rows: [removed],
      data: removed,
    };
  } catch (error) {
    console.error(
      '[productsPrices.single:deleteProductPrice] error:',
      error,
    );

    return {
      ok: false,
      statusCode: 500,

      error:
        'Failed to delete the single product price.',
    };
  }
}

export default {
  SINGLE_PRICE_ID,
  getPricesByProduct,
  upsertProductPrices,
  updateProductPrice,
  deleteProductPrice,
};