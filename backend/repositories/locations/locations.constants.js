// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ locations.constants.js — Nomes de tabelas do endereçamento de estoque    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/* ------------------------------------------------------------------------- */
/* Table name constants (quoted, to support CamelCase)                       */
/* ------------------------------------------------------------------------- */

export const TABLES = Object.freeze({
  LOCALS: 'public."locationLocals"',
  CORRIDORS: 'public."locationCorridors"',
  SHELVES: 'public."locationShelves"',
  BINS: 'public."locationBins"',
  POSITIONS: 'public."locationPositions"',
  LOCALIZATION_PRODUCTS: 'public."localizationProducts"',
  PRODUCTS: 'public."products"', // 👈 NOVO
  BARCODES: 'public."locationsBarCode"', // mesma tabela de repositories/locationsBarCode
});
