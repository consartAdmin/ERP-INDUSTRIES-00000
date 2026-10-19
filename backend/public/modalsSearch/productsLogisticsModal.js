/*╔══════════════════════════════════════════════════════════════════════╗
  ║ productsLogisticsModal.js — Modal Order Picker + Items (PRODNEX ERP) ║
  ║ Path: backend/public/modalsSearch/productsLogisticsModal.js          ║
  ║ ✅ Abre modal de pedidos (orderModal)                                ║
  ║ ✅ Ao selecionar um pedido, carrega itens via GET /api/orders/:id     ║
  ║ ✅ Mostra modal de itens (orderItemsModal)                            ║
  ║ ✅ Confirma → callback onPick({order, items})                         ║
  ╚══════════════════════════════════════════════════════════════════════╝*/

const qs = (s, el = document) => el.querySelector(s);

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      ...(opts.headers || {}),
    },
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { ok: false, error: text || `HTTP ${res.status}` };
  }

  if (!res.ok || json.ok === false) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function openModal(el) {
  if (!el) return;
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
}

function closeModal(el) {
  if (!el) return;
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
}

function moneyBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Abre o seletor de pedido e, depois, os itens do pedido.
 *
 * config:
 * - apiBase: base (ex: location.origin)
 * - ordersSearchUrl: ex: `${apiBase}/api/orders/search`
 * - orderByIdUrl: (id) => `${apiBase}/api/orders/${id}`   ✅ (usado p/ itens)
 * - onPick: ({order, items}) => void
 */
