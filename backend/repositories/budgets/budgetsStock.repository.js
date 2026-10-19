// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsStock.repository.js — Estoque disponível e override           ║
// ║ resolveAvailableStock / validateStockOrOverride                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getBudgetSettings } from '../budgetSettings/budgetSettings.index.js';
import { verifyBudgetStockOverrideToken } from '../../services/security/budgetAuthorizationToken.js';
import { TB_PSL } from './budgets.constants.js';
import {
  safeString,
  getTableColumns,
  tableExists,
  pickFirstExisting,
} from './budgets.utils.js';
import { resolveBudgetStockMode } from './budgetsModes.repository.js';

// ----------------------------------------------------------------------
// Override / Stock helpers
// ----------------------------------------------------------------------

export async function resolveLotAvailableStock(client, lotId) {
  const n = Number(lotId);
  if (!Number.isFinite(n) || n <= 0) return null;

  const exists = await tableExists(client, 'public', 'productsStockLots');
  if (!exists) return null;

  const cols = await getTableColumns(client, 'public', 'productsStockLots');
  if (!cols.size) return null;

  const stockCol = pickFirstExisting(cols, [
    'qty_available',
    'qty_on_hand',
    'saldo',
    'available',
    'quantity',
    'stock_quantity',
  ]);

  if (!stockCol) return null;

  const sql = `
      SELECT COALESCE("${stockCol}", 0) AS stock
      FROM ${TB_PSL}
      WHERE lot_id = $1
      LIMIT 1
    `;
  const r = await client.query(sql, [n]);

  if (!r.rowCount) return 0;
  return Number(r.rows[0]?.stock || 0);
}

export async function resolveProductAvailableStock(client, { product_id, sku }) {
  const pidRaw = safeString(product_id, 100);
  const skuRaw = safeString(sku, 100);

  const hasProducts = await tableExists(client, 'public', 'products');
  if (!hasProducts) return 0;

  const productsCols = await getTableColumns(client, 'public', 'products');
  const hasProductsStock = await tableExists(client, 'public', 'productsStock');
  const stockCols = hasProductsStock
    ? await getTableColumns(client, 'public', 'productsStock')
    : new Set();

  const productsPkCol = pickFirstExisting(productsCols, ['product_id', 'id']);
  const productsCodeCol = pickFirstExisting(productsCols, ['product_code', 'sku', 'code']);
  const productsStockFkCol = pickFirstExisting(productsCols, ['product_stock_id']);
  const stockPkCol = pickFirstExisting(stockCols, ['product_stock_id', 'id']);
  const stockValueCol = pickFirstExisting(stockCols, [
    'qty_available',
    'current_stock',
    'stock_quantity',
    'quantity',
    'saldo_atual',
    'saldo',
    'available',
    'qty_on_hand',
    'estoque_atual',
  ]);

  if (hasProductsStock && stockValueCol && productsStockFkCol && stockPkCol) {
    const where = [];
    const args = [];
    let ai = 1;

    if (pidRaw && productsPkCol) {
      where.push(`CAST(p."${productsPkCol}" AS TEXT) = $${ai}`);
      args.push(pidRaw);
      ai++;
    }

    if (skuRaw && productsCodeCol) {
      where.push(`p."${productsCodeCol}" = $${ai}`);
      args.push(skuRaw);
      ai++;
    }

    if (where.length) {
      const sql = `
          SELECT COALESCE(ps."${stockValueCol}", 0) AS stock
          FROM public."products" p
          LEFT JOIN public."productsStock" ps
            ON ps."${stockPkCol}" = p."${productsStockFkCol}"
          WHERE ${where.join(' OR ')}
          LIMIT 1
        `;
      const r = await client.query(sql, args);
      if (r.rowCount) {
        return Number(r.rows[0]?.stock || 0);
      }
    }
  }

  const directProductStockCol = pickFirstExisting(productsCols, [
    'qty_available',
    'current_stock',
    'stock_quantity',
    'quantity',
    'saldo_atual',
    'saldo',
    'available',
    'qty_on_hand',
    'estoque_atual',
  ]);

  if (directProductStockCol) {
    const where = [];
    const args = [];
    let ai = 1;

    if (pidRaw && productsPkCol) {
      where.push(`CAST("${productsPkCol}" AS TEXT) = $${ai}`);
      args.push(pidRaw);
      ai++;
    }

    if (skuRaw && productsCodeCol) {
      where.push(`"${productsCodeCol}" = $${ai}`);
      args.push(skuRaw);
      ai++;
    }

    if (where.length) {
      const sql = `
          SELECT COALESCE("${directProductStockCol}", 0) AS stock
          FROM public."products"
          WHERE ${where.join(' OR ')}
          LIMIT 1
        `;
      const r = await client.query(sql, args);
      if (r.rowCount) {
        return Number(r.rows[0]?.stock || 0);
      }
    }
  }

  return 0;
}

