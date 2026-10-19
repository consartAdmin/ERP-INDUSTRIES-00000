// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerFinancialDefaults.js — Classificação Financeira Padrão      ║
// ║ PRODNEX ERP | compartilhado: customersEdit + customersRegistration  ║
// ║ Plano de Contas / Categoria / Subcategoria do cliente, importados   ║
// ║ automaticamente na Movimentação de Caixa ao selecionar o cliente.   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';
import { openChartOfAccountsModal } from '/public/chartOfAccounts/chartOfAccountsModal.js';
import { apiFetch } from '/public/includes/js/apiFetch.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { Modal } from '/public/includes/js/modal.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const ROUTES = Object.freeze({
  categorias: `${API_BASE}/api/caixa/categorias`,
  criarSubcategoria: `${API_BASE}/api/caixa/subcategorias`,
  subcategorias: (categoriaId) =>
    `${API_BASE}/api/caixa/subcategorias?categoria_id=${encodeURIComponent(categoriaId)}`,
  chartAccountById: (id) =>
    `${API_BASE}/api/chart-of-accounts/${encodeURIComponent(id)}`,
});

const byId = (id) => document.getElementById(id);

const els = () => ({
  accountId: byId('default_chart_account_id'),
  accountLabel: byId('default_chart_account_label'),
  btnAccount: byId('btnDefaultChartAccount'),
  btnClearAccount: byId('btnClearDefaultChartAccount'),
  btnNewAccount: byId('btnNewDefaultChartAccount'),
  category: byId('default_cash_category_id'),
  btnNewCategory: byId('btnNewDefaultCashCategory'),
  subcategory: byId('default_cash_subcategory_id'),
  btnNewSubcategory: byId('btnNewDefaultCashSubcategory'),
});

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  return r.json();
}

function fillSelect(select, rows) {
  if (!select) return;

  select.innerHTML = '<option value="">— Nenhuma —</option>';

  for (const row of rows) {
    const op = document.createElement('option');
    op.value = row.id;
    op.textContent = row.nome ?? row.name ?? '';
    select.appendChild(op);
  }
}

function accountLabel(conta) {
  return `${conta.code ?? ''} - ${conta.description ?? ''}`;
}

async function loadSubcategories(categoryId) {
  const { subcategory } = els();

  if (!categoryId) {
    fillSelect(subcategory, []);
    return;
  }

  const rows = await fetchJson(ROUTES.subcategorias(categoryId));
  fillSelect(subcategory, Array.isArray(rows) ? rows : []);
}

