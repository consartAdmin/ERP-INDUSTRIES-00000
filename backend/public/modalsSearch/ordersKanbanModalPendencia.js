// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanModalPendencia.js — Modal Pendências (PRODNEX ERP | ESM) ║
// ║ Path: /public/modalsSearch/ordersKanbanModalPendencia.js             ║
// ║ Abre/injeta modal e integra com /api/orders-kanban                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

let modalEl = null;

// Pendência em edição (null = modo adicionar)
let editingId = null;
let openPendingsById = new Map();
let currentApiBase = '';

function ensureModal() {
  if (modalEl) return modalEl;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="kbPendModal" class="ok-modal ok-kb-pend-modal" aria-hidden="true">
      <div class="ok-modal__backdrop" data-modal-close></div>
      <div class="ok-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="kbPendTitle">
        <header class="ok-modal__header">
          <h3 id="kbPendTitle">📌 Pendências do Pedido</h3>
          <button type="button" class="ok-modal__close btn-flat btn-sm" data-modal-close>✕</button>
        </header>

        <section class="ok-modal__body">
          <div class="ok-pend-form">
           <div class="fields-inline fields-gap-3">
            <div class="fields fields-w-20 fields-h-6">
              <label for="kbPendProduto">🔍 Produto</label>
              <input type="text" id="kbPendProduto" placeholder="Selecione o produto…" readonly />
              <input type="hidden" id="kbPendProdutoId" />
            </div>

            <div class="fields fields-w-8 fields-h-6">
              <button type="button" id="kbPendBuscarProduto" class="btn btn-secondary btn-sm">🔎 Buscar</button>
            </div>

            <div class="fields fields-w-13 fields-h-6">
              <label for="kbPendUnidade">📏 Unidade</label>
              <select id="kbPendUnidade" disabled>
                <option value="">Selecione o produto…</option>
              </select>
            </div>

            <div class="fields fields-w-7 fields-h-6">
              <label for="kbPendQtd">📦 Quantidade</label>
              <input type="number" id="kbPendQtd" value="1" min="1" />
            </div>

            <div class="fields fields-w-10 fields-h-6">
              <button type="button" id="kbPendAdd" class="btn btn-primary btn-sm">💾 Adicionar</button>
            </div>

            <div class="fields fields-w-10 fields-h-6" id="kbPendCancelWrap" hidden>
              <button type="button" id="kbPendCancelEdit" class="btn btn-secondary btn-sm">✕ Cancelar</button>
            </div>
           </div>

           <div class="fields-inline fields-gap-3">
            <div class="fields fields-w-full fields-h-6">
              <label for="kbPendObs">📝 Observação (opcional)</label>
              <input type="text" id="kbPendObs" />
            </div>
           </div>
          </div>

          <div class="ok-pend-lists">
            <div class="ok-pend-group">
              <h4>⏳ Pendências Abertas</h4>
              <div id="kbPendListOpen" class="ok-pend-list"></div>
            </div>

            <div class="ok-pend-group">
              <h4>✅ Pendências Concluídas</h4>
              <div id="kbPendListDone" class="ok-pend-list"></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  modalEl = wrap.firstElementChild;
  document.body.appendChild(modalEl);

  // Fechar por click (X / backdrop / qualquer data-modal-close)
  modalEl.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeModal();
    });
  });

  // ESC fecha
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && modalEl?.classList.contains('is-open')) {
      closeModal();
    }
  });

  // Impede clique dentro do dialog fechar por bubbling
  const dialog = modalEl.querySelector('.ok-modal__dialog');
  dialog?.addEventListener('click', (ev) => ev.stopPropagation());

  return modalEl;
}

function openModal() {
  const m = ensureModal();
  m.classList.add('is-open');
  m.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  modalEl.setAttribute('aria-hidden', 'true');
}

async function http(apiRoot, method, path, body) {
  const url = `${apiRoot}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} => ${res.status} ${res.statusText} | ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

function formatQty(p) {
  return p.unit ? `${p.quantity} ${p.unit}` : `${p.quantity}`;
}

function escAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resetUnitSelect(placeholder = 'Selecione o produto…') {
  const sel = modalEl?.querySelector('#kbPendUnidade');
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  sel.disabled = true;
}

// Limpa o formulário e volta para o modo adicionar
function resetForm() {
  editingId = null;
  modalEl.querySelector('#kbPendProduto').value = '';
  modalEl.querySelector('#kbPendProdutoId').value = '';
  modalEl.querySelector('#kbPendQtd').value = '1';
  modalEl.querySelector('#kbPendObs').value = '';
  modalEl.querySelector('#kbPendAdd').textContent = '💾 Adicionar';
  modalEl.querySelector('#kbPendCancelWrap').hidden = true;
  modalEl.querySelectorAll('.ok-pend-item--editing').forEach((el) => el.classList.remove('ok-pend-item--editing'));
  resetUnitSelect();
}

// Carrega a pendência no formulário para edição
function startEdit(apiBase, p) {
  editingId = Number(p.pending_id);
  modalEl.querySelector('#kbPendProduto').value = `${p.product_code || ''} - ${p.product_description || ''}`;
  modalEl.querySelector('#kbPendProdutoId').value = p.product_code || '';
  modalEl.querySelector('#kbPendQtd').value = String(p.quantity ?? 1);
  modalEl.querySelector('#kbPendObs').value = p.note || '';
  modalEl.querySelector('#kbPendAdd').textContent = '💾 Salvar';
  modalEl.querySelector('#kbPendCancelWrap').hidden = false;

  modalEl.querySelectorAll('.ok-pend-item--editing').forEach((el) => el.classList.remove('ok-pend-item--editing'));
  modalEl.querySelector(`.ok-pend-item[data-id="${editingId}"]`)?.classList.add('ok-pend-item--editing');

  loadUnitsForProduct(apiBase, p.product_code, p.unit, p.barcode_id);
  modalEl.querySelector('#kbPendQtd')?.focus();
}

// Unidades ativas do produto (tabela productsBarCode)
async function loadUnitsForProduct(apiBase, productCode, preferredUnit, preferredBarcodeId) {
  const sel = modalEl.querySelector('#kbPendUnidade');
  if (!sel) return;

  const code = String(productCode || '').trim();
  if (!code) {
    resetUnitSelect('Produto sem código');
    return;
  }

  resetUnitSelect('Carregando…');

  let rows = [];
  try {
    const base = (apiBase || '').replace(/\/$/, '');
    const res = await fetch(`${base}/api/barcodes/active-units?product_code=${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
  } catch (err) {
    console.error('[PendModal] units load error:', err);
  }

  // Uma opção por unidade (a tabela pode ter mais de um código de barras por unidade)
  const seen = new Set();
  const units = rows.filter((u) => {
    const key = String(u.unit || '').trim().toUpperCase();
    if (!key || !u.barcode_id || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!units.length) {
    resetUnitSelect('Nenhuma unidade cadastrada');
    return;
  }

  const preferred = String(preferredUnit || '').trim().toUpperCase();
  const selected =
    units.find((u) => preferredBarcodeId && String(u.barcode_id) === String(preferredBarcodeId)) ||
    units.find((u) => String(u.unit).trim().toUpperCase() === preferred) ||
    units.find((u) => u.standard === true) ||
    units[0];

  sel.innerHTML = units.map((u) => {
    const unit = String(u.unit).trim().toUpperCase();
    const fator = Number(u.fator);
    const label = `${unit}${Number.isFinite(fator) && fator > 0 ? ` (${fator.toLocaleString('pt-BR')}x)` : ''}${u.standard ? ' • Padrão' : ''}`;
    return `<option value="${escAttr(u.barcode_id)}"${u === selected ? ' selected' : ''}>${escAttr(label)}</option>`;
  }).join('');
  sel.disabled = false;
}

function splitPendings(data) {
  let pendentes = [];
  let concluidas = [];

  if (Array.isArray(data?.pendentes) || Array.isArray(data?.concluidas)) {
    pendentes = Array.isArray(data.pendentes) ? data.pendentes : [];
    concluidas = Array.isArray(data.concluidas) ? data.concluidas : [];
    return { pendentes, concluidas };
  }

  const arr = Array.isArray(data?.pendings) ? data.pendings : (Array.isArray(data) ? data : []);
  arr.forEach((p) => {
    if ((p.status || '').toLowerCase() === 'concluido') concluidas.push(p);
    else pendentes.push(p);
  });

  return { pendentes, concluidas };
}

function renderLists({ pendentes, concluidas }, apiRoot, cardId, toastError, onChanged) {
  const listOpen = modalEl.querySelector('#kbPendListOpen');
  const listDone = modalEl.querySelector('#kbPendListDone');

  openPendingsById = new Map(pendentes.map((p) => [Number(p.pending_id), p]));

  // a pendência em edição foi concluída/excluída → volta para o modo adicionar
  if (editingId && !openPendingsById.has(editingId)) resetForm();

  if (listOpen) {
    listOpen.innerHTML = pendentes.length
      ? pendentes.map(p => `
        <div class="ok-pend-item${Number(p.pending_id) === editingId ? ' ok-pend-item--editing' : ''}" data-id="${p.pending_id}">
          <div class="ok-pend-main">
            <strong>${p.product_description || '-'}</strong>
            <span class="ok-text-muted">Qtd: ${formatQty(p)}</span>

            <span class="ok-text-muted">Obs: ${p.note || '—'}</span>
          </div>
          <div class="ok-pend-actions">
            <button type="button" class="btn btn-sm btn-secondary js-kb-complete" data-id="${p.pending_id}">✔ Concluir</button>
            <button type="button" class="btn btn-sm btn-secondary js-kb-edit" data-id="${p.pending_id}">✏️ Editar</button>
            <button type="button" class="btn btn-sm btn-danger js-kb-del" data-id="${p.pending_id}">🗑 Excluir</button>
          </div>
        </div>
      `).join('')
      : '<p class="ok-text-muted">Nenhuma pendência aberta.</p>';
  }

  if (listDone) {
    listDone.innerHTML = concluidas.length
      ? concluidas.map(p => `
        <div class="ok-pend-item ok-pend-item--done">
          <div class="ok-pend-main">
            <strong>${p.product_description || '-'}</strong>
            <span class="ok-text-muted">Qtd: ${formatQty(p)}</span>

            <span class="ok-text-muted">Obs: ${p.note || '—'}</span>
          </div>
          <div class="ok-pend-actions">
            <button type="button" class="btn btn-sm btn-secondary js-kb-reopen" data-id="${p.pending_id}">↩ Reabrir</button>
          </div>
        </div>
      `).join('')
      : '<p class="ok-text-muted">Nenhuma pendência concluída.</p>';
  }

  // Reabrir
  listDone?.querySelectorAll('.js-kb-reopen')?.forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(btn.dataset.id);
      try {
        await http(apiRoot, 'PATCH', `/pendings/${id}/reopen`);
        await loadAndRender(apiRoot, cardId, toastError, onChanged);
        onChanged?.();
      } catch (err) {
        console.error('[PendModal] reopen error:', err);
        toastError?.('Erro ao reabrir pendência', err.message);
      }
    });
  });

  // Concluir
  listOpen?.querySelectorAll('.js-kb-complete')?.forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(btn.dataset.id);
      try {
        await http(apiRoot, 'PATCH', `/pendings/${id}/complete`);
        await loadAndRender(apiRoot, cardId, toastError, onChanged);
        onChanged?.();
      } catch (err) {
        console.error('[PendModal] complete error:', err);
        toastError?.('Erro ao concluir pendência', err.message);
      }
    });
  });

  // Editar
  listOpen?.querySelectorAll('.js-kb-edit')?.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const p = openPendingsById.get(Number(btn.dataset.id));
      if (p) startEdit(currentApiBase, p);
    });
  });

  // Excluir
  listOpen?.querySelectorAll('.js-kb-del')?.forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(btn.dataset.id);

      const ok = confirm('Deseja realmente excluir esta pendência?');
      if (!ok) return;

      try {
        await http(apiRoot, 'DELETE', `/pendings/${id}`);
        await loadAndRender(apiRoot, cardId, toastError, onChanged);
        onChanged?.();
      } catch (err) {
        console.error('[PendModal] delete error:', err);
        toastError?.('Erro ao excluir pendência', err.message);
      }
    });
  });
}