export async function resolveAvailableStock(client, item, stockMode = null) {
  const resolvedStockMode = stockMode || await resolveBudgetStockMode();

  if (resolvedStockMode?.requireLot) {
    if (!item?.lot_id) return 0;

    const lotStock = await resolveLotAvailableStock(client, item.lot_id);
    return lotStock != null ? Number(lotStock || 0) : 0;
  }

  return await resolveProductAvailableStock(client, {
    product_id: null,
    sku: item?.product_code,
  });
}

export async function validateStockOrOverride(client, item, ctx = {}) {
  const requested = Number(item?.quantity || 0);

  if (!Number.isFinite(requested) || requested <= 0) {
    const e = new Error(`Quantidade inválida para SKU ${item?.product_code || ''}`);
    e.status = 400;
    throw e;
  }

  const stockMode =
    ctx?.stockMode ||
    await resolveBudgetStockMode(ctx);

  /*
   * PRODUCT_STOCK_MODE é a fonte de verdade para lote.
   * STOCK_SIMPLE valida o saldo consolidado e remove lot_id residual.
   * STOCK_WITH_LOT exige e valida o lote selecionado.
   */
  if (stockMode?.isSimple || stockMode?.requireLot === false) {
    item.lot_id = null;
    item.override_lot_id = null;
  } else if (!item?.lot_id) {
    const e = new Error(
      `Selecione um lote para o SKU ${item?.product_code || ''}.`
    );
    e.status = 400;
    e.code = 'BUDGET_STOCK_LOT_REQUIRED';
    throw e;
  }

  const available = await resolveAvailableStock(
    client,
    item,
    stockMode
  );

  if (available >= requested) {
    return { ok: true, available, requested };
  }

  const settings = ctx?.budgetSettings || await getBudgetSettings(client);
  const mode = String(settings?.out_of_stock_mode || 'BLOCK').trim().toUpperCase();

  // ALLOW: não solicita chave e não cria/persiste token de override.
  if (mode === 'ALLOW') {
    return {
      ok: true,
      available,
      requested,
      allowed_without_token: true,
    };
  }

  // BLOCK: impede salvar, mesmo que o frontend envie override/token.
  if (mode === 'BLOCK') {
    const e = new Error(
      `Sem estoque para SKU ${item?.product_code || ''}. Disponível: ${available}. Solicitado: ${requested}. Produto bloqueado pelos parâmetros.`
    );
    e.status = 400;
    throw e;
  }

  if (!item?.override_stock) {
    const e = new Error(
      `Sem estoque para SKU ${item?.product_code || ''}. Disponível: ${available}. Solicitado: ${requested}.`
    );
    e.status = 400;
    throw e;
  }

  // PASSWORD: exige um token válido, vinculado ao usuário/item atual.
  const chk = verifyBudgetStockOverrideToken(item?.override_token, {
    userId: ctx?.userId,
    sku: item?.product_code,
    lotId: item?.lot_id ?? null,
    requestedQty: requested,
  });
  if (!chk.ok) {
    const e = new Error(`Override inválido para SKU ${item?.product_code || ''}: ${chk.error}`);
    e.status = 400;
    throw e;
  }

  const p = chk.payload || {};
  const ctxUserId = Number(ctx?.userId || 0);

  if (ctxUserId && Number(p.user_id || 0) && Number(p.user_id) !== ctxUserId) {
    const e = new Error(`Override não pertence ao usuário atual para SKU ${item?.product_code || ''}.`);
    e.status = 400;
    throw e;
  }

  if (p.sku && item?.product_code && String(p.sku).trim() !== String(item.product_code).trim()) {
    const e = new Error(`Override incompatível com o SKU ${item?.product_code || ''}.`);
    e.status = 400;
    throw e;
  }

  if (p.lot_id != null && item?.lot_id != null && Number(p.lot_id) !== Number(item.lot_id)) {
    const e = new Error(`Override incompatível com o lote do SKU ${item?.product_code || ''}.`);
    e.status = 400;
    throw e;
  }

  if (Number.isFinite(Number(p.requested_qty)) && requested > Number(p.requested_qty)) {
    const e = new Error(`Quantidade acima da autorizada no override para SKU ${item?.product_code || ''}.`);
    e.status = 400;
    throw e;
  }

  return { ok: true, available, requested, override: true, payload: p };
}
