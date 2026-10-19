// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventoryItemsAdd.repository.js — addItem                          ║
// ║ Inclui/atualiza item de inventário (tx + lote + log)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_INV, TB_ITEMS, TB_LOTS } from './inventory.constants.js';
import { invDebug, qtyDebug, q } from './inventory.utils.js';
import { toNumOrNull, toIntOrNull } from './inventory.sanitizers.js';
import { rowToItem } from './inventory.mappers.js';
import {
  getTableCols,
  hasCol,
  hasTable,
  qIdent,
  getProductsLocationsIdCol,
  getProductsLocationsDefaultCol,
  joinProductsLocationsSql,
  inventoryItemsHasLot,
} from './inventorySchemaInfo.repository.js';
import { insertLog } from './inventoryAudit.repository.js';

export async function addItem(inventory_id, payload = {}, userCtx = {}) {
  const client = await pool.connect();
  try {
    await q(client, 'tx.BEGIN', 'BEGIN', []);

    const { rows: invRows } = await q(
      client,
      'inv.FOR_UPDATE',
      `SELECT * FROM ${TB_INV} WHERE inventory_id = $1 FOR UPDATE;`,
      [inventory_id],
    );
    const inv = invRows[0];
    if (!inv) throw new Error('Inventory not found');
    if (['FINALIZED', 'CANCELLED'].includes((inv.status || '').toUpperCase())) {
      throw new Error('Inventory is already finalized/cancelled');
    }

    const productCode = String(payload.product_code || '').trim();
    if (!productCode) throw new Error('product_code is required');

    const { rows: prodRows } = await q(
      client,
      'product.by_code',
      `
      SELECT product_id, product_code, description, product_stock_id
      FROM public."products"
      WHERE product_code = $1
      LIMIT 1;
      `,
      [productCode],
    );
    const prod = prodRows[0];
    if (!prod) throw new Error(`Product not found for code "${productCode}"`);

    if (!prod.product_stock_id) {
      const ins = await q(
        client,
        'productsStock.insert',
        `INSERT INTO public."productsStock"(stock_qty) VALUES (0) RETURNING product_stock_id;`,
        [],
      );
      const newStockId = ins.rows[0]?.product_stock_id;
      if (!newStockId) throw new Error('Failed to create productsStock row');

      await q(
        client,
        'products.update_stock_id',
        `
        UPDATE public."products"
           SET product_stock_id = $1,
               updated_at = NOW()
         WHERE product_code = $2
           AND product_stock_id IS NULL;
        `,
        [newStockId, prod.product_code],
      );

      prod.product_stock_id = newStockId;
    }

    let stockQty = 0;
    {
      const stockRes = await q(
        client,
        'productsStock.get_qty',
        `SELECT stock_qty FROM public."productsStock" WHERE product_stock_id = $1`,
        [prod.product_stock_id],
      );
      stockQty = stockRes.rows[0]?.stock_qty ?? 0;
    }

    const countedQtyRaw = toNumOrNull(payload.counted_qty);
    if (countedQtyRaw == null) throw new Error('counted_qty is required');

    let unitFactor = Number(payload.fator ?? payload.factor ?? 1);
    if (!Number.isFinite(unitFactor) || unitFactor <= 0) unitFactor = 1;

    // ✅ SALVA A QTD DIGITADA, SEM MULTIPLICAR
    const countedQty = countedQtyRaw;

    invDebug('addItem.qty', 'Quantidade recebida para inclusão', {
      inventory_id,
      product_code: productCode,
      payload_product_unit_id: payload.product_unit_id,
      payload_unit: payload.unit,
      ...qtyDebug(countedQtyRaw, unitFactor),
      note: 'counted_qty salvo RAW; conversão para base ocorre só na finalização.',
    });
    let productUnitId = toIntOrNull(payload.product_unit_id);
    let productLocationId = toIntOrNull(payload.product_location_id);

    if (productLocationId) {
      const plIdCol = await getProductsLocationsIdCol(client);
      const plHasActive = await hasCol('public', 'productsLocations', 'is_active', client);

      const { rows: validLocRows } = await q(
        client,
        'productsLocations.validate_selected',
        `
    SELECT ${qIdent(plIdCol)} AS loc_id
    FROM public."productsLocations"
    WHERE ${qIdent(plIdCol)} = $1
      AND product_code = $2
      ${plHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
    LIMIT 1;
    `,
        [productLocationId, prod.product_code],
      );

      if (!validLocRows.length) {
        productLocationId = null;
      }
    }

    const unitText = payload.unit ? String(payload.unit).trim().toUpperCase() : null;
    const locationText = payload.location ? String(payload.location).trim() : null;

    if (!productUnitId && unitText) {
      const puHasActive = await hasCol('public', 'productsBarCode', 'is_active', client);

      const { rows: uRows } = await q(
        client,
        'productsUnits.find',
        `
        SELECT product_unit_id
          FROM public."productsBarCode"
         WHERE product_code = $1
           AND LOWER(unit) = LOWER($2)
           ${puHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
         LIMIT 1;
        `,
        [prod.product_code, unitText],
      );
      productUnitId = uRows[0]?.product_unit_id ?? null;

      if (!productUnitId) {
        const hasUnits = await hasTable('public', 'units', client);
        if (hasUnits) {
          const unitsHasActive = await hasCol('public', 'units', 'is_active', client);
          const unitsHasFator = await hasCol('public', 'units', 'fator', client);
          const unitsHasUnitId = await hasCol('public', 'units', 'unit_id', client);

          const { rows: gRows } = await q(
            client,
            'units.find',
            `
            SELECT
              unit,
              description
              ${unitsHasFator ? ', fator' : ''}
              ${unitsHasUnitId ? ', unit_id' : ''}
            FROM public.units
            WHERE LOWER(unit) = LOWER($1)
              ${unitsHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
            LIMIT 1;
            `,
            [unitText],
          );
          const g = gRows[0];

          if (g?.unit) {
            const puCols = await getTableCols('public', 'productsUnits', client);

            const cols = ['product_code', 'unit', 'description', 'created_at', 'updated_at'];
            const vals = [prod.product_code, g.unit, g.description ?? null];
            const ph = ['$1', '$2', '$3', 'NOW()', 'NOW()'];
            let p = 4;

            if (puCols.has('fator')) {
              cols.push('fator');
              vals.push(g.fator ?? 1);
              ph.push(`$${p++}`);
            }
            if (puCols.has('standard')) {
              cols.push('standard');
              vals.push(false);
              ph.push(`$${p++}`);
            }
            if (puCols.has('unit_id') && unitsHasUnitId) {
              cols.push('unit_id');
              vals.push(g.unit_id ?? null);
              ph.push(`$${p++}`);
            }
            if (puCols.has('is_active')) {
              cols.push('is_active');
              vals.push(true);
              ph.push(`$${p++}`);
            }

            const insPu = await q(
              client,
              'productsUnits.insert',
              `
              INSERT INTO public."productsUnits" (${cols.join(', ')})
              VALUES (${ph.join(', ')})
              RETURNING product_unit_id;
              `,
              vals,
            );

            productUnitId = insPu.rows[0]?.product_unit_id ?? null;
          }
        }
      }
    }

    if (!productLocationId) {
      const plIdCol = await getProductsLocationsIdCol(client);
      const plDefaultCol = await getProductsLocationsDefaultCol(client);
      const plHasActive = await hasCol('public', 'productsLocations', 'is_active', client);

      const orderBy =
        plDefaultCol
          ? `ORDER BY COALESCE(${qIdent(plDefaultCol)}, FALSE) DESC, COALESCE(is_active, TRUE) DESC, ${qIdent(plIdCol)} DESC`
          : `ORDER BY COALESCE(is_active, TRUE) DESC, ${qIdent(plIdCol)} DESC`;

      const { rows: locRows } = await q(
        client,
        'productsLocations.list',
        `
        SELECT
          ${qIdent(plIdCol)} AS loc_id,
          corredor, prateleira, bandeja, box, observacao
          ${plDefaultCol ? `, ${qIdent(plDefaultCol)} AS is_default` : ''}
        FROM public."productsLocations"
        WHERE product_code = $1
          ${plHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
        ${orderBy};
        `,
        [prod.product_code],
      );

      console.log('\n================ LOCATIONS FOUND ================');
      console.log('PRODUCT:', prod.product_code);
      console.table(
        locRows.map(r => ({
          loc_id: r.loc_id,
          corredor: r.corredor,
          prateleira: r.prateleira,
          bandeja: r.bandeja,
          is_default: r.is_default,
        }))
      );
      console.log('================================================\n');

      if (!locRows.length) {
        throw new Error(`Product "${prod.product_code}" has no registered location.`);
      }

      if (locRows.length === 1) {
        productLocationId = toIntOrNull(locRows[0]?.loc_id) ?? null;
      } else {
        if (locationText) {
          const like = `%${locationText}%`;
          const { rows: matchRows } = await q(
            client,
            'productsLocations.match',
            `
            SELECT ${qIdent(plIdCol)} AS loc_id
            FROM public."productsLocations"
            WHERE product_code = $1
              ${plHasActive ? 'AND COALESCE(is_active, TRUE) IS TRUE' : ''}
              AND (
                corredor   ILIKE $2 OR
                prateleira ILIKE $2 OR
                bandeja    ILIKE $2 OR
                box        ILIKE $2 OR
                observacao ILIKE $2
              )
            ORDER BY ${qIdent(plIdCol)} DESC
            LIMIT 1;
            `,
            [prod.product_code, like],
          );
          productLocationId = toIntOrNull(matchRows[0]?.loc_id) ?? null;
        }

        if (!productLocationId && plDefaultCol) {
          const def = locRows.find((r) => r.is_default === true);
          if (def) productLocationId = toIntOrNull(def.loc_id) ?? null;
        }

        console.log('[INVENTORY] productLocationId before fallback:', productLocationId);
        console.log('[INVENTORY] first location:', locRows[0]);

        if (!productLocationId) {
          productLocationId = toIntOrNull(locRows[0]?.loc_id) ?? null;
        }

        if (!productLocationId) {
          throw new Error(`Product "${prod.product_code}" has multiple locations. Please select one.`);
        }
      }
    }

    const hasLot = await inventoryItemsHasLot(client);
    const lotId = hasLot ? toIntOrNull(payload.lot_id) : null;

    if (hasLot && lotId) {
      const { rows: lotRows } = await q(
        client,
        'lots.get',
        `
        SELECT lot_id, product_stock_id, lot_code, expires_at, qty_on_hand
        FROM ${TB_LOTS}
        WHERE lot_id = $1
        LIMIT 1;
        `,
        [lotId],
      );
      const lot = lotRows[0];
      if (!lot) throw new Error(`Lot not found (lot_id=${lotId}).`);
      if (String(lot.product_stock_id) !== String(prod.product_stock_id)) {
        throw new Error(`Lot (lot_id=${lotId}) does not belong to product_stock_id (${prod.product_stock_id}).`);
      }
      stockQty = lot.qty_on_hand ?? 0;
    }

    const notes = payload.notes ?? null;

    const baseCols = [
      'inventory_id',
      'product_code',
      'product_name',
      'product_unit_id',
      'product_location_id',
      ...(hasLot ? ['lot_id'] : []),
      'system_stock_qty',
      'counted_qty',
      'status',
      'notes',
    ];

    const baseVals = [
      inventory_id,
      prod.product_code,
      prod.description ?? null,
      productUnitId,
      productLocationId,
      ...(hasLot ? [lotId] : []),
      stockQty,
      countedQty,
      'PENDING',
      notes,
    ];

    const colsSql = baseCols.join(', ');
    const phSql = baseVals.map((_, i) => `$${i + 1}`).join(', ');

    const conflictWithLot = hasLot
      ? '(inventory_id, product_code, product_unit_id, product_location_id, lot_id)'
      : '(inventory_id, product_code, product_unit_id, product_location_id)';

    const conflictNoLot = '(inventory_id, product_code, product_unit_id, product_location_id)';

    const doUpdate = `
  DO UPDATE SET
    counted_qty       = COALESCE(${TB_ITEMS}.counted_qty, 0) + COALESCE(EXCLUDED.counted_qty, 0),
    notes            = EXCLUDED.notes,
    system_stock_qty = EXCLUDED.system_stock_qty,
    ${hasLot ? 'lot_id = EXCLUDED.lot_id,' : ''}
    updated_at       = NOW()
`;

    let newId = null;
    try {
      const { rows } = await q(
        client,
        'items.upsert',
        `
        INSERT INTO ${TB_ITEMS} (${colsSql})
        VALUES (${phSql})
        ON CONFLICT ${conflictWithLot}
        ${doUpdate}
        RETURNING inventory_item_id;
        `,
        baseVals,
      );
      newId = rows[0]?.inventory_item_id ?? null;
    } catch (err) {
      if (hasLot && err?.code === '42P10') {
        const { rows } = await q(
          client,
          'items.upsert.fallback_no_lot',
          `
          INSERT INTO ${TB_ITEMS} (${colsSql})
          VALUES (${phSql})
          ON CONFLICT ${conflictNoLot}
          ${doUpdate}
          RETURNING inventory_item_id;
          `,
          baseVals,
        );
        newId = rows[0]?.inventory_item_id ?? null;
      } else {
        throw err;
      }
    }

    let unitForLog = unitText;
    if (!unitForLog && productUnitId) {
      const { rows: puRows } = await q(
        client,
        'productsUnits.get_unit',
        `SELECT unit
        FROM public."productsBarCode"
        WHERE product_unit_id = $1
        AND COALESCE(is_active, TRUE) IS TRUE
        ORDER BY standard DESC, fator ASC
        LIMIT 1;`,
        [productUnitId],
      );
      unitForLog = puRows[0]?.unit ?? null;
    }

    await insertLog(client, {
      inventory_id,
      inventory_item_id: newId,
      action: 'ITEM_ADDED',
      product_code: prod.product_code,
      product_name: prod.description,
      unit: unitForLog,
      system_qty_before: stockQty,
      counted_qty: countedQty,
      system_qty_after: null,
      userCtx,
    });

    const joinPL = await joinProductsLocationsSql(client, 'it');
    const joinLot = hasLot ? `LEFT JOIN ${TB_LOTS} lot ON lot.lot_id = it.lot_id` : '';

    const { rows: fullRows } = await q(
      client,
      'items.select_full',
      `
      SELECT
        it.*,
        pu.unit,
        ${hasLot ? `lot.lot_code, lot.expires_at AS lot_expires_at,` : ''}
        CONCAT_WS(' / ', pl.corredor, pl.prateleira, pl.bandeja, pl.box) AS location_name
      FROM ${TB_ITEMS} it
      LEFT JOIN public."productsBarCode" pu
             ON pu.product_unit_id = it.product_unit_id
      ${joinPL}
      ${joinLot}
      WHERE it.inventory_item_id = $1;
      `,
      [newId],
    );

    await q(client, 'tx.COMMIT', 'COMMIT', []);
    return fullRows[0] ? rowToItem(fullRows[0]) : null;
  } catch (err) {
    try { await q(client, 'tx.ROLLBACK', 'ROLLBACK', []); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
}
