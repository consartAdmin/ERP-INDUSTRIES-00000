// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCode.constants.js — tabela, PK e colunas                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import productsBarCodeSchema, { PRODUCTS_BAR_CODE_TABLE, PRODUCTS_BAR_CODE_PRIMARY_KEY } from './productsBarCode.catalog.js';

export const TB_PRODUCTS_BAR_CODE = PRODUCTS_BAR_CODE_TABLE;
export const PK_PRODUCTS_BAR_CODE = PRODUCTS_BAR_CODE_PRIMARY_KEY;
export const SELECT_COLUMNS = Object.freeze([...productsBarCodeSchema.selectColumns]);
