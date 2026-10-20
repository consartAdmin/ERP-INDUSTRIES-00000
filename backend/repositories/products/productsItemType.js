// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsItemType.js — Tipo do item (SPED 0200 / Prodnex PCP)         ║
// ║ Coluna products.item_type (VARCHAR(2)), criada automaticamente.      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

const PRODUCTS_TABLE = 'public."products"';

// Códigos da tabela "Tipo do item" do SPED Fiscal (registro 0200, campo TIPO_ITEM).
export const ITEM_TYPES = Object.freeze([
  { code: '00', label: 'Mercadoria para Revenda' },
  { code: '01', label: 'Matéria-prima' },
  { code: '02', label: 'Embalagem' },
  { code: '03', label: 'Produto em Processo' },
  { code: '04', label: 'Produto Acabado' },
  { code: '05', label: 'Subproduto' },
  { code: '06', label: 'Produto Intermediário' },
  { code: '07', label: 'Material de Uso e Consumo' },
  { code: '08', label: 'Ativo Imobilizado' },
  { code: '09', label: 'Serviços' },
  { code: '10', label: 'Outros insumos' },
  { code: '99', label: 'Outras' },
]);

// Tipos usados pelo PCP: o que pode ter ficha técnica / OP e o que pode ser componente.
export const PRODUCIBLE_ITEM_TYPES = Object.freeze(['03', '04', '05', '06']);
export const COMPONENT_ITEM_TYPES = Object.freeze(['00', '01', '02', '03', '06', '07', '10']);

const CODES = new Set(ITEM_TYPES.map(({ code }) => code));

function plain(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const BY_LABEL = new Map(ITEM_TYPES.map(({ code, label }) => [plain(label), code]));

// Nomes curtos aceitos em digitação e planilhas.
const ALIASES = new Map([
  ['revenda', '00'],
  ['mercadoria', '00'],
  ['mp', '01'],
  ['materia prima', '01'],
  ['insumo', '01'],
  ['embalagem', '02'],
  ['em processo', '03'],
  ['semiacabado', '03'],
  ['semi acabado', '03'],
  ['acabado', '04'],
  ['produto final', '04'],
  ['pa', '04'],
  ['subproduto', '05'],
  ['intermediario', '06'],
  ['uso e consumo', '07'],
  ['consumo', '07'],
  ['imobilizado', '08'],
  ['servico', '09'],
  ['servicos', '09'],
  ['outros insumos', '10'],
  ['outras', '99'],
  ['outros', '99'],
]);

/**
 * Converte o que foi digitado em um código válido ("4", "04", "Produto acabado",
 * "04 - Produto Acabado"...). Vazio → null. Não reconhecido → undefined.
 */
export function normalizeItemType(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const leadingCode = raw.match(/^(\d{1,2})(?:\D|$)/);
  if (leadingCode) {
    const code = leadingCode[1].padStart(2, '0');
    return CODES.has(code) ? code : undefined;
  }

  const key = plain(raw);
  return BY_LABEL.get(key) ?? ALIASES.get(key) ?? undefined;
}

export function itemTypeLabel(code) {
  return ITEM_TYPES.find((type) => type.code === code)?.label ?? '';
}

let ensured = null;

/** Cria products.item_type se ainda não existir (uma vez por processo). */
export function ensureItemTypeColumn() {
  if (!ensured) {
    ensured = pool
      .query(`
        ALTER TABLE ${PRODUCTS_TABLE} ADD COLUMN IF NOT EXISTS item_type VARCHAR(2);
        CREATE INDEX IF NOT EXISTS idx_products_item_type ON ${PRODUCTS_TABLE} (item_type);
      `)
      .catch((error) => {
        ensured = null;
        throw error;
      });
  }
  return ensured;
}
