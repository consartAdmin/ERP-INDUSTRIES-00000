// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.orders.js — Catálogo da tabela de pedidos           ║
// ║ CONSART ERP | PostgreSQL | ESM                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const ORDERS_TABLE = 'public."orders"';
export const ORDERS_PRIMARY_KEY = 'order_id';

export const ORDER_COLUMNS = Object.freeze([
    'order_id',
    'issue_date',
    'status',
    'budget_id',
    'customer_id',
    'customer_name',
    'customer_tax_id',
    'customer_email',
    'customer_phone',
    'seller_id',
    'price_id',
    'operation_type_id',
    'payment_form_id',
    'payment_term_id',
    'order_shipping_id',
    'subtotal',
    'items_discount_total',
    'global_discount_type',
    'global_discount_value',
    'global_discount_amount',
    'total_discount',
    'total_amount',
    'notes',
    'created_at',
    'updated_at',
]);

export const ORDER_INSERT_COLUMNS = Object.freeze([
    'issue_date', 'status', 'budget_id',
    'customer_id', 'customer_name', 'customer_tax_id',
    'customer_email', 'customer_phone',
    'seller_id', 'price_id', 'operation_type_id',
    'payment_form_id', 'payment_term_id', 'order_shipping_id',
    'subtotal', 'items_discount_total', 'global_discount_type',
    'global_discount_value', 'global_discount_amount',
    'total_discount', 'total_amount', 'notes',
]);

export const ORDER_UPDATE_COLUMNS = Object.freeze([
    ...ORDER_INSERT_COLUMNS,
]);

export const ORDER_MONEY_COLUMNS = Object.freeze([
    'subtotal', 'items_discount_total', 'global_discount_value',
    'global_discount_amount', 'total_discount', 'total_amount',
]);

export const ORDER_REQUIRED_COLUMNS = Object.freeze([
    'issue_date', 'status', 'customer_name', 'customer_tax_id',
]);

export const ORDER_DEFAULTS = Object.freeze({
    issue_date: 'CURRENT_DATE',
    status: 'ABERTO',
    subtotal: 0,
    items_discount_total: 0,
    global_discount_type: 'value',
    global_discount_value: 0,
    global_discount_amount: 0,
    total_discount: 0,
    total_amount: 0,
});

export const ordersSchema = Object.freeze({
    schema: 'public',
    tableName: 'orders',
    table: ORDERS_TABLE,
    primaryKey: ORDERS_PRIMARY_KEY,
    columns: ORDER_COLUMNS,
    insertColumns: ORDER_INSERT_COLUMNS,
    updateColumns: ORDER_UPDATE_COLUMNS,
    moneyColumns: ORDER_MONEY_COLUMNS,
    requiredColumns: ORDER_REQUIRED_COLUMNS,
    defaults: ORDER_DEFAULTS,
    relations: Object.freeze({
        budget: Object.freeze({ column: 'budget_id', table: 'public."budgets"', referencedColumn: 'budget_id' }),
        price: Object.freeze({ column: 'price_id', table: 'public."prices"', referencedColumn: 'price_id' }),
        operationType: Object.freeze({ column: 'operation_type_id', table: 'public."nfeOperationTypes"', referencedColumn: 'operation_type_id' }),
        shipping: Object.freeze({ column: 'order_shipping_id', table: 'public."ordersShipping"', referencedColumn: 'order_shipping_id' }),
    }),
    children: Object.freeze({
        items: Object.freeze({ table: 'public."ordersItems"', foreignKey: 'order_id' }),
        payments: Object.freeze({ table: 'public."ordersPayments"', foreignKey: 'order_id' }),
        nfeAttempts: Object.freeze({ table: 'public."ordersNfeAttempts"', foreignKey: 'order_id' }),
    }),
});

export default ordersSchema;
