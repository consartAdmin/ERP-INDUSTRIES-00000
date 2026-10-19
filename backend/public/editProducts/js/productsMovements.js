// ╔══════════════════════════════════════════════════════════════╗
// ║ productsMovements.js — Registros do Produto                 ║
// ║ PRODNEX ERP | Edit Products                                 ║
// ║ ✅ Estoque antes/depois em uma única coluna                  ║
// ║ ✅ Grade                                                     ║
// ║ ✅ Lote                                                      ║
// ║ ✅ NF-e Emitidas                                             ║
// ╚══════════════════════════════════════════════════════════════╝

const API_BASE =
  (typeof window !== 'undefined' && window.apiBase) ||
  window.location.origin;

function getProductCode() {
  const inputSku = document.querySelector('#produtoId');
  return String(inputSku?.value || '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getMetadata(row) {
  if (!row?.metadata) return {};

  if (typeof row.metadata === 'object') {
    return row.metadata;
  }

  try {
    return JSON.parse(row.metadata);
  } catch {
    return {};
  }
}

function formatDate(value) {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatQty(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return escapeHtml(value);
  }

  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function movementLabel(type) {
  const map = {
    ENTRADA: 'Entrada',
    SAIDA: 'Saída',
    INVENTARIO: 'Inventário',
    AJUSTE: 'Ajuste',
  };

  return map[type] || type || '—';
}

function movementClass(type) {
  const t = String(type || '').toUpperCase();

  if (t === 'SAIDA') return 'mov-badge--saida';
  if (t === 'ENTRADA') return 'mov-badge--entrada';
  if (t === 'INVENTARIO') return 'mov-badge--inventario';
  if (t === 'AJUSTE') return 'mov-badge--ajuste';

  return '';
}

function qtyClass(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n < 0) return 'qty-out';
  if (n > 0) return 'qty-in';
  return '';
}

function renderEmpty(message = 'Nenhum registro carregado.') {
  const tbody = document.querySelector('#registrosProdutoBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="muted" style="padding:12px 14px;">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

function getGrade(row) {
  const meta = getMetadata(row);

  return (
    meta.grade_id ||
    row?.grade_id ||
    '—'
  );
}

function getLot(row) {
  const meta = getMetadata(row);

  return (
    row?.lot_code ||
    meta.lot_code ||
    '—'
  );
}

function getStockBefore(row) {
  const meta = getMetadata(row);

  return formatQty(
    row?.previous_stock ??
    meta.stock_before
  );
}

function getStockAfter(row) {
  const meta = getMetadata(row);

  return formatQty(
    row?.new_stock ??
    meta.stock_after
  );
}

function formatOrigin(row) {
  if (
    String(row?.origin_module || '').toLowerCase() === 'invoiceissued'
  ) {
    return row?.origin_id
      ? `NF-e Emitida #${row.origin_id}`
      : 'NF-e Emitida';
  }

  return [
    row?.origin_module,
    row?.origin_table,
    row?.origin_id ? `#${row.origin_id}` : null,
  ].filter(Boolean).join(' / ');
}

function renderStockFlow(before, after) {
  if (before === '—' && after === '—') {
    return '<span class="muted">—</span>';
  }

  return `
    <span class="stock-flow" title="Estoque antes e depois da movimentação">
      <span class="stock-flow__before">${escapeHtml(before)}</span>
      <span class="stock-flow__arrow">→</span>
      <span class="stock-flow__after">${escapeHtml(after)}</span>
    </span>
  `;
}

function renderRows(rows = []) {
  const tbody = document.querySelector('#registrosProdutoBody');
  if (!tbody) return;

  if (!Array.isArray(rows) || !rows.length) {
    renderEmpty('Nenhum registro encontrado para este produto.');
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const origem = formatOrigin(r);

    const qty = formatQty(r.quantity);
    const unit = r.unit ? ` ${escapeHtml(r.unit)}` : '';

    const grade = getGrade(r);
    const lote = getLot(r);

    const estoqueAntes = getStockBefore(r);
    const estoqueDepois = getStockAfter(r);

    return `
      <tr>
        <td>${escapeHtml(formatDate(r.created_at))}</td>

        <td>
          <span class="mov-badge ${movementClass(r.movement_type)}">
            ${escapeHtml(movementLabel(r.movement_type))}
          </span>
        </td>

        <td>
          <span class="origin-text" title="${escapeHtml(origem || '—')}">
            ${escapeHtml(origem || '—')}
          </span>
        </td>

        <td>
          <span class="${qtyClass(r.quantity)}">
            ${qty}${unit}
          </span>
        </td>

        <td>
          ${renderStockFlow(estoqueAntes, estoqueDepois)}
        </td>

        <td>
          <span class="pill">${escapeHtml(grade)}</span>
        </td>

        <td>
          <span class="pill" title="${escapeHtml(lote)}">${escapeHtml(lote)}</span>
        </td>

        <td>${escapeHtml(r.user_id || '—')}</td>

        <td>
          <span class="notes-text">${escapeHtml(r.notes || '—')}</span>
        </td>
      </tr>
    `;
  }).join('');
}

export async function carregarRegistrosProduto() {
  const productCode = getProductCode();

  if (!productCode) {
    renderEmpty('SKU do produto não encontrado.');
    return;
  }

  renderEmpty('Carregando registros...');

  try {
    const url =
      `${API_BASE}/api/products/${encodeURIComponent(productCode)}/registros`;

    console.debug('[productsMovements] GET', url);

    const res = await fetch(url);
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    renderRows(data.rows || []);
  } catch (err) {
    console.error('[productsMovements] error:', err);
    renderEmpty(`Erro ao carregar registros: ${err.message}`);
  }
}

function setupProductsMovements() {
  const btn = document.querySelector('#btnAtualizarRegistrosProduto');

  if (btn) {
    btn.addEventListener('click', carregarRegistrosProduto);
  }

  document.addEventListener('click', (ev) => {
    const tabBtn = ev.target.closest('.aba-btn[data-aba="aba-registros"]');

    if (tabBtn) {
      setTimeout(carregarRegistrosProduto, 80);
    }
  });

  const url = new URL(window.location.href);
  const tab = url.searchParams.get('tab');

  if (tab === 'registros') {
    setTimeout(carregarRegistrosProduto, 300);
  }
}

export function initProductMovementsTab(ctx, { productCode } = {}) {
  console.log('[productsMovements] initialized', productCode);

  setupProductsMovements();

  const url = new URL(window.location.href);
  const tab = url.searchParams.get('tab');

  if (tab === 'registros') {
    setTimeout(carregarRegistrosProduto, 300);
  }
}