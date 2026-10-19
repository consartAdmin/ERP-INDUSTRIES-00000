// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.constants.js — Tabelas, aliases e colunas          ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const TB = 'public."productsLocations"';
export const ALIAS = 'pl';

// products (ajuste o nome/coluna se seu schema for diferente)
export const TB_PRODUCTS = 'public."products"';
export const PRODUCTS_ALIAS = 'p';

// ⚠️ Ajuste aqui se a coluna de descrição do produto tiver outro nome:
// ex.: 'description', 'product_name', 'descricao', etc.
export const PRODUCT_DESC_COL = 'description';

// ✅ barcodes (AJUSTE se seu schema for diferente)
export const TB_BARCODES = 'public."productsBarCode"';
export const BARCODES_ALIAS = 'pb';
export const BARCODE_COL = 'barcode';