export function openProductsLogisticsOrderPicker(config = {}) {
  const apiBase = config.apiBase || (window.apiBase || location.origin);
  const ordersSearchUrl = config.ordersSearchUrl || `${apiBase}/api/orders/search`;

  // ✅ FIX: usamos /api/orders/:id (já existe no seu backend)
  const orderByIdUrl =
    config.orderByIdUrl ||
    ((orderId) => `${apiBase}/api/orders/${encodeURIComponent(orderId)}`);

  const onPick = typeof config.onPick === 'function' ? config.onPick : null;

  // DOM
  const orderModal = qs('#orderModal');
  const orderSearch = qs('#orderSearch');
  const orderTbody = qs('#orderTbody');
  const orderModalMeta = qs('#orderModalMeta');

  const orderItemsModal = qs('#orderItemsModal');
  const orderItemsMeta = qs('#orderItemsMeta');
  const orderItemsTbody = qs('#orderItemsTbody');
  const btnConfirmOrderItems = qs('#btnConfirmOrderItems');

  if (!orderModal || !orderSearch || !orderTbody || !orderModalMeta) {
    console.error('[productsLogisticsModal] DOM do orderModal não encontrado.');
    return;
  }
  if (!orderItemsModal || !orderItemsMeta || !orderItemsTbody || !btnConfirmOrderItems) {
    console.error('[productsLogisticsModal] DOM do orderItemsModal não encontrado.');
    return;
  }

  // State interno do modal
  let rows = [];
  let selectedOrder = null;
  let selectedItems = [];

  const closeAll = () => {
    closeModal(orderModal);
    closeModal(orderItemsModal);
  };

  // Close clicks
  orderModal.addEventListener('click', (ev) => {
    if (ev.target?.getAttribute('data-close-order')) closeModal(orderModal);
  });

  orderItemsModal.addEventListener('click', (ev) => {
    if (ev.target?.getAttribute('data-close-order-items')) closeModal(orderItemsModal);
  });

  // ESC
  const onEsc = (ev) => {
    if (ev.key !== 'Escape') return;
    if (orderItemsModal.classList.contains('is-open')) closeModal(orderItemsModal);
    if (orderModal.classList.contains('is-open')) closeModal(orderModal);
  };
  document.addEventListener('keydown', onEsc, { passive: true });

  // Render orders list
  function renderOrders(list) {
    if (!Array.isArray(list) || !list.length) {
      orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Nenhum pedido encontrado.</td></tr>`;
      return;
    }

    orderTbody.innerHTML = list
      .map((o) => {
        const orderId = o.order_id ?? o.id ?? '';
        const customer =
          o.customer_name ||
          o.nome_razao_social ||
          o.nome_fantasia ||
          o.cliente_nome ||
          o.customer ||
          o.nome_cliente ||
          '—';

        const status = o.status || o.order_status || '—';
        const total = o.total_value ?? o.total ?? o.valor_total ?? o.total_amount ?? null;

        return `
          <tr>
            <td class="t-center">
              <button class="btn btn-pastel-primary" type="button" data-act="pickOrder" data-order-id="${escapeHtml(orderId)}">Selecionar</button>
            </td>
            <td><b>${escapeHtml(orderId)}</b></td>
            <td>${escapeHtml(customer)}</td>
            <td>${escapeHtml(status)}</td>
            <td class="t-right">${total == null ? '—' : escapeHtml(moneyBRL(total))}</td>
          </tr>
        `;
      })
      .join('');
  }

  // Search orders (debounced)
  let timer = null;
  async function doSearch(term) {
    const q = String(term || '').trim();

    if (!q) {
      rows = [];
      orderModalMeta.textContent = 'Digite para buscar...';
      orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Digite para buscar...</td></tr>`;
      return;
    }

    orderModalMeta.textContent = 'Buscando...';
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('limit', '20');
      params.set('offset', '0');
      params.set('orderBy', 'created_at');
      params.set('order', 'DESC');

      const out = await fetchJson(`${ordersSearchUrl}?${params.toString()}`);
      rows = out.data || out.rows || [];
      renderOrders(rows);
      orderModalMeta.textContent = `Encontrado(s): ${rows.length}`;
    } catch (err) {
      rows = [];
      orderModalMeta.textContent = `❌ ${err.message}`;
      orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Erro: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  orderSearch.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(orderSearch.value), 300);
  });

  function findOrderById(id) {
    const key = String(id ?? '');
    return rows.find((o) => String(o.order_id ?? o.id ?? '') === key) || null;
  }

  // Load items from GET /api/orders/:id
  async function loadOrderItems(orderId) {
    // ✅ usa sua rota existente getOrderById()
    const out = await fetchJson(orderByIdUrl(orderId));

    // Seu controller retorna { ok:true, header, items }
    const header = out.header || out.data?.header || out.order?.header || {};
    const items = out.items || out.data?.items || out.order?.items || [];

    return { header, items: Array.isArray(items) ? items : [] };
  }

  function normalizeItem(i) {
    const it = i || {};
    return {
      product_code: it.product_code ?? it.sku ?? it.codigo ?? it.code ?? '',
      product_name: it.product_name ?? it.description ?? it.descricao ?? it.name ?? '',
      qty: it.quantity ?? it.qtd ?? it.quantidade ?? it.qty ?? 0,
      unit: it.unit ?? it.unidade ?? it.um ?? it.uom ?? 'UN',
    };
  }

  function renderOrderItems(items) {
    const list = Array.isArray(items) ? items.map(normalizeItem) : [];

    selectedItems = [];
    btnConfirmOrderItems.disabled = true;

    if (!list.length) {
      orderItemsTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Nenhum item encontrado neste pedido.</td></tr>`;
      return;
    }

    orderItemsTbody.innerHTML = list
      .map((it, idx) => {
        return `
          <tr>
            <td class="t-center">
              <input type="checkbox" class="plx-checkItem" data-idx="${idx}" checked />
            </td>
            <td><b>${escapeHtml(it.product_code || '—')}</b></td>
            <td>${escapeHtml(it.product_name || '—')}</td>
            <td class="t-right">${escapeHtml(it.qty)}</td>
            <td>${escapeHtml(it.unit || 'UN')}</td>
          </tr>
        `;
      })
      .join('');

    // Default: all selected
    selectedItems = list.slice();
    btnConfirmOrderItems.disabled = selectedItems.length === 0;

    // Handle selection
    orderItemsTbody.addEventListener(
      'change',
      (ev) => {
        const cb = ev.target?.closest('.plx-checkItem');
        if (!cb) return;

        const all = [...orderItemsTbody.querySelectorAll('.plx-checkItem')];
        const selectedIdx = all
          .filter((x) => x.checked)
          .map((x) => Number(x.dataset.idx))
          .filter((n) => Number.isFinite(n));

        selectedItems = selectedIdx.map((i) => list[i]).filter(Boolean);
        btnConfirmOrderItems.disabled = selectedItems.length === 0;
      },
      { passive: true },
    );
  }

  // Click select order
  orderTbody.addEventListener('click', async (ev) => {
    const btn = ev.target?.closest('button[data-act="pickOrder"]');
    if (!btn) return;

    const orderId = btn.dataset.orderId;
    const order = findOrderById(orderId);

    if (!order) {
      orderModalMeta.textContent = '⚠️ Pedido não encontrado na lista.';
      return;
    }

    selectedOrder = order;

    // Load items and open items modal
    try {
      closeModal(orderModal);
      openModal(orderItemsModal);

      const id = order.order_id ?? order.id ?? orderId;
      orderItemsMeta.textContent = `Pedido #${id} • Carregando itens...`;

      const { header, items } = await loadOrderItems(id);

      const customer =
        order.customer_name ||
        header.customer_name ||
        header.customer?.name ||
        header.nome_cliente ||
        header.nome_razao_social ||
        '—';

      orderItemsMeta.textContent = `Pedido #${id} • ${customer} • Itens: ${items.length}`;
      renderOrderItems(items);
    } catch (err) {
      orderItemsMeta.textContent = `Pedido #${orderId} • ⚠️ ${err.message}`;
      orderItemsTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Erro ao carregar itens: ${escapeHtml(err.message)}</td></tr>`;
      btnConfirmOrderItems.disabled = true;
    }
  });

  // Confirm items
  btnConfirmOrderItems.addEventListener('click', () => {
    if (!selectedOrder) return;

    const payload = {
      order: selectedOrder,
      items: selectedItems || [],
    };

    if (onPick) onPick(payload);

    closeAll();
  });

  // Open initial modal
  orderModalMeta.textContent = 'Digite para buscar...';
  orderSearch.value = '';
  orderTbody.innerHTML = `<tr><td colspan="5" class="plx-empty">Digite para buscar...</td></tr>`;
  openModal(orderModal);
  setTimeout(() => orderSearch.focus(), 50);
}