async function loadCategories() {
  const rows = await fetchJson(ROUTES.categorias);
  fillSelect(els().category, Array.isArray(rows) ? rows : []);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------------------------------------------------------------------
// Modal "Nova Categoria / Nova Subcategoria" — mesmos campos (Nome + Ativo)
// e mesmos endpoints da tela Caixa › Categorias & Subcategorias.
// Padrão global: /public/includes/js/modal.js + modals.css.
// Resolve com o registro criado, ou null se fechado sem salvar.
// ---------------------------------------------------------------------
const QUICK_MODAL_ID = 'cfdQuickCreateModal';

const quickState = { save: null, resolve: null, saving: false };

function ensureQuickModal() {
  let modal = byId(QUICK_MODAL_ID);
  if (modal) return modal;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${QUICK_MODAL_ID}" class="modal" aria-hidden="true">
      <div class="modal__backdrop" data-modal-close></div>

      <div class="modal__dialog">
        <section class="modal__panel modal-width-4" role="dialog" aria-modal="true"
          aria-labelledby="cfdQuickTitle">

          <header class="modal__header modal-header-color-3">
            <h3 id="cfdQuickTitle" class="modal__title"></h3>
            <button class="modal__close" type="button" data-modal-close aria-label="Fechar" title="Fechar">×</button>
          </header>

          <div class="modal__body">
            <form id="cfdQuickForm" novalidate>
              <p id="cfdQuickSubtitle" class="coa-modal__subtitle"></p>

              <div class="modal-form-grid modal-form-grid--3">
                <div class="fields fields-h-6 fields-w-full modal-field--span-2">
                  <label for="cfdQuickNome">Nome</label>
                  <input id="cfdQuickNome" type="text" maxlength="120" autocomplete="off">
                </div>

                <div class="fields fields-h-6 fields-w-full">
                  <label for="cfdQuickAtivo">Status</label>
                  <select id="cfdQuickAtivo">
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div id="cfdQuickError" class="coa-modal__error hidden"></div>
            </form>
          </div>

          <footer class="modal__footer modal-footer-color-3">
            <button class="btn btn-cancel btn-sm" type="button" data-modal-close>Cancelar</button>
            <button id="cfdQuickSaveBtn" class="btn btn-save btn-sm" type="submit" form="cfdQuickForm">Salvar</button>
          </footer>

        </section>
      </div>
    </div>
  `);

  modal = byId(QUICK_MODAL_ID);
  Modal.setup();

  // Fechou sem salvar (X, Cancelar, backdrop, ESC) → resolve null
  modal.addEventListener('modal:close', () => {
    const resolve = quickState.resolve;
    quickState.resolve = null;
    resolve?.(null);
  });

  byId('cfdQuickForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (quickState.saving) return;

    const error = byId('cfdQuickError');
    const btnSave = byId('cfdQuickSaveBtn');
    const nome = byId('cfdQuickNome');

    const payload = {
      nome: nome.value.trim(),
      is_active: byId('cfdQuickAtivo').value === 'true',
    };

    if (!payload.nome) {
      error.textContent = 'Informe o nome.';
      error.classList.remove('hidden');
      nome.focus();
      return;
    }

    quickState.saving = true;
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';

    try {
      const res = await quickState.save(payload);
      const resolve = quickState.resolve;
      quickState.resolve = null;
      Modal.close(QUICK_MODAL_ID);
      resolve?.(res?.data ?? res);
    } catch (err) {
      console.error('[customersEdit] criar categoria/subcategoria:', err);
      error.textContent = err?.message || 'Falha ao salvar.';
      error.classList.remove('hidden');
    } finally {
      quickState.saving = false;
      btnSave.disabled = false;
      btnSave.textContent = 'Salvar';
    }
  });

  return modal;
}

function openNomeAtivoModal({ title, subtitle, placeholder, save }) {
  ensureQuickModal();

  byId('cfdQuickTitle').textContent = title;
  byId('cfdQuickSubtitle').innerHTML = subtitle;
  byId('cfdQuickNome').value = '';
  byId('cfdQuickNome').placeholder = placeholder;
  byId('cfdQuickAtivo').value = 'true';
  byId('cfdQuickError').classList.add('hidden');

  return new Promise((resolve) => {
    quickState.save = save;
    quickState.resolve = resolve;
    Modal.open(QUICK_MODAL_ID, { focusSelector: '#cfdQuickNome' });
  });
}

// ---------------------------------------------------------------------
// Init — carrega categorias e liga eventos (antes de loadCustomer)
// ---------------------------------------------------------------------
export async function initFinancialDefaults() {
  const e = els();
  if (!e.category) return;

  try {
    await loadCategories();
  } catch (err) {
    console.error('[customersEdit] categorias:', err);
  }

  e.category.addEventListener('change', () => {
    loadSubcategories(e.category.value).catch((err) =>
      console.error('[customersEdit] subcategorias:', err)
    );
  });

  async function pickAccount() {
    const conta = await openChartAccountsModalSearch({
      onlyPosting: true,
      onlyActive: true,
    });

    if (!conta) return;

    e.accountId.value = conta.id ?? '';
    e.accountLabel.value = accountLabel(conta);
  }

  e.btnAccount?.addEventListener('click', pickAccount);
  e.accountLabel?.addEventListener('dblclick', pickAccount);

  e.btnClearAccount?.addEventListener('click', () => {
    e.accountId.value = '';
    e.accountLabel.value = '';
  });

  // + Plano de Contas → modal existente de criação de conta contábil
  e.btnNewAccount?.addEventListener('click', () => {
    openChartOfAccountsModal({
      mode: 'create',
      onSaved: (conta) => {
        if (!conta?.id) return;

        // O campo só aceita contas analíticas (mesmo filtro da busca 🔎)
        if (conta.allows_posting === false) {
          showCenterModal({
            variant: 'warning',
            title: 'Conta criada',
            message: 'A conta foi criada, mas não aceita lançamento e por isso não foi selecionada.',
          });
          return;
        }

        e.accountId.value = conta.id;
        e.accountLabel.value = accountLabel(conta);
      },
    });
  });

  // + Categoria
  e.btnNewCategory?.addEventListener('click', async () => {
    const created = await openNomeAtivoModal({
      title: 'Nova Categoria',
      subtitle: 'Categoria de caixa (Caixa › Categorias).',
      placeholder: 'Nome da categoria',
      save: (payload) =>
        apiFetch(ROUTES.categorias, { method: 'POST', body: JSON.stringify(payload) }),
    });
    if (!created?.id) return;

    try {
      await loadCategories();
      e.category.value = String(created.id);
      await loadSubcategories(e.category.value);
    } catch (err) {
      console.error('[customersEdit] categorias:', err);
    }
  });

  // + Subcategoria — criada dentro da categoria selecionada
  e.btnNewSubcategory?.addEventListener('click', async () => {
    const categoriaId = Number(e.category.value);
    if (!categoriaId) {
      showCenterModal({
        variant: 'warning',
        title: 'Selecione uma categoria',
        message: 'Escolha a categoria antes de cadastrar uma subcategoria.',
      });
      return;
    }

    const categoriaNome = e.category.selectedOptions[0]?.textContent ?? '';

    const created = await openNomeAtivoModal({
      title: 'Nova Subcategoria',
      subtitle: `Categoria: <strong>${escapeHtml(categoriaNome)}</strong>`,
      placeholder: 'Nome da subcategoria',
      save: (payload) =>
        apiFetch(ROUTES.criarSubcategoria, {
          method: 'POST',
          body: JSON.stringify({ categoria_id: categoriaId, ...payload }),
        }),
    });
    if (!created?.id) return;

    try {
      await loadSubcategories(categoriaId);
      e.subcategory.value = String(created.id);
    } catch (err) {
      console.error('[customersEdit] subcategorias:', err);
    }
  });
}

// ---------------------------------------------------------------------
// Fill — preenche a partir do cliente carregado
// ---------------------------------------------------------------------
export async function fillFinancialDefaults(c = {}) {
  const e = els();
  if (!e.category) return;

  const accountId = c.default_chart_account_id ?? '';
  e.accountId.value = accountId;
  e.accountLabel.value = '';

  if (accountId) {
    try {
      const js = await fetchJson(ROUTES.chartAccountById(accountId));
      const conta = js?.data ?? js;
      e.accountLabel.value = conta?.id ? accountLabel(conta) : `#${accountId}`;
    } catch (err) {
      console.error('[customersEdit] conta contábil:', err);
      e.accountLabel.value = `#${accountId}`;
    }
  }

  const categoryId = c.default_cash_category_id ?? '';
  e.category.value = String(categoryId);

  try {
    await loadSubcategories(e.category.value);
  } catch (err) {
    console.error('[customersEdit] subcategorias:', err);
  }

  e.subcategory.value = String(c.default_cash_subcategory_id ?? '');
}

// ---------------------------------------------------------------------
// Read — chaves para o payload do PUT /api/customers/:id
// ---------------------------------------------------------------------
export function readFinancialDefaults() {
  const e = els();
  if (!e.category) return {};

  const toId = (v) => (v ? Number(v) : null);

  return {
    default_chart_account_id: toId(e.accountId?.value),
    default_cash_category_id: toId(e.category?.value),
    default_cash_subcategory_id: e.category?.value ? toId(e.subcategory?.value) : null,
  };
}
