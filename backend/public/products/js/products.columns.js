// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.columns.js — Engrenagem ⚙️: colunas da Lista de Produtos    ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║                                                                      ║
// ║ Usa o componente global includes/js/tableSettings.js (altura das     ║
// ║ linhas, largura/altura da tabela e, por coluna, visível, largura e   ║
// ║ alinhamento). Aqui ficam só as colunas da lista — inclusive os       ║
// ║ preços adicionais dinâmicos — e o ajuste das colunas congeladas.     ║
// ║ Salvo por USUÁRIO no banco (/api/user-table-preferences/products.list)║
// ╚══════════════════════════════════════════════════════════════════════╝

import { createTableSettings } from '/public/includes/js/tableSettings.js';

const TABLE_KEY = 'products.list';
const CACHE_KEY = 'consart.products.columns.v1'; // mesma chave antiga → mantém o cache existente

// Código, Descrição e Ações são colunas congeladas (table-freeze-*): sempre visíveis.
const BASE_COLUMNS = [
  { key: 'code', cls: 'col-code', label: 'Código', width: 70, locked: true },
  { key: 'descricao', cls: 'col-descricao', label: 'Descrição', width: 420, locked: true },
  { key: 'codbarras', cls: 'col-codbarras', label: 'Cód. Barras', width: 120 },
  { key: 'ref', cls: 'col-ref', label: 'Ref. Fab.', width: 100 },
  { key: 'preco-custo', cls: 'col-preco-custo', label: 'Preço de Custo', width: 130 },
  { key: 'preco-varejo', cls: 'col-preco-varejo', label: 'Preço Varejo', width: 130 },
  // preços adicionais entram aqui (dinâmicos, vindos da API)
  { key: 'estoque', cls: 'col-estoque', label: 'Estoque', width: 100 },
  { key: 'local', cls: 'col-local', label: 'Localização', width: 100, locationsOnly: true },
  { key: 'ativo', cls: 'col-ativo', label: 'Status', width: 100 },
  { key: 'fiscal', cls: 'col-fiscal', label: 'Prod. Fiscal', width: 120 },
  { key: 'img', cls: 'col-img', label: 'Imagem', width: 150, imageOnly: true },
  { key: 'actions', cls: 'col-actions', label: 'Ações', width: 140, locked: true },
];

const PRICES_INSERT_AT = BASE_COLUMNS.findIndex((c) => c.key === 'estoque');

let additionalPrices = [];
let showImages = true;
let showLocations = true;
let settings = null;

/** Classe CSS da coluna de um preço adicional (a chave vem da API). */
export function priceColumnClass(priceKey) {
  const slug = String(priceKey ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `col-price-${slug || 'x'}`;
}

function getColumns() {
  const prices = additionalPrices.map(({ key, label }) => ({
    key: `price:${key}`,
    cls: priceColumnClass(key),
    label,
    width: 130,
  }));

  const columns = [...BASE_COLUMNS];
  columns.splice(PRICES_INSERT_AT, 0, ...prices);
  return columns
    .filter((c) => !c.imageOnly || showImages)
    .filter((c) => !c.locationsOnly || showLocations);
}

/** Chamado pelo render a cada carga: informa as colunas dinâmicas e reaplica. */
export function syncColumns({
  additionalPriceColumns = [],
  showImages: images = true,
  showLocations: locations = true,
} = {}) {
  additionalPrices = additionalPriceColumns;
  showImages = images;
  showLocations = locations;
  settings?.refresh();
}

export function bindColumnsSettings() {
  settings = createTableSettings({
    wrapper: '.table-scroll[data-table-settings-manual]',
    tableKey: TABLE_KEY,
    cacheKey: CACHE_KEY,
    trigger: '#btnColumnsSettings',
    columns: getColumns,
    // Código e Descrição são congeladas: o deslocamento sticky depende da largura delas.
    extraRules: ({ widthOf, tableSel }) => {
      const code = widthOf('code');
      const desc = widthOf('descricao');
      if (!code && !desc) return [];
      return [`${tableSel}.table-freeze-left-3 {${code ? ` --table-freeze-col-2-width: ${code}px !important;` : ''}${desc ? ` --table-freeze-col-3-width: ${desc}px !important;` : ''} }`];
    },
  });
}
