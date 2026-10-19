// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanModalEditCard.js — Modal Editar Card (PRODNEX ERP | ESM) ║
// ║ Path: /public/modalsSearch/ordersKanbanModalEditCard.js              ║
// ║ Edita cliente, nº separação e observação → PUT /cards/:id            ║
// ║ Visual: reaproveita ordersKanbanModalPendencia.css (ok-kb-pend-modal)║
// ╚══════════════════════════════════════════════════════════════════════╝

let modalEl = null;
let current = null; // { apiRoot, apiBase, card, onSaved, toastError }

function ensureModal() {
  if (modalEl) return modalEl;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="kbEditCardModal" class="ok-modal ok-kb-pend-modal ok-kb-edit-card-modal" aria-hidden="true">
      <div class="ok-modal__backdrop" data-modal-close></div>
      <div class="ok-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="kbEditCardTitle">
        <header class="ok-modal__header">
          <h3 id="kbEditCardTitle">✏️ Editar Card</h3>
          <button type="button" class="ok-modal__close btn-flat btn-sm" data-modal-close>✕</button>
        </header>

        <section class="ok-modal__body">
          <div class="ok-pend-form">
            <div class="fields-inline fields-gap-3">
              <div class="fields fields-grow fields-h-6">
                <label for="kbEditCardCliente">🔍 Cliente</label>
                <input type="text" id="kbEditCardCliente" placeholder="Selecione o cliente…" readonly />
                <input type="hidden" id="kbEditCardClienteId" />
              </div>

              <div class="fields fields-w-8 fields-h-6">
                <button type="button" id="kbEditCardBuscarCliente" class="btn btn-secondary btn-sm">🔎 Buscar</button>
              </div>

              <div class="fields fields-w-15 fields-h-6">
                <label for="kbEditCardSeparacao">🔢 Nº Separação</label>
                <input type="text" id="kbEditCardSeparacao" placeholder="Ex: 0001" />
              </div>
            </div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-w-full">
                <label for="kbEditCardObs">📝 Observações</label>
                <textarea id="kbEditCardObs" rows="3" placeholder="Notas internas para o operador…"></textarea>
              </div>
            </div>

            <div class="ok-kb-edit-card-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-modal-close>✕ Cancelar</button>
              <button type="button" id="kbEditCardSalvar" class="btn btn-primary btn-sm">💾 Salvar</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  modalEl = wrap.firstElementChild;
  document.body.appendChild(modalEl);

  modalEl.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      closeModal();
    });
  });

  document.addEventListener('keydown', (ev) => {
    // a busca de clientes intercepta o próprio ESC (capture + stopPropagation)
    if (ev.key === 'Escape' && modalEl?.classList.contains('is-open')) {
      closeModal();
    }
  });

  modalEl.querySelector('.ok-modal__dialog')?.addEventListener('click', (ev) => ev.stopPropagation());
  modalEl.querySelector('#kbEditCardBuscarCliente')?.addEventListener('click', openCustomerSearch);
  modalEl.querySelector('#kbEditCardSalvar')?.addEventListener('click', save);

  return modalEl;
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.remove('is-open');
  modalEl.setAttribute('aria-hidden', 'true');
  current = null;
}

async function openCustomerSearch() {
  try {
    const mod = await import('/public/modalsSearch/customersModalSearch.js');
    if (typeof mod.openCustomersModalSearch !== 'function') return;

    mod.openCustomersModalSearch({
      apiBase: current?.apiBase || '',
      onPick(customer) {
        modalEl.querySelector('#kbEditCardCliente').value =
          `${customer.trade_name || customer.legal_name || ''} (${customer.tax_id || ''})`;
        modalEl.querySelector('#kbEditCardClienteId').value = customer.customer_id ?? customer.id ?? '';
      }
    });
  } catch (err) {
    console.error('[EditCardModal] customer search error:', err);
    current?.toastError?.('Erro ao abrir busca de clientes', err.message);
  }
}

async function save() {
  if (!current) return;
  const { apiRoot, card, onSaved, toastError } = current;

  const customerId = Number(modalEl.querySelector('#kbEditCardClienteId').value);
  const separation = modalEl.querySelector('#kbEditCardSeparacao').value.trim();
  const note = modalEl.querySelector('#kbEditCardObs').value.trim();

  if (!customerId) {
    toastError?.('Cliente obrigatório', 'Selecione um cliente para o card.');
    return;
  }

  const btn = modalEl.querySelector('#kbEditCardSalvar');
  btn.disabled = true;

  try {
    const res = await fetch(`${apiRoot}/cards/${card.card_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, separation_number: separation, note })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toastError?.('Erro ao salvar card', data.erro || `Erro ${res.status}`);
      return;
    }

    closeModal();
    await onSaved?.(data);
  } catch (err) {
    console.error('[EditCardModal] save error:', err);
    toastError?.('Erro ao salvar card', err.message);
  } finally {
    btn.disabled = false;
  }
}

/**
 * ✅ API pública
 * Abre o modal de edição para um card do Kanban.
 */
export function openOrdersKanbanEditCardModal({ apiRoot, apiBase, card, onSaved, toastError }) {
  ensureModal();

  if (!card?.card_id) {
    toastError?.('Card inválido', 'Não foi possível identificar o card.');
    return;
  }

  current = { apiRoot, apiBase, card, onSaved, toastError };

  const nome = card.customer_name || '';
  const doc = card.customer_tax_id ? ` (${card.customer_tax_id})` : '';

  modalEl.querySelector('#kbEditCardTitle').textContent = `✏️ Editar Card #${card.card_id}`;
  modalEl.querySelector('#kbEditCardCliente').value = nome ? `${nome}${doc}` : '';
  modalEl.querySelector('#kbEditCardClienteId').value = card.customer_id ?? '';
  modalEl.querySelector('#kbEditCardSeparacao').value = card.separation_number || '';
  modalEl.querySelector('#kbEditCardObs').value = card.note || '';

  modalEl.classList.add('is-open');
  modalEl.setAttribute('aria-hidden', 'false');
  modalEl.querySelector('#kbEditCardSeparacao')?.focus();
}
