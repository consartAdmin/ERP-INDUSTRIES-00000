// ╔════════════════════════════════════════════════════════════════════╗
// ║ promoImagesColumns.repository.js — Detecção de colunas no schema   ║
// ║ (information_schema.columns) — helpers não usados externamente     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function columnExists(tableName, columnName) {
  const { rows } = await pool.query(
    `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

export async function getProductsImageColumn() {
  const candidates = [
    'image_url',
    'url',
    'path',
    'file_path',
    'image_path',
    'imagem',
    'foto',
    'src',
  ];

  for (const col of candidates) {
    if (await columnExists('productsImages', col)) return col;
  }

  return null;
}

export async function getProductsNameColumn() {
  const candidates = [
    'description',
    'descricao',
    'name',
    'nome',
    'product_name',
    'nome_produto',
  ];

  for (const col of candidates) {
    if (await columnExists('products', col)) return col;
  }

  return 'description';
}

export async function getProductCodeColumn(tableName) {
  const candidates = ['product_code', 'sku', 'code', 'codigo'];

  for (const col of candidates) {
    if (await columnExists(tableName, col)) return col;
  }

  return 'product_code';
}

export async function getPriceColumn() {
  const candidates = [
    'preco_venda',
    'price',
    'valor',
    'sale_price',
    'unit_price',
    'preco',
  ];

  for (const col of candidates) {
    if (await columnExists('productsPrices', col)) return col;
  }

  return 'preco_venda';
}
