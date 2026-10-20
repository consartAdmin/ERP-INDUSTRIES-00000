// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpInbound.repository.js — Notas de entrada → Matérias-primas      ║
// ║ Vínculo código do fornecedor ↔ matéria-prima, entrada e estorno.   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_RAW_MATERIALS, TB_RAW_SUPPLIER_REFS } from './pcp.constants.js';
import { moveStock, MOVEMENT_SOURCE } from './pcpRawMaterials.repository.js';
import { ensureOnce } from './pcpSchema.repository.js';

export { ensureOnce as ensureInboundRawSupport };

const digits = (value) => String(value ?? '').replace(/\D/g, '');
const positive = (value, fallback = 1) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Matéria-prima vinculada ao código do produto do fornecedor (CNPJ + cProd). */
export async function findRawMaterialRef(issuerTaxId, nfProductCode, db = pool) {
  const taxId = digits(issuerTaxId);
  const code = String(nfProductCode ?? '').trim();
  if (!taxId || !code) return null;
  await ensureOnce();
  const { rows: [row] } = await db.query(
    `SELECT r.raw_material_id, r.conversion_factor, m.code, m.description, m.unit
       FROM ${TB_RAW_SUPPLIER_REFS} r
       JOIN ${TB_RAW_MATERIALS} m ON m.raw_material_id = r.raw_material_id
      WHERE r.supplier_tax_id = $1 AND r.nf_product_code = $2 AND m.is_active
      LIMIT 1`,
    [taxId, code]
  );
  return row || null;
}

/**
 * Na importação da nota: itens sem produto vinculado recebem a matéria-prima
 * já vinculada ao código do fornecedor, com o fator de conversão salvo.
 */
export async function applyRawMaterialRefs(issuerTaxId, items = []) {
  const out = [];
  for (const item of items) {
    let ref = null;
    if (!item?.product_code) {
      try {
        ref = await findRawMaterialRef(issuerTaxId, item?.nf_product_code);
      } catch (err) {
        console.error('[PCP][INBOUND] Erro ao buscar vínculo de matéria-prima:', err?.message);
      }
    }
    out.push(ref ? {
      ...item,
      raw_material_id: ref.raw_material_id,
      raw_material_code: ref.code,
      raw_material_description: ref.description,
      raw_material_unit: ref.unit,
      conversion_factor: Number(ref.conversion_factor) || 1,
      lm_ref_found: true,
      lm_ref_status: 'RAW_MATERIAL_FOUND',
    } : item);
  }
  return out;
}

/** Grava (ou troca) o vínculo para as próximas notas do mesmo fornecedor. */
export async function saveRawMaterialRef(client, issuerTaxId, nfProductCode, rawMaterialId, conversionFactor = 1) {
  const taxId = digits(issuerTaxId);
  const code = String(nfProductCode ?? '').trim();
  if (!taxId || !code || !rawMaterialId) return;
  await client.query(
    `INSERT INTO ${TB_RAW_SUPPLIER_REFS} (supplier_tax_id, nf_product_code, raw_material_id, conversion_factor)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (supplier_tax_id, nf_product_code)
     DO UPDATE SET raw_material_id = EXCLUDED.raw_material_id,
                   conversion_factor = EXCLUDED.conversion_factor,
                   updated_at = NOW()`,
    [taxId, code.slice(0, 60), rawMaterialId, positive(conversionFactor)]
  );
}

const invoiceReference = (invoice) =>
  `NF ${invoice.invoice_number || invoice.inbound_id}${invoice.series ? `/${invoice.series}` : ''}`;

/**
 * Lança a entrada de um item de nota que é matéria-prima: soma o estoque,
 * recalcula o custo médio e lembra o vínculo do fornecedor. Use na transação do lançamento.
 * Quantidade em unidades da matéria-prima = quantidade da nota × fator de conversão.
 */
export async function postRawMaterialItem(client, item, invoice, user = null) {
  const factor = positive(item.conversion_factor);
  const qty = Number(item.quantity || 0) * factor;
  if (!(qty > 0)) {
    const e = new Error('INVALID_QTY');
    e.details = { item_id: item.inbound_item_id, quantity: item.quantity };
    throw e;
  }
  const price = Number(item.unit_price || 0);
  const movement = await moveStock(client, item.raw_material_id, qty, {
    source: MOVEMENT_SOURCE.INBOUND,
    unitCost: price > 0 ? price / factor : null,
    reference: invoiceReference(invoice),
    notes: [item.nf_product_code, item.description].filter(Boolean).join(' — ') || null,
    user,
  });
  await saveRawMaterialRef(client, invoice.issuer, item.nf_product_code, item.raw_material_id, factor);
  return { qty, movement };
}

/** Estorna a entrada (exclusão da nota já lançada). Recusa se o saldo ficar negativo. */
export async function reverseRawMaterialItem(client, item, invoice, user = null) {
  const qty = Number(item.quantity || 0) * positive(item.conversion_factor);
  if (!(qty > 0)) return null;
  const { rows: [current] } = await client.query(
    `SELECT code, stock_qty FROM ${TB_RAW_MATERIALS} WHERE raw_material_id = $1 FOR UPDATE`,
    [item.raw_material_id]
  );
  if (!current) return null;
  if (Number(current.stock_qty) < qty) {
    const e = new Error('RAW_MATERIAL_REVERT_FAILED_INSUFFICIENT_QTY');
    e.details = { item_id: item.inbound_item_id, raw_material: current.code, stock_qty: current.stock_qty, qty };
    throw e;
  }
  return moveStock(client, item.raw_material_id, -qty, {
    source: MOVEMENT_SOURCE.INBOUND,
    reference: invoiceReference(invoice),
    notes: 'Estorno: nota de entrada excluída',
    user,
  });
}
