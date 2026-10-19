// ╔══════════════════════════════════════════════════════════════════════╗
// ║ quickCreate.js — Botões "+" da aba Dados Gerais (Editar Produto)     ║
// ║ PRODNEX ERP — ESM                                                   ║
// ║ - Grupo / Subgrupo / Fabricante: modal rápido (somente nome)         ║
// ║ - Fornecedor: modal completo de cadastro (suppliers.quickModal.js)   ║
// ║ - Após criar: adiciona a opção no <select> e já seleciona            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openSuppliersModal } from '/public/suppliers/js/suppliers.quickModal.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ──────────────────────────────────────────────────────────────
// Modal rápido: pede apenas o nome e executa onSave(name)
// Resolve com o registro criado ou null se cancelado.
// ──────────────────────────────────────────────────────────────
function openNameModal({ title, label, maxLength, subtitle = '', onSave }) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal is-open';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'quickCreateTitle');

    modal.innerHTML = `
      <div class="modal__backdrop"></div>

      <div class="modal__dialog">
        <section class="modal__panel modal__panel--sm">
          <header class="modal__header modal-header-color-3">
            <h2 id="quickCreateTitle" class="modal__title">${escapeHtml(title)}</h2>
            <button type="button" class="modal__close" data-modal-close aria-label="Fechar">&times;</button>
          </header>

          <form class="modal__body" data-quick-form>
            ${subtitle ? `<p class="help-text">${escapeHtml(subtitle)}</p>` : ''}
            <div class="fields fields-h-6">
              <span>${escapeHtml(label)}</span>
              <input type="text" data-quick-name maxlength="${maxLength}" autocomplete="off" required>
            </div>
            <p class="quick-create-error" data-quick-error hidden></p>
          </form>

          <footer class="modal__footer modal-footer-color-3">
            <button type="button" data-modal-cancel class="btn btn-new btn-sm">Cancelar</button>
            <button type="button" data-modal-confirm class="btn btn-new btn-sm">Salvar</button>
          </footer>
        </section>
      </div>
    `;

    const form = modal.querySelector('[data-quick-form]');
    const input = modal.querySelector('[data-quick-name]');
    const errorEl = modal.querySelector('[data-quick-error]');
    const confirmButton = modal.querySelector('[data-modal-confirm]');
    let busy = false;

    const finish = (result) => {
      document.removeEventListener('keydown', handleKeydown);
      modal.remove();
      resolve(result);
    };

    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    };

    const save = async () => {
      if (busy) return;

      const name = input.value.trim();
      if (!name) {
        showError(`Informe o ${label.toLowerCase()}.`);
        input.focus();
        return;
      }

      busy = true;
      confirmButton.disabled = true;
      confirmButton.textContent = 'Salvando...';
      showError('');

      try {
        const created = await onSave(name);
        finish(created);
      } catch (err) {
        const details = err?.body?.details;
        showError(
          (Array.isArray(details) && details.length ? details.join(' ') : '') ||
          err?.message ||
          'Falha ao salvar.'
        );
        input.focus();
      } finally {
        busy = false;
        confirmButton.disabled = false;
        confirmButton.textContent = 'Salvar';
      }
    };

    function handleKeydown(event) {
      if (event.key === 'Escape' && !busy) finish(null);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      save();
    });
    confirmButton.addEventListener('click', save);
    modal.querySelector('[data-modal-cancel]').addEventListener('click', () => !busy && finish(null));
    modal.querySelector('[data-modal-close]').addEventListener('click', () => !busy && finish(null));
    modal.querySelector('.modal__backdrop').addEventListener('click', () => !busy && finish(null));
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(modal);
    setTimeout(() => input.focus(), 0);
  });
}

// ──────────────────────────────────────────────────────────────
// Adiciona (ou reaproveita) a opção no <select> e seleciona
// ──────────────────────────────────────────────────────────────
function selectOption(sel, id, text) {
  if (!sel || id == null) return;

  const value = String(id);
  let opt = Array.from(sel.options).find((o) => o.value === value);

  if (!opt) {
    opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text || `#${value}`;
    sel.appendChild(opt);
  }

  sel.disabled = false;
  sel.value = value;
}

export function initQuickCreate(ctx, { FIELDS }) {
  const post = (path, body) =>
    ctx.jfetch(`${ctx.API_BASE}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((resp) => resp?.data ?? resp);

  const handlers = {
    async group() {
      const sel = ctx.$(FIELDS.product_group_id);

      const created = await openNameModal({
        title: 'Novo Grupo',
        label: 'Nome do grupo',
        maxLength: 100,
        onSave: (name) => post('/api/products-groups', { name }),
      });
      if (!created) return;

      selectOption(sel, created.product_group_id ?? created.id, created.name);
      // recarrega o subgrupo para o novo grupo (fica vazio até criar um)
      sel?.dispatchEvent(new Event('change'));
      ctx.toast(`Grupo "${created.name}" cadastrado.`, 'success');
    },

    async subgroup() {
      const grp = ctx.$(FIELDS.product_group_id);
      const sub = ctx.$(FIELDS.product_subgroup_id);
      const groupId = Number(grp?.value);

      if (!groupId) {
        ctx.toast('Selecione um grupo antes de cadastrar o subgrupo.', 'warning');
        return;
      }

      const groupName = grp.options[grp.selectedIndex]?.textContent || '';

      const created = await openNameModal({
        title: 'Novo Subgrupo',
        label: 'Nome do subgrupo',
        maxLength: 100,
        subtitle: `Grupo: ${groupName}`,
        onSave: (name) => post('/api/products-subgroups', { name, group_id: groupId }),
      });
      if (!created) return;

      // remove o placeholder "Nenhum subgrupo encontrado" se for a única opção
      if (sub && sub.options.length === 1 && sub.options[0].value === '') {
        sub.options[0].textContent = 'Selecione...';
      }

      selectOption(sub, created.product_subgroup_id ?? created.id, created.name);
      ctx.toast(`Subgrupo "${created.name}" cadastrado.`, 'success');
    },

    async manufacturer() {
      const sel = ctx.$(FIELDS.manufacturer_id);

      const created = await openNameModal({
        title: 'Novo Fabricante',
        label: 'Nome do fabricante',
        maxLength: 150,
        onSave: (name) => post('/api/products-manufacturers', { name }),
      });
      if (!created) return;

      selectOption(sel, created.product_manufacturer_id ?? created.id, created.name);
      ctx.toast(`Fabricante "${created.name}" cadastrado.`, 'success');
    },

    async supplier() {
      const sel = ctx.$(FIELDS.supplier_id);

      const result = await openSuppliersModal({
        title: 'Cadastrar Fornecedor',
        subtitle: 'Informe os dados do fornecedor para vinculá-lo ao produto.',
      });
      const created = result?.ok ? result.data : null;
      if (!created) return;

      const name =
        created.name || created.trading_name || created.company_name || '';

      selectOption(sel, created.supplier_id ?? created.id, name);
      ctx.toast(`Fornecedor "${name}" cadastrado.`, 'success');
    },
  };

  document.querySelectorAll('[data-quick-add]').forEach((btn) => {
    if (btn.__boundQuickAdd) return;
    btn.__boundQuickAdd = true;

    btn.addEventListener('click', async () => {
      const handler = handlers[btn.dataset.quickAdd];
      if (!handler || btn.disabled) return;

      btn.disabled = true;
      try {
        await handler();
      } catch (err) {
        console.error('[editProducts/quickCreate]', err);
        ctx.toast(`Falha no cadastro: ${err?.message || err}`, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}
