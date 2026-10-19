// ╔══════════════════════════════════════════════════════════════════════╗
// ║ stockFromBudgetsService.js — Baixa/estorno de estoque por orçamento     ║
// ║ CONSART ERP | Estoque simples e por lote | Idempotência por NF-e    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import productsStockManager from '../repositories/productsStock/productsStock.manager.js';

// Colunas candidatas para SKU na tabela products
const SKU_CANDIDATES = [
  'codigo',
  'sku',
  'product_code',
  'codigo_produto',
  'codprod',
  'code',
];

let PRODUCTS_SKU_COL = null;

function aggregateSimpleMovements(
  movements = [],
) {
  const aggregated = new Map();

  for (const movement of movements) {
    const productStockId =
      Number(movement.product_stock_id);

    if (
      !Number.isFinite(productStockId) ||
      productStockId <= 0
    ) {
      continue;
    }

    const current =
      aggregated.get(productStockId) || {
        product_stock_id:
          productStockId,

        lot_id: null,
        qty: 0,
      };

    current.qty +=
      Number(movement.qty || 0);

    aggregated.set(
      productStockId,
      current,
    );
  }

  return Array.from(
    aggregated.values(),
  );
}

/* --------------------------------------------------------------------- */
/* Descobre automaticamente qual coluna é o SKU em public.products       */
/* --------------------------------------------------------------------- */
async function resolveProductsSkuColumn() {
  if (PRODUCTS_SKU_COL) return PRODUCTS_SKU_COL;

  const { rows } = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = 'products'
        AND column_name = ANY($1)
      LIMIT 1;
    `,
    [SKU_CANDIDATES],
  );

  if (!rows.length) {
    throw new Error(
      '[STOCK][AUTO] Não foi possível detectar a coluna de SKU em public.products.',
    );
  }

  PRODUCTS_SKU_COL = rows[0].column_name;
  console.log(
    `[STOCK][AUTO] Coluna de SKU detectada em public.products: ${PRODUCTS_SKU_COL}`,
  );
  return PRODUCTS_SKU_COL;
}

/* --------------------------------------------------------------------- */
/* Normaliza itens do orçamento → [{ sku, quantity }]                        */
/* Aceita:                                                               */
/*   - budget: { header, items }                                          */
/*   - array de itens direto                                             */
/*   - qualquer objeto com .items                                        */
/* --------------------------------------------------------------------- */
function normalizeBudgetItems(budgetOrItems) {
  let items = [];

  if (Array.isArray(budgetOrItems)) {
    items = budgetOrItems;
  } else if (budgetOrItems?.items && Array.isArray(budgetOrItems.items)) {
    items = budgetOrItems.items;
  } else if (budgetOrItems?.budget?.items && Array.isArray(budgetOrItems.budget.items)) {
    items = budgetOrItems.budget.items;
  }

  const norm = items
    .map((it) => {
      const sku =
        (it.sku ??
          it.codigo ??
          it.product_code ??
          it.codprod ??
          it.code ??
          '')
          .toString()
          .trim();

      const rawQty = Number(
        it.quantity ??
        it.qtd ??
        it.qtd_comercial ??
        it.qtd_venda ??
        0
      );

      const unitText = String(
        it.unit_display ??
        it.unit_lookup ??
        it.unit ??
        it.unidade ??
        it.unidade_venda ??
        ''
      )
        .toUpperCase()
        .trim();

      let factor = Number(
        it.unit_factor ??
        it.factor ??
        it.fator ??
        it.conversion_factor ??
        1
      );

      const matchFactorFromUnit = unitText.match(/(?:CX|FD|PCT|SC|KIT)\.?\s*(\d+)/i);

      if ((!Number.isFinite(factor) || factor <= 1) && matchFactorFromUnit) {
        factor = Number(matchFactorFromUnit[1]);
      }

      if (!Number.isFinite(factor) || factor <= 0) {
        factor = 1;
      }

      const qty = rawQty * factor;

      console.log('[STOCK][ITEM_DEBUG]', {
        sku,
        unitText,
        rawQty,
        factor,
        finalQty: qty,
        keys: Object.keys(it),
      });

      const lotId =
        it.lot_id != null && Number.isFinite(Number(it.lot_id)) && Number(it.lot_id) > 0
          ? Number(it.lot_id)
          : null;

      return { sku, qty, lot_id: lotId };
    })
    .filter((x) => x.sku && Number.isFinite(x.qty) && x.qty > 0);

  return norm;
}

/* --------------------------------------------------------------------- */
/* Carrega product_stock_id por SKU                                      */
/* --------------------------------------------------------------------- */
async function loadStockIdsBySku(skus) {
  if (!skus.length) return {};

  const skuCol = await resolveProductsSkuColumn();

  const { rows } = await pool.query(
    `
      SELECT
        p.product_id,
        p."${skuCol}" AS sku,
        p.product_stock_id
      FROM public.products p
      WHERE p."${skuCol}" = ANY($1)
    `,
    [skus],
  );

  const map = {};
  for (const row of rows) {
    if (row.sku && row.product_stock_id) {
      map[row.sku] = {
        product_id: row.product_id,
        product_stock_id: row.product_stock_id,
      };
    }
  }

  return map;
}

/* --------------------------------------------------------------------- */
/* Monta movimentos de estoque agregados por product_stock_id            */
/* Retorno: [{ product_stock_id, qty }]                                  */
/* --------------------------------------------------------------------- */
async function buildStockMovements(budgetOrItems) {
  const normItems = normalizeBudgetItems(budgetOrItems);
  if (!normItems.length) {
    console.log('[STOCK][AUTO] Nenhum item válido para movimentar estoque.');
    return [];
  }

  const uniqueSkus = Array.from(new Set(normItems.map((i) => i.sku)));
  const skuToStock = await loadStockIdsBySku(uniqueSkus);

  const stockMap = new Map();

  for (const it of normItems) {
    const found = skuToStock[it.sku];

    if (!found || !found.product_stock_id) {
      console.warn(
        '[STOCK][WARN] SKU sem product_stock_id, ignorando na baixa de estoque:',
        it.sku,
      );
      continue;
    }

    const psId = found.product_stock_id;
    const lotId = it.lot_id ?? null;
    const key = `${psId}||${lotId ?? 'NULL'}`;

    const prev = stockMap.get(key) || {
      product_stock_id: psId,
      lot_id: lotId,
      qty: 0,
    };

    prev.qty += it.qty;
    stockMap.set(key, prev);
  }

  return Array.from(stockMap.values());
}

function createStockError(
  message,
  code,
  details = {},
  statusCode = 422,
) {
  const error = new Error(message);

  error.code = code;
  error.statusCode = statusCode;
  error.status = statusCode;
  error.details = details;

  return error;
}

async function loadCurrentStockQuantity(client, productStockId) {
  const { rows } = await client.query(
    `SELECT stock_qty
       FROM public."productsStock"
      WHERE product_stock_id = $1`,
    [productStockId],
  );

  if (!rows[0]) {
    throw createStockError(
      'Registro mestre de estoque não encontrado após a movimentação.',
      'PRODUCT_STOCK_NOT_FOUND_AFTER_MOVEMENT',
      { productStockId },
      404,
    );
  }

  return Number(rows[0].stock_qty || 0);
}

async function recordBudgetProductMovement(client, {
  attempt,
  attemptItem,
  movement,
  movementType,
  previousStock,
  newStock,
  unit,
  lotCode = null,
  stockMode,
}) {
  const attemptItemId = Number(attemptItem?.attempt_item_id);
  const productCode = String(attemptItem?.product_code ?? '').trim();
  const type = String(movementType || '').trim().toUpperCase();
  const action = type === 'ENTRADA' ? 'ROLLBACK' : 'APPLY';
  const originId = String(attempt?.invoice_id ?? attempt?.attempt_id);
  const nfeNumber = attempt?.nfe_number == null
    ? null
    : String(attempt.nfe_number);

  if (!attemptItemId || !productCode) {
    throw createStockError(
      'Não foi possível identificar o item do orçamento para a movimentação.',
      'INVALID_PRODUCT_MOVEMENT_SOURCE',
      { attemptItemId, productCode },
    );
  }

  const metadata = {
    source: 'budgetsNfeAttempts',
    budget_id: Number(attempt.budget_id),
    attempt_id: Number(attempt.attempt_id),
    attempt_item_id: attemptItemId,
    invoice_id: attempt.invoice_id == null ? null : Number(attempt.invoice_id),
    stock_mode: stockMode,
    stock_action: action,
  };

  const { rows } = await client.query(
    `INSERT INTO public."productMovements" (
       product_code, movement_type, origin_module, origin_table,
       origin_id, quantity, previous_stock, new_stock, unit,
       lot_code, nfe_key, nfe_number, notes, metadata
     )
     SELECT
       $1, $2, 'invoicesIssued', 'invoicesIssued', $3,
       $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
     WHERE NOT EXISTS (
       SELECT 1
         FROM public."productMovements" pm
        WHERE pm.movement_type = $2
          AND pm.origin_module = 'invoicesIssued'
          AND pm.origin_id = $3
          AND pm.product_code = $1
          AND pm.metadata->>'attempt_item_id' = $13
          AND pm.metadata->>'stock_action' = $14
     )
     RETURNING *`,
    [
      productCode,
      type,
      originId,
      Number(movement?.qty || 0),
      Number(previousStock),
      Number(newStock),
      String(unit || 'UN'),
      lotCode,
      attempt?.access_key || null,
      nfeNumber,
      type === 'ENTRADA'
        ? `Estorno de estoque da NF-e ${nfeNumber || ''}`.trim()
        : `Baixa de estoque da NF-e ${nfeNumber || ''}`.trim(),
      JSON.stringify(metadata),
      String(attemptItemId),
      action,
    ],
  );

  return rows[0] || null;
}

/**
 * Restaura uma quantidade anteriormente consumida.
 *
 * O trigger de productsStockLots recalcula automaticamente
 * productsStock.stock_qty.
 */
async function restoreConsumedLot({
  productStockId,
  lotId,
  qty,
}) {
  const stockId = Number(productStockId);
  const normalizedLotId = Number(lotId);
  const normalizedQty = Number(qty);

  if (
    !Number.isFinite(stockId) ||
    stockId <= 0
  ) {
    throw createStockError(
      'product_stock_id inválido.',
      'INVALID_PRODUCT_STOCK_ID',
      {
        productStockId,
      },
      400,
    );
  }

  if (
    !Number.isFinite(normalizedLotId) ||
    normalizedLotId <= 0
  ) {
    throw createStockError(
      'O estorno com controle por lote exige lot_id.',
      'BUDGET_ITEM_LOT_REQUIRED',
      {
        productStockId: stockId,
        lotId,
      },
    );
  }

  if (
    !Number.isFinite(normalizedQty) ||
    normalizedQty <= 0
  ) {
    throw createStockError(
      'Quantidade inválida para estorno.',
      'INVALID_STOCK_QUANTITY',
      {
        productStockId: stockId,
        lotId: normalizedLotId,
        qty,
      },
      400,
    );
  }

  const { rows } = await pool.query(
    `
    UPDATE public."productsStockLots"
    SET
      qty_on_hand =
        COALESCE(qty_on_hand, 0) + $3,

      updated_at = NOW()
    WHERE product_stock_id = $1
      AND lot_id = $2
      AND COALESCE(is_active, true) = true
      AND deleted_at IS NULL
    RETURNING
      lot_id,
      product_stock_id,
      lot_code,
      qty_on_hand,
      qty_reserved,
      (
        qty_on_hand -
        qty_reserved
      ) AS qty_available
    `,
    [
      stockId,
      normalizedLotId,
      normalizedQty,
    ],
  );

  if (!rows.length) {
    throw createStockError(
      'Lote não encontrado para realizar o estorno.',
      'LOT_NOT_FOUND',
      {
        productStockId: stockId,
        lotId: normalizedLotId,
      },
      404,
    );
  }

  return rows[0];
}

/* --------------------------------------------------------------------- */
/* 🔻 DEBITAR ESTOQUE (baixa)                                            */
/*   - Recebe o mesmo payload do buildNFeFromBudget (header + items)      */
/*   - Ou array de itens direto                                          */
/*   - Usa productsStockApi.adjust(id, -qty)                             */
/* --------------------------------------------------------------------- */
export async function debitBudgetStock(
  budgetOrItems,
  {
    scopeType = 'GLOBAL',
    scopeId = 1,
  } = {},
) {
  const scopeOptions = {
    scopeType,
    scopeId,
  };

  const stockMode =
    await productsStockManager
      .resolveProductsStockMode(
        scopeOptions,
      );

  let movements =
    await buildStockMovements(
      budgetOrItems,
    );

  if (!stockMode.requireLot) {
    movements =
      aggregateSimpleMovements(
        movements,
      );
  }

  if (!movements.length) {
    console.log(
      '[STOCK][DEBIT] Nenhum movimento de estoque calculado.',
    );

    return {
      ok: true,
      moved: 0,
      movements: [],
      stockMode: stockMode.mode,
    };
  }

  console.log(
    '[STOCK][DEBIT] Movimentos calculados:',
    {
      mode: stockMode.mode,
      movements,
    },
  );

  const results = [];

  for (const movement of movements) {
    const {
      product_stock_id: productStockId,
      lot_id: lotId,
      qty,
    } = movement;

    if (stockMode.isSimple) {
      const row =
        await productsStockManager.adjust(
          productStockId,
          -qty,
          scopeOptions,
        );

      results.push({
        product_stock_id:
          productStockId,

        lot_id: null,
        qty,
        row,
      });

      console.log(
        `[STOCK][DEBIT][SIMPLE] product_stock_id=${productStockId} → -${qty}`,
      );

      continue;
    }

    if (!lotId) {
      throw createStockError(
        'O controle de estoque por lote exige lot_id em todos os itens do orçamento.',
        'BUDGET_ITEM_LOT_REQUIRED',
        {
          productStockId,
          qty,
        },
      );
    }

    const row =
      await productsStockManager.consumeLot(
        {
          lot_id: lotId,
          qty,
        },
        scopeOptions,
      );

    results.push({
      product_stock_id:
        productStockId,

      lot_id:
        lotId,

      qty,
      row,
    });

    console.log(
      `[STOCK][DEBIT][LOT] product_stock_id=${productStockId} lot_id=${lotId} → -${qty}`,
    );
  }

  return {
    ok: true,
    moved: results.length,
    movements: results,
    stockMode: stockMode.mode,
  };
}

/* --------------------------------------------------------------------- */
/* 🔺 ESTORNAR ESTOQUE (rollback)                                        */
/*   - Mesmo formato de entrada                                          */
/*   - Usa productsStockApi.adjust(id, +qty)                             */
/* --------------------------------------------------------------------- */
export async function rollbackBudgetStock(
  budgetOrItems,
  {
    scopeType = 'GLOBAL',
    scopeId = 1,
  } = {},
) {
  const scopeOptions = {
    scopeType,
    scopeId,
  };

  const stockMode =
    await productsStockManager
      .resolveProductsStockMode(
        scopeOptions,
      );

  let movements =
    await buildStockMovements(
      budgetOrItems,
    );

  if (!stockMode.requireLot) {
    movements =
      aggregateSimpleMovements(
        movements,
      );
  }

  if (!movements.length) {
    console.log(
      '[STOCK][ROLLBACK] Nenhum movimento de estoque calculado.',
    );

    return {
      ok: true,
      moved: 0,
      movements: [],
      stockMode: stockMode.mode,
    };
  }

  console.log(
    '[STOCK][ROLLBACK] Movimentos calculados:',
    {
      mode: stockMode.mode,
      movements,
    },
  );

  const results = [];

  for (const movement of movements) {
    const {
      product_stock_id: productStockId,
      lot_id: lotId,
      qty,
    } = movement;

    if (stockMode.isSimple) {
      const row =
        await productsStockManager.adjust(
          productStockId,
          qty,
          scopeOptions,
        );

      results.push({
        product_stock_id:
          productStockId,

        lot_id: null,
        qty,
        row,
      });

      console.log(
        `[STOCK][ROLLBACK][SIMPLE] product_stock_id=${productStockId} → +${qty}`,
      );

      continue;
    }

    if (!lotId) {
      throw createStockError(
        'O estorno com controle por lote exige o lot_id originalmente consumido.',
        'BUDGET_ITEM_LOT_REQUIRED',
        {
          productStockId,
          qty,
        },
      );
    }

    const row =
      await restoreConsumedLot({
        productStockId,
        lotId,
        qty,
      });

    results.push({
      product_stock_id:
        productStockId,

      lot_id:
        lotId,

      qty,
      row,
    });

    console.log(
      `[STOCK][ROLLBACK][LOT] product_stock_id=${productStockId} lot_id=${lotId} → +${qty}`,
    );
  }

  return {
    ok: true,
    moved: results.length,
    movements: results,
    stockMode: stockMode.mode,
  };
}

/* ===================================================================== */
/* APLICAR ESTOQUE AUTORIZADO UMA ÚNICA VEZ                             */
/* ===================================================================== */
export async function applyStockFromBudget(
  budget,
  { attemptId, scopeType = 'GLOBAL', scopeId = 1 } = {},
) {
  const id = Number(attemptId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createStockError(
      'attemptId inválido para aplicação do estoque.',
      'INVALID_NFE_ATTEMPT_ID',
      { attemptId },
      400,
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT attempt_id, budget_id, operation_type_id,
              invoice_id, nfe_number, access_key,
              authorized_at, stock_applied_at
         FROM public."budgetsNfeAttempts"
        WHERE attempt_id = $1
        FOR UPDATE`,
      [id],
    );
    const attempt = rows[0];

    if (!attempt) {
      throw createStockError(
        'Tentativa de NF-e não encontrada.',
        'BUDGET_NFE_ATTEMPT_NOT_FOUND',
        { attemptId: id },
        404,
      );
    }
    if (!attempt.authorized_at) {
      throw createStockError(
        'A NF-e ainda não está autorizada.',
        'BUDGET_NFE_NOT_AUTHORIZED',
        { attemptId: id },
        409,
      );
    }

    const receivedBudgetId = Number(
      budget?.budget_id ?? budget?.header?.budget_id,
    );

    if (
      Number.isSafeInteger(receivedBudgetId) &&
      receivedBudgetId > 0 &&
      receivedBudgetId !== Number(attempt.budget_id)
    ) {
      throw createStockError(
        'O orçamento informado não pertence à tentativa de NF-e.',
        'BUDGET_NFE_ATTEMPT_MISMATCH',
        {
          attemptId: id,
          expectedBudgetId: Number(attempt.budget_id),
          receivedBudgetId,
        },
        409,
      );
    }

    if (attempt.stock_applied_at) {
      await client.query('COMMIT');
      return {
        ok: true,
        applied: false,
        alreadyApplied: true,
        attemptId: id,
        stockAppliedAt: attempt.stock_applied_at,
        moved: 0,
        movements: [],
      };
    }

    const operation = await client.query(
      `SELECT moves_stock
         FROM public."nfeOperationTypes"
        WHERE operation_type_id = $1
          AND active = TRUE
        LIMIT 1`,
      [attempt.operation_type_id],
    );
    if (!operation.rowCount) {
      throw createStockError(
        'A operação fiscal não existe ou está inativa.',
        'BUDGET_OPERATION_TYPE_INVALID',
        { operationTypeId: attempt.operation_type_id },
      );
    }

    if (operation.rows[0].moves_stock !== true) {
      await client.query(
        `UPDATE public."budgetsNfeAttempts"
            SET stock_applied_at = NOW(), updated_at = NOW()
          WHERE attempt_id = $1`,
        [id],
      );
      await client.query('COMMIT');
      return {
        ok: true,
        applied: false,
        alreadyApplied: false,
        skipped: true,
        reason: 'OPERATION_DOES_NOT_MOVE_STOCK',
        attemptId: id,
        moved: 0,
        movements: [],
      };
    }

    const itemResult = await client.query(
      `SELECT *
         FROM public."budgetsNfeAttemptItems"
        WHERE attempt_id = $1
          AND stock_applied_at IS NULL
        ORDER BY item_number, attempt_item_id
        FOR UPDATE`,
      [id],
    );

    if (!itemResult.rowCount) {
      throw createStockError(
        'A tentativa de NF-e não possui itens pendentes para baixa.',
        'BUDGET_NFE_ATTEMPT_WITHOUT_STOCK_ITEMS',
        { attemptId: id },
      );
    }

    const movements = [];

    for (const item of itemResult.rows) {
      const snapshot =
        item.budget_item_snapshot &&
        typeof item.budget_item_snapshot === 'object' &&
        !Array.isArray(item.budget_item_snapshot)
          ? item.budget_item_snapshot
          : {};

      const sourceItem = {
        ...snapshot,
        product_code: item.product_code ?? snapshot.product_code,
        quantity: snapshot.quantity ?? item.quantity,
        conversion_factor:
          snapshot.conversion_factor ?? snapshot.unit_factor ?? 1,
        unit_code: snapshot.unit_code ?? item.commercial_unit ?? 'UN',
        lot_id: item.lot_id ?? snapshot.lot_id ?? null,
      };

      const result = await debitBudgetStock(
        [sourceItem],
        { scopeType, scopeId },
      );
      const appliedQuantity = result.movements.reduce(
        (total, movement) => total + Number(movement.qty || 0),
        0,
      );

      if (!(appliedQuantity > 0)) {
        throw createStockError(
          `O item ${item.item_number} não gerou movimento de estoque.`,
          'BUDGET_NFE_ITEM_WITHOUT_STOCK_MOVEMENT',
          { attemptId: id, attemptItemId: item.attempt_item_id },
        );
      }

      for (const movement of result.movements) {
        const newStock = await loadCurrentStockQuantity(
          client,
          movement.product_stock_id,
        );

        await recordBudgetProductMovement(client, {
          attempt,
          attemptItem: item,
          movement,
          movementType: 'SAIDA',
          previousStock: newStock + Number(movement.qty || 0),
          newStock,
          unit: sourceItem.unit_code,
          lotCode: movement.row?.lot_code ?? null,
          stockMode: result.stockMode,
        });
      }

      await client.query(
        `UPDATE public."budgetsNfeAttemptItems"
            SET stock_applied_at = NOW(),
                stock_applied_quantity = $2
          WHERE attempt_item_id = $1
            AND stock_applied_at IS NULL`,
        [item.attempt_item_id, appliedQuantity],
      );

      movements.push(...result.movements.map((movement) => ({
        ...movement,
        attempt_item_id: item.attempt_item_id,
        item_number: item.item_number,
      })));
    }

    const pending = await client.query(
      `SELECT COUNT(*)::integer AS total
         FROM public."budgetsNfeAttemptItems"
        WHERE attempt_id = $1
          AND stock_applied_at IS NULL`,
      [id],
    );
    if (Number(pending.rows[0]?.total || 0) > 0) {
      throw createStockError(
        'Ainda existem itens pendentes de baixa de estoque.',
        'BUDGET_NFE_STOCK_ITEMS_PENDING',
        { attemptId: id },
      );
    }

    const completed = await client.query(
      `UPDATE public."budgetsNfeAttempts"
          SET stock_applied_at = NOW(), updated_at = NOW()
        WHERE attempt_id = $1
        RETURNING stock_applied_at`,
      [id],
    );
    await client.query('COMMIT');

    return {
      ok: true,
      applied: true,
      alreadyApplied: false,
      skipped: false,
      attemptId: id,
      stockAppliedAt: completed.rows[0]?.stock_applied_at,
      moved: movements.length,
      movements,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve original. */ }
    throw error;
  } finally {
    client.release();
  }
}

