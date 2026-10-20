/* PRODNEX ERP - Vincular item da nota de entrada a uma Matéria-prima (PCP).
 * O vínculo fica no item (raw_material_id + conversion_factor) e é gravado no
 * PUT da nota. Ao lançar, o backend soma o estoque da matéria-prima, atualiza o
 * custo médio e lembra o código do fornecedor para as próximas notas.
 */
'use strict';

import { Modal } from '/public/includes/js/modal.js';
import { pcpApi, attachRawMaterialSearch, productCodeOf } from '/public/pcp/js/pcp.common.js';
import { clearItemLotState } from './inboundInvoices.stock.js';

const $ = (id) => document.getElementById(id);

/** Rótulo da matéria-prima vinculada ao item (vazio se não houver). */
export function rawMaterialLabel(item) {
  if (!item?.raw_material_id) return '';
  const code = item.raw_material_code ?? item.raw_material?.code ?? `#${item.raw_material_id}`;
  const description = item.raw_material_description ?? item.raw_material?.description ?? '';
  const factor = Number(item.conversion_factor) || 1;
  return `MP ${code}${description ? ` — ${description}` : ''}${factor !== 1 ? ` (× ${factor})` : ''}`;
}

export function isRawMaterialItem(item) {
  return Boolean(item?.raw_material_id) && !String(item?.product_code ?? '').trim();
}

export function initLinkRawMaterial({ core, state, refs }) {
  const modal = $('rawLinkModal');
  if (!modal) return;

  let current = null; // { index, item }

  attachRawMaterialSearch($('rawLinkSearch'), $('rawLinkOptions'));

  const message = (text) => {
    $('rawLinkMessage').textContent = text || '';
    $('rawLinkMessage').hidden = !text;
  };

  const updateHint = () => {
    if (!current) return;
    const factor = Number($('rawLinkFactor').value) || 1;
    const qty = Number(current.item.quantity || 0);
    const unit = current.item.unit || 'UN';
    $('rawLinkHint').textContent =
      `1 ${unit} da nota = ${factor} na unidade da matéria-prima. Entrada: ${qty * factor}.`;
  };

  const close = () => Modal.close(modal);

  async function apply(raw, factor) {
    const { item } = current;
    clearItemLotState(item);
    item.raw_material_id = Number(raw.raw_material_id);
    item.raw_material_code = raw.code;
    item.raw_material_description = raw.description;
    item.raw_material = null;
    item.conversion_factor = factor;
    item.product_code = null;
    item.product_code_cad = null;
    item.product_id = null;
    item.product_stock_id = null;
    item.product_description = null;
    item.product_name = null;
    item.lot_id = null;
    close();
    await state.actions?.renderItemsTable?.(state.currentItems);
    core.toast.success('Matéria-prima vinculada', `${raw.code} — ${raw.description}`);
  }

  refs.itemsTbody?.addEventListener('click', (event) => {
    if (state.inboundInvoiceReadOnly) return;
    const button = event.target.closest('button[data-act="link-raw"]');
    if (!button || button.disabled) return;
    const index = Number(button.dataset.index);
    const item = state.currentItems?.[index];
    if (!item) return;

    current = { index, item };
    message('');
    $('rawLinkItemInfo').textContent =
      `Item ${item.nf_product_code || index + 1}: ${item.description || ''} — ${item.quantity ?? ''} ${item.unit || ''}`;
    $('rawLinkSearch').value = isRawMaterialItem(item)
      ? `${item.raw_material_code ?? item.raw_material?.code ?? ''} — ${item.raw_material_description ?? item.raw_material?.description ?? ''}`
      : '';
    $('rawLinkFactor').value = isRawMaterialItem(item) ? (Number(item.conversion_factor) || 1) : 1;
    $('btnRawUnlink').hidden = !isRawMaterialItem(item);
    updateHint();
    Modal.open(modal, { focusSelector: '#rawLinkSearch' });
  });

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-raw-link-close]')) close();
  });
  $('rawLinkFactor').addEventListener('input', updateHint);

  $('formRawLink').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current) return;
    const typed = productCodeOf($('rawLinkSearch').value);
    const factor = Number($('rawLinkFactor').value);
    if (!typed) return message('Escolha a matéria-prima.');
    if (!(factor > 0)) return message('O fator de conversão deve ser maior que zero.');
    try {
      const rows = await pcpApi(`/raw-materials/search?${new URLSearchParams({ q: typed, limit: 50 })}`) || [];
      const typedUpper = typed.toUpperCase();
      const raw = rows.find((r) => String(r.code).toUpperCase() === typedUpper) ||
        rows.find((r) => String(r.description).trim().toLowerCase() === typed.toLowerCase());
      if (!raw) return message(`"${typed}" não está cadastrada em Matérias-primas. Escolha na lista ou crie com os dados do item.`);
      await apply(raw, factor);
    } catch (error) {
      message(error?.message || 'Não foi possível consultar as matérias-primas.');
    }
  });

  $('btnRawCreate').addEventListener('click', async () => {
    if (!current) return;
    const { item } = current;
    const factor = Number($('rawLinkFactor').value) || 1;
    const price = Number(item.unit_price || 0);
    try {
      const raw = await pcpApi('/raw-materials', {
        method: 'POST',
        body: {
          description: String(item.description || '').trim().slice(0, 200),
          unit: factor === 1 ? (item.unit || 'UN') : 'UN',
          ncm: String(item.ncm || '').replace(/\D/g, '').length === 8 ? item.ncm : null,
          last_cost: price > 0 ? price / factor : 0,
          notes: item.nf_product_code ? `Criada pela nota de entrada (código do fornecedor ${item.nf_product_code})` : null,
        },
      });
      await apply(raw, factor);
    } catch (error) {
      message(error?.message || 'Não foi possível criar a matéria-prima.');
    }
  });

  $('btnRawUnlink').addEventListener('click', async () => {
    if (!current) return;
    const { item } = current;
    item.raw_material_id = null;
    item.raw_material_code = null;
    item.raw_material_description = null;
    item.raw_material = null;
    item.conversion_factor = 1;
    close();
    await state.actions?.renderItemsTable?.(state.currentItems);
  });
}

