// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.ordersItems.js — Catálogo dos itens de pedidos      ║
// ║ CONSART ERP | PostgreSQL | ESM                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const ORDERS_ITEMS_TABLE = 'public."ordersItems"';
export const ORDERS_ITEMS_PRIMARY_KEY = 'order_item_id';

export const ORDER_ITEM_COLUMNS = Object.freeze([
    'order_item_id', 'order_id', 'product_code', 'barcode_id',
    'description', 'manufacturer_ref', 'grade_id', 'unit_code',
    'conversion_factor', 'quantity', 'unit_price', 'discount_value',
    'price_id', 'commission_id', 'lot_id', 'override_stock',
    'override_token', 'override_approved_at', 'override_approved_by',
    'override_reason', 'override_qty', 'override_lot_id',
    'created_at', 'updated_at',
]);

export const ORDER_ITEM_INSERT_COLUMNS = Object.freeze([
    'order_id', 'product_code', 'barcode_id', 'description',
    'manufacturer_ref', 'grade_id', 'unit_code', 'conversion_factor',
    'quantity', 'unit_price', 'discount_value', 'price_id',
    'commission_id', 'lot_id', 'override_stock', 'override_token',
    'override_approved_at', 'override_approved_by', 'override_reason',
    'override_qty', 'override_lot_id',
]);

export const ORDER_ITEM_UPDATE_COLUMNS = Object.freeze([
    'product_code', 'barcode_id', 'description', 'manufacturer_ref',
    'grade_id', 'unit_code', 'conversion_factor', 'quantity',
    'unit_price', 'discount_value', 'price_id', 'commission_id',
    'lot_id', 'override_stock', 'override_token', 'override_approved_at',
    'override_approved_by', 'override_reason', 'override_qty',
    'override_lot_id',
]);

export const ORDER_ITEM_NUMERIC_COLUMNS = Object.freeze([
    'conversion_factor', 'quantity', 'unit_price',
    'discount_value', 'override_qty',
]);

export const ORDER_ITEM_REQUIRED_COLUMNS = Object.freeze([
    'order_id', 'product_code', 'description', 'unit_code',
]);

export const ORDER_ITEM_DEFAULTS = Object.freeze({
    conversion_factor: 1,
    quantity: 0,
    unit_price: 0,
    discount_value: 0,
    override_stock: false,
});

export const ordersItemsSchema = Object.freeze({
    schema: 'public',
    tableName: 'ordersItems',
    table: ORDERS_ITEMS_TABLE,
    primaryKey: ORDERS_ITEMS_PRIMARY_KEY,
    columns: ORDER_ITEM_COLUMNS,
    insertColumns: ORDER_ITEM_INSERT_COLUMNS,
    updateColumns: ORDER_ITEM_UPDATE_COLUMNS,
    numericColumns: ORDER_ITEM_NUMERIC_COLUMNS,
    requiredColumns: ORDER_ITEM_REQUIRED_COLUMNS,
    defaults: ORDER_ITEM_DEFAULTS,
    relations: Object.freeze({
        order: Object.freeze({ column: 'order_id', table: 'public."orders"', referencedColumn: 'order_id' }),
        product: Object.freeze({ column: 'product_code', table: 'public."products"', referencedColumn: 'product_code' }),
        barcode: Object.freeze({ column: 'barcode_id', table: 'public."productsBarCode"', referencedColumn: 'barcode_id' }),
        grade: Object.freeze({ column: 'grade_id', table: 'public."grades"', referencedColumn: 'grade_id' }),
        price: Object.freeze({ column: 'price_id', table: 'public."prices"', referencedColumn: 'price_id' }),
        commission: Object.freeze({ column: 'commission_id', table: 'public."priceCommissions"', referencedColumn: 'commission_id' }),
        lot: Object.freeze({ column: 'lot_id', table: 'public."productsStockLots"', referencedColumn: 'lot_id' }),
        overrideLot: Object.freeze({ column: 'override_lot_id', table: 'public."productsStockLots"', referencedColumn: 'lot_id' }),
    }),
});

export default ordersItemsSchema;