/* ===================================================================== */
/* ESTORNAR ESTOQUE DE NF-e CANCELADA UMA ÚNICA VEZ                     */
/* ===================================================================== */

export async function rollbackStockFromBudget(
  {
    attemptId,
    scopeType = 'GLOBAL',
    scopeId = 1,
  } = {},
) {
  const id = Number(attemptId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createStockError(
      'attemptId inválido para estorno do estoque.',
      'INVALID_NFE_ATTEMPT_ID',
      { attemptId },
      400,
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const attemptResult = await client.query(
      `
        SELECT
          a.attempt_id,
          a.budget_id,
          a.invoice_id,
          a.nfe_number,
          a.access_key,
          a.stock_applied_at,
          a.stock_reversed_at,
          s.code AS status_code
        FROM public."budgetsNfeAttempts" a
        JOIN public."nfeStatusMap" s
          ON s.nfe_status_id = a.nfe_status_id
        WHERE a.attempt_id = $1
        FOR UPDATE OF a
      `,
      [id],
    );

    const attempt = attemptResult.rows[0];

    if (!attempt) {
      throw createStockError(
        'Tentativa de NF-e não encontrada.',
        'BUDGET_NFE_ATTEMPT_NOT_FOUND',
        { attemptId: id },
        404,
      );
    }

    const normalizedStatus = String(
      attempt.status_code || '',
    ).trim().toUpperCase();

    if (
      ![
        'CANCELADA',
        'CANCELADO',
        'CANCELLED',
        'CANCELED',
      ].includes(normalizedStatus)
    ) {
      throw createStockError(
        'A NF-e não está cancelada.',
        'BUDGET_NFE_NOT_CANCELLED',
        {
          attemptId: id,
          status: attempt.status_code,
        },
        409,
      );
    }

    if (attempt.stock_reversed_at) {
      await client.query('COMMIT');

      return {
        ok: true,
        reversed: false,
        alreadyReversed: true,
        skipped: false,
        attemptId: id,
        stockReversedAt: attempt.stock_reversed_at,
        moved: 0,
        movements: [],
      };
    }

    if (!attempt.stock_applied_at) {
      const completed = await client.query(
        `
          UPDATE public."budgetsNfeAttempts"
          SET
            stock_reversed_at = NOW(),
            updated_at = NOW()
          WHERE attempt_id = $1
          RETURNING stock_reversed_at
        `,
        [id],
      );

      await client.query('COMMIT');

      return {
        ok: true,
        reversed: false,
        alreadyReversed: false,
        skipped: true,
        reason: 'STOCK_WAS_NOT_APPLIED',
        attemptId: id,
        stockReversedAt:
          completed.rows[0]?.stock_reversed_at,
        moved: 0,
        movements: [],
      };
    }

    const itemResult = await client.query(
      `
        SELECT *
        FROM public."budgetsNfeAttemptItems"
        WHERE attempt_id = $1
          AND stock_applied_at IS NOT NULL
          AND stock_reversed_at IS NULL
        ORDER BY item_number, attempt_item_id
        FOR UPDATE
      `,
      [id],
    );

    const movements = [];

    for (const item of itemResult.rows) {
      const appliedQuantity = Number(
        item.stock_applied_quantity,
      );

      if (
        !Number.isFinite(appliedQuantity) ||
        appliedQuantity <= 0
      ) {
        throw createStockError(
          `O item ${item.item_number} não possui quantidade aplicada válida.`,
          'INVALID_APPLIED_STOCK_QUANTITY',
          {
            attemptId: id,
            attemptItemId: item.attempt_item_id,
            stockAppliedQuantity:
              item.stock_applied_quantity,
          },
        );
      }

      const snapshot =
        item.budget_item_snapshot &&
        typeof item.budget_item_snapshot === 'object' &&
        !Array.isArray(item.budget_item_snapshot)
          ? item.budget_item_snapshot
          : {};

      const sourceItem = {
        ...snapshot,

        product_code:
          item.product_code ??
          snapshot.product_code,

        // The stored quantity already includes the conversion factor.
        quantity: appliedQuantity,
        conversion_factor: 1,
        unit_factor: 1,

        unit_code:
          snapshot.unit_code ??
          item.commercial_unit ??
          'UN',

        lot_id:
          item.lot_id ??
          snapshot.lot_id ??
          null,
      };

      const result = await rollbackBudgetStock(
        [sourceItem],
        {
          scopeType,
          scopeId,
        },
      );

      if (!result.movements.length) {
        throw createStockError(
          `O item ${item.item_number} não gerou estorno de estoque.`,
          'BUDGET_NFE_ITEM_WITHOUT_STOCK_ROLLBACK',
          {
            attemptId: id,
            attemptItemId: item.attempt_item_id,
          },
        );
      }

      for (const movement of result.movements) {
        const newStock = await loadCurrentStockQuantity(
          client,
          movement.product_stock_id,
        );

        await recordBudgetProductMovement(client, {
          attempt,
          attemptItem: item,
          movement,
          movementType: 'ENTRADA',
          previousStock: newStock - Number(movement.qty || 0),
          newStock,
          unit: sourceItem.unit_code,
          lotCode: movement.row?.lot_code ?? null,
          stockMode: result.stockMode,
        });
      }

      await client.query(
        `
          UPDATE public."budgetsNfeAttemptItems"
          SET stock_reversed_at = NOW()
          WHERE attempt_item_id = $1
            AND stock_reversed_at IS NULL
        `,
        [item.attempt_item_id],
      );

      movements.push(
        ...result.movements.map((movement) => ({
          ...movement,
          attempt_item_id:
            item.attempt_item_id,
          item_number:
            item.item_number,
        })),
      );
    }

    const pendingResult = await client.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM public."budgetsNfeAttemptItems"
        WHERE attempt_id = $1
          AND stock_applied_at IS NOT NULL
          AND stock_reversed_at IS NULL
      `,
      [id],
    );

    if (Number(pendingResult.rows[0]?.total || 0) > 0) {
      throw createStockError(
        'Ainda existem itens pendentes de estorno.',
        'BUDGET_NFE_STOCK_ROLLBACK_PENDING',
        { attemptId: id },
      );
    }

    const completed = await client.query(
      `
        UPDATE public."budgetsNfeAttempts"
        SET
          stock_reversed_at = NOW(),
          updated_at = NOW()
        WHERE attempt_id = $1
        RETURNING stock_reversed_at
      `,
      [id],
    );

    await client.query('COMMIT');

    return {
      ok: true,
      reversed: true,
      alreadyReversed: false,
      skipped: false,
      attemptId: id,
      stockReversedAt:
        completed.rows[0]?.stock_reversed_at,
      moved: movements.length,
      movements,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error.
    }

    throw error;
  } finally {
    client.release();
  }
}

/* --------------------------------------------------------------------- */
/* Export default (facilita import macro)                                 */
/* --------------------------------------------------------------------- */
export default {
  debitBudgetStock,
  rollbackBudgetStock,
  applyStockFromBudget,
  rollbackStockFromBudget,
};
