// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.customerDefaults.js — Padrões financeiros do cliente  ║
// ║ PRODNEX ERP | Caixa                                                 ║
// ║ ✅ Ao selecionar um cliente, pré-preenche Conta Contábil,           ║
// ║    Categoria e Subcategoria cadastradas na aba Financeiro           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE } from './cashMoviments.config.js';
import { encadearSubcategorias } from './cashMoviments.categories.js';
import { LE } from './cashMoviments.utils.js';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) return null;
  return r.json();
}

async function aplicarContaContabil(accountId, inputId, inputLabel) {
  if (!accountId || !inputId) return;

  const js = await fetchJson(`${API_BASE}/api/chart-of-accounts/${encodeURIComponent(accountId)}`);
  const conta = js?.data ?? js;
  if (!conta?.id) return;

  inputId.value = conta.id;
  if (inputLabel) inputLabel.value = `${conta.code ?? ''} - ${conta.description ?? ''}`;
}

async function aplicarCategorias(dom, categoryId, subcategoryId, selCat, selSub) {
  if (!categoryId || !selCat) return;

  const existe = Array.from(selCat.options).some((op) => op.value === String(categoryId));
  if (!existe) return;

  selCat.value = String(categoryId);
  await encadearSubcategorias(dom, selCat, selSub);

  if (subcategoryId && selSub) {
    selSub.value = String(subcategoryId);
    // Atualiza o indicador "Dedutível" vinculado à subcategoria.
    selSub.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Aplica os padrões do cliente no formulário (cadastro ou edição).
 * Só sobrescreve os campos quando o cliente possui o padrão definido.
 *
 * @param {Object} dom  - retorno de getDom()
 * @param {Object} picked - item retornado por openSuppliersModalSearch
 * @param {'create'|'edit'} mode
 */
export async function aplicarPadroesCliente(dom, picked, mode = 'create') {
  if (picked?.entity_type !== 'customer') return;

  const customerId = picked.customer_id ?? picked.id;
  if (!customerId) return;

  const isEdit = mode === 'edit';

  try {
    const js = await fetchJson(`${API_BASE}/api/customers/${encodeURIComponent(customerId)}`);
    const customer = js?.data ?? js;
    if (!customer) return;

    await Promise.all([
      aplicarContaContabil(
        customer.default_chart_account_id,
        isEdit ? dom.elEditChartAccountId : dom.elChartAccountId,
        isEdit ? dom.elEditChartAccountLabel : dom.elChartAccountLabel
      ),
      aplicarCategorias(
        dom,
        customer.default_cash_category_id,
        customer.default_cash_subcategory_id,
        isEdit ? dom.elEditCategoria : dom.elCategoria,
        isEdit ? dom.elEditSubcategoria : dom.elSubcategoria
      ),
    ]);
  } catch (e) {
    LE('padrões do cliente', e);
  }
}