async function loadAndRender(apiRoot, cardId, toastError, onChanged) {
  const data = await http(apiRoot, 'GET', `/cards/${cardId}/pendings?pendencias=todas`);
  const split = splitPendings(data);
  renderLists(split, apiRoot, cardId, toastError, onChanged);
}

async function wireProductPicker(apiBase, toastError) {
  const btn = modalEl.querySelector('#kbPendBuscarProduto');
  const input = modalEl.querySelector('#kbPendProduto');
  const hidden = modalEl.querySelector('#kbPendProdutoId');

  if (!btn || !input || !hidden) return;

  btn.onclick = async () => {
    try {
      const mod = await import('/public/modalsSearch/productsModalSearch.js');
      if (typeof mod.openProductsModalSearch !== 'function') return;

      mod.openProductsModalSearch({
        apiBase: apiBase || '',
        onPick(product) {
          const code = product.product_code || product.sku || product.code || '';
          input.value = `${code} - ${product.description || product.nome || ''}`;
          hidden.value = code;
          loadUnitsForProduct(apiBase, code, product.matched_unit || product.unit);
        }
      });
    } catch (err) {
      console.error('[PendModal] product picker error:', err);
      toastError?.('Erro ao abrir busca de produtos', err.message);
    }
  };
}

function wireAddPending(apiRoot, cardId, toastError, onChanged) {
  const btn = modalEl.querySelector('#kbPendAdd');
  const hidden = modalEl.querySelector('#kbPendProdutoId');
  const qtd = modalEl.querySelector('#kbPendQtd');
  const obs = modalEl.querySelector('#kbPendObs');
  const unidade = modalEl.querySelector('#kbPendUnidade');
  if (!btn) return;

  btn.onclick = async () => {
    const productCode = (hidden?.value || '').trim();
    const quantity = Number(qtd?.value || '0');
    const note = (obs?.value || '').trim();
    const barcodeId = Number(unidade?.value) || null;

    if (!productCode || !quantity) {
      toastError?.('Campos obrigatórios', 'Selecione o produto e informe a quantidade.');
      return;
    }

    const payload = {
      product_code: productCode,
      barcode_id: barcodeId,
      quantity,
      note
    };
    const isEdit = !!editingId;

    try {
      if (isEdit) {
        await http(apiRoot, 'PUT', `/pendings/${editingId}`, payload);
      } else {
        await http(apiRoot, 'POST', `/cards/${cardId}/pendings`, payload);
      }

      resetForm();

      await loadAndRender(apiRoot, cardId, toastError, onChanged);
      onChanged?.();
    } catch (err) {
      console.error(`[PendModal] ${isEdit ? 'edit' : 'add'} error:`, err);
      toastError?.(isEdit ? 'Erro ao salvar pendência' : 'Erro ao adicionar pendência', err.message);
    }
  };

  const cancel = modalEl.querySelector('#kbPendCancelEdit');
  if (cancel) cancel.onclick = () => resetForm();
}

/**
 * ✅ API pública
 * Abre o modal de pendências para um card.
 */
export async function openOrdersKanbanPendenciasModal({
  apiRoot,
  apiBase,
  card,
  onChanged,
  toastError
}) {
  ensureModal();

  const cardId = Number(card?.card_id || card?.id || 0);
  if (!cardId) {
    toastError?.('Card inválido', 'Não foi possível identificar o card.');
    return;
  }

  // título contextual
  const title = modalEl.querySelector('#kbPendTitle');
  if (title) {
    const nome = card?.customer_name || 'Pedido';
    const sep = card?.separation_number ? ` • Sep: ${card.separation_number}` : '';
    title.textContent = `📌 Pendências — ${nome}${sep}`;
  }

  openModal();

  // prepara campos
  currentApiBase = apiBase || '';
  resetForm();

  await wireProductPicker(apiBase, toastError);
  wireAddPending(apiRoot, cardId, toastError, onChanged);

  try {
    await loadAndRender(apiRoot, cardId, toastError, onChanged);
  } catch (err) {
    console.error('[PendModal] load error:', err);
    toastError?.('Erro ao carregar pendências', err.message);
  }
}
