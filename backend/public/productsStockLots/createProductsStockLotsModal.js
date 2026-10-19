// ╔══════════════════════════════════════════════════════════════════════╗
// ║ createProductsStockLotsModal.js — Modal Lotes (PRODNEX ERP | ESM)     ║
// ║ Path: backend/public/productsStockLots/createProductsStockLotsModal.js║
// ║ - Create/Edit + Quick Ops (reserve/unreserve/consume)                ║
// ║ - Busca Produto (openProductsModalSearch) para preencher Stock ID     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

export function createProductsStockLotsModal({ API, apiBase = '', apiJson, toast, reload }) {
  /* ──────────────────────────────────────────────────────────────
     DOM (modal)
  ─────────────────────────────────────────────────────────────── */
  const el = {
    modalLayer: document.getElementById('modalLayer'),
    modalTitle: document.getElementById('modalTitle'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancel: document.getElementById('btnCancel'),
    btnSave: document.getElementById('btnSave'),
    btnDelete: document.getElementById('btnDelete'),

    formLot: document.getElementById('formLot'),
    mLotId: document.getElementById('mLotId'),
    mProductStockId: document.getElementById('mProductStockId'),
    btnPickProduct: document.getElementById('btnPickProduct'),

    mLotCode: document.getElementById('mLotCode'),
    mExpiresAt: document.getElementById('mExpiresAt'),
    mQtyOnHand: document.getElementById('mQtyOnHand'),
    mQtyReserved: document.getElementById('mQtyReserved'),
    mCostUnit: document.getElementById('mCostUnit'),
    mNfeKey: document.getElementById('mNfeKey'),
    mNfeItemSeq: document.getElementById('mNfeItemSeq'),

    opQty: document.getElementById('opQty'),
    btnReserve: document.getElementById('btnReserve'),
    btnUnreserve: document.getElementById('btnUnreserve'),
    btnConsume: document.getElementById('btnConsume'),
  };

  if (!el.modalLayer || !el.formLot) {
    throw new Error('Modal DOM não encontrado. Verifique os IDs no HTML.');
  }

  /* ──────────────────────────────────────────────────────────────
     Helpers base
  ─────────────────────────────────────────────────────────────── */
  function normBase() {
    const b = (apiBase || '').trim();
    return b ? b.replace(/\/$/, '') : '';
  }

  async function fetchJsonLoose(url) {
    const r = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    const t = await r.text();
    let data;
    try { data = t ? JSON.parse(t) : {}; } catch { data = { raw: t }; }
    if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
    return data;
  }

  function pickRow(data) {
    if (!data) return null;
    if (data.row && typeof data.row === 'object') return data.row;
    if (Array.isArray(data.rows) && data.rows.length) return data.rows[0];
    if (Array.isArray(data.data) && data.data.length) return data.data[0];
    if (Array.isArray(data) && data.length) return data[0];
    if (data.data && typeof data.data === 'object') return data.data;
    return null;
  }

  async function resolveProductStockIdBySku(sku) {
    const base = normBase();
    const code = String(sku || '').trim();
    if (!code) return null;

    // ✅ Ajuste aqui se você tiver uma rota oficial
    const tries = [
      `${base}/api/productsStock/by-product/${encodeURIComponent(code)}`,
      `${base}/api/productsStock?product_id=${encodeURIComponent(code)}`,
      `${base}/api/productsStock?product_code=${encodeURIComponent(code)}`,
      `${base}/api/products-stock?product_id=${encodeURIComponent(code)}`,
      `${base}/api/products-stock?product_code=${encodeURIComponent(code)}`,
    ].filter(Boolean);

    for (const url of tries) {
      try {
        const data = await fetchJsonLoose(url);
        const row = pickRow(data);
        const v =
          row?.product_stock_id ??
          row?.stock_id ??
          row?.id ??
          data?.product_stock_id ??
          data?.stock_id ??
          null;
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
      } catch {
        // tenta próxima
      }
    }
    return null;
  }

  /* ──────────────────────────────────────────────────────────────
     API calls (lotes)
  ─────────────────────────────────────────────────────────────── */
  async function createOrAddLot(payload) {
    const data = await apiJson(`${API}`, { method: 'POST', body: JSON.stringify(payload) });
    return data.row;
  }

  async function updateLot(id, payload) {
    const data = await apiJson(`${API}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return data.row;
  }

  async function deleteLot(id) {
    await apiJson(`${API}/${id}`, { method: 'DELETE' });
  }

  async function opReserve(id, qty) {
    const data = await apiJson(`${API}/${id}/reserve`, { method: 'POST', body: JSON.stringify({ qty }) });
    return data.row;
  }
  async function opUnreserve(id, qty) {
    const data = await apiJson(`${API}/${id}/unreserve`, { method: 'POST', body: JSON.stringify({ qty }) });
    return data.row;
  }
  async function opConsume(id, qty) {
    const data = await apiJson(`${API}/${id}/consume`, { method: 'POST', body: JSON.stringify({ qty }) });
    return data.row;
  }

  /* ──────────────────────────────────────────────────────────────
     Modal open/close
  ─────────────────────────────────────────────────────────────── */
  function getCurrentLotId() {
    const id = Number(el.mLotId.value || 0);
    return id > 0 ? id : null;
  }

  function openLayer() {
    document.body.classList.add('modal-open');
    el.modalLayer.classList.remove('hidden');
    el.modalLayer.setAttribute('aria-hidden', 'false');
  }

  function close() {
    el.modalLayer.classList.add('hidden');
    el.modalLayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function setOpsEnabled(enabled) {
    el.btnReserve.disabled = !enabled;
    el.btnUnreserve.disabled = !enabled;
    el.btnConsume.disabled = !enabled;
  }

  function fillFormNew({ defaultProductStockId = '' } = {}) {
    el.modalTitle.textContent = 'Novo lote';
    el.btnDelete.classList.add('hidden');

    el.mLotId.value = '';
    el.mProductStockId.value = String(defaultProductStockId || '');
    el.mLotCode.value = '';
    el.mExpiresAt.value = '';
    el.mQtyOnHand.value = '0';
    el.mQtyReserved.value = '0';
    el.mCostUnit.value = '';
    el.mNfeKey.value = '';
    el.mNfeItemSeq.value = '';
    el.opQty.value = '1';

    setOpsEnabled(false);
    setTimeout(() => el.mLotCode.focus(), 60);
  }

  function fillFormEdit(lot) {
    el.modalTitle.textContent = `Editar lote #${lot.lot_id}`;
    el.btnDelete.classList.remove('hidden');

    el.mLotId.value = lot.lot_id;
    el.mProductStockId.value = lot.product_stock_id ?? '';
    el.mLotCode.value = lot.lot_code ?? '';
    el.mExpiresAt.value = lot.expires_at ? String(lot.expires_at).slice(0, 10) : '';
    el.mQtyOnHand.value = lot.qty_on_hand ?? 0;
    el.mQtyReserved.value = lot.qty_reserved ?? 0;
    el.mCostUnit.value = lot.cost_unit ?? '';
    el.mNfeKey.value = lot.nfe_key ?? '';
    el.mNfeItemSeq.value = lot.nfe_item_seq ?? '';
    el.opQty.value = '1';

    setOpsEnabled(true);
    setTimeout(() => el.mLotCode.focus(), 60);
  }

  function openNew({ defaultProductStockId } = {}) {
    openLayer();
    fillFormNew({ defaultProductStockId });
  }

  function openEdit(lot) {
    openLayer();
    fillFormEdit(lot);
  }

  /* ──────────────────────────────────────────────────────────────
     ✅ Buscar produto (lupa)
  ─────────────────────────────────────────────────────────────── */
  async function pickProduct() {
    try {
      toast('Abrindo busca de produtos…');

      openProductsModalSearch({
        apiBase: normBase(),
        priceId: null,
        onPick: async (p) => {
          const sku = (p?.product_code || p?.sku || p?.product_id || p?.codigo || '').toString().trim();
          if (!sku) {
            toast('Produto selecionado sem SKU. Verifique /api/products/search.');
            return;
          }

          toast(`Produto selecionado: ${sku}. Resolvendo Stock ID…`);
          const stockId = await resolveProductStockIdBySku(sku);

          if (!stockId) {
            toast(`Não achei Product Stock ID para SKU ${sku}. Digite manualmente ou ajuste endpoint.`);
            el.mProductStockId.focus();
            return;
          }

          el.mProductStockId.value = String(stockId);
          el.mProductStockId.dispatchEvent(new Event('input', { bubbles: true }));
          el.mProductStockId.dispatchEvent(new Event('change', { bubbles: true }));

          toast(`Stock ID preenchido: ${stockId}`);
          setTimeout(() => el.mLotCode.focus(), 80);
        }
      });
    } catch (e) {
      toast(e?.message || 'Falha ao abrir busca de produtos.');
    }
  }

  /* ──────────────────────────────────────────────────────────────
     Bind events (once)
  ─────────────────────────────────────────────────────────────── */
  el.btnCloseModal.addEventListener('click', close);
  el.btnCancel.addEventListener('click', close);

  // outside click closes
  el.modalLayer.addEventListener('click', (ev) => {
    if (ev.target === el.modalLayer) close();
  });

  // ESC closes
  document.addEventListener('keydown', (ev) => {
    if (el.modalLayer.classList.contains('hidden')) return;
    if (ev.key === 'Escape') close();
  });

  // 🔎 product pick
  if (el.btnPickProduct) el.btnPickProduct.addEventListener('click', pickProduct);

  // F2 opens search when focus in stockId
  el.mProductStockId?.addEventListener('keydown', (ev) => {
    if (ev.key === 'F2') { ev.preventDefault(); pickProduct(); }
  });

  // Save (create/update)
  el.formLot.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const lot_id = getCurrentLotId();

    const payload = {
      product_stock_id: Number(el.mProductStockId.value || 0),
      lot_code: (el.mLotCode.value || '').trim(),
      expires_at: el.mExpiresAt.value ? el.mExpiresAt.value : null,
      qty_on_hand: Number(String(el.mQtyOnHand.value || '0').replace(',', '.')),
      cost_unit: el.mCostUnit.value === '' ? null : Number(String(el.mCostUnit.value).replace(',', '.')),
      nfe_key: (el.mNfeKey.value || '').trim() || null,
      nfe_item_seq: el.mNfeItemSeq.value === '' ? null : Number(el.mNfeItemSeq.value),
    };

    if (!payload.product_stock_id) { toast('Product Stock ID é obrigatório.'); el.mProductStockId.focus(); return; }
    if (!payload.lot_code) { toast('Lote é obrigatório.'); el.mLotCode.focus(); return; }
    if (!(payload.qty_on_hand >= 0)) { toast('Qtd em mãos deve ser >= 0'); el.mQtyOnHand.focus(); return; }

    try {
      if (!lot_id) {
        await createOrAddLot(payload);
        toast('Lote criado/adicionado com sucesso.');
      } else {
        const upd = { ...payload };
        delete upd.product_stock_id; // evita troca acidental
        const row = await updateLot(lot_id, upd);

        el.mQtyOnHand.value = row.qty_on_hand ?? el.mQtyOnHand.value;
        el.mQtyReserved.value = row.qty_reserved ?? el.mQtyReserved.value;

        toast('Lote atualizado.');
      }

      close();
      await reload();
    } catch (e) {
      toast(e.message);
    }
  });

  // Delete
  el.btnDelete.addEventListener('click', async () => {
    const lot_id = getCurrentLotId();
    if (!lot_id) return;

    if (!confirm(`Excluir lote #${lot_id}?`)) return;

    try {
      await deleteLot(lot_id);
      toast('Lote excluído.');
      close();
      await reload();
    } catch (e) {
      toast(e.message);
    }
  });

  // Quick ops
  el.btnReserve.addEventListener('click', async () => {
    const lot_id = getCurrentLotId();
    if (!lot_id) { toast('Salve o lote antes de reservar.'); return; }

    const qty = Number(String(el.opQty.value || '0').replace(',', '.'));
    if (!(qty > 0)) { toast('Quantidade inválida.'); return; }

    try {
      const row = await opReserve(lot_id, qty);
      el.mQtyReserved.value = row.qty_reserved ?? el.mQtyReserved.value;
      toast('Reserva aplicada.');
      await reload();
    } catch (e) { toast(e.message); }
  });

  el.btnUnreserve.addEventListener('click', async () => {
    const lot_id = getCurrentLotId();
    if (!lot_id) { toast('Salve o lote antes de desreservar.'); return; }

    const qty = Number(String(el.opQty.value || '0').replace(',', '.'));
    if (!(qty > 0)) { toast('Quantidade inválida.'); return; }

    try {
      const row = await opUnreserve(lot_id, qty);
      el.mQtyReserved.value = row.qty_reserved ?? el.mQtyReserved.value;
      toast('Desreserva aplicada.');
      await reload();
    } catch (e) { toast(e.message); }
  });

  el.btnConsume.addEventListener('click', async () => {
    const lot_id = getCurrentLotId();
    if (!lot_id) { toast('Salve o lote antes de baixar.'); return; }

    const qty = Number(String(el.opQty.value || '0').replace(',', '.'));
    if (!(qty > 0)) { toast('Quantidade inválida.'); return; }
    if (!confirm(`Confirmar baixa (consume) de ${qty}?`)) return;

    try {
      const row = await opConsume(lot_id, qty);
      el.mQtyOnHand.value = row.qty_on_hand ?? el.mQtyOnHand.value;
      el.mQtyReserved.value = row.qty_reserved ?? el.mQtyReserved.value;
      toast('Baixa aplicada.');
      await reload();
    } catch (e) { toast(e.message); }
  });

  return { openNew, openEdit, close, getCurrentLotId };
}