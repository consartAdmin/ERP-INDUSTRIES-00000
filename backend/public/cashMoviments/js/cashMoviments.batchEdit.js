// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.batchEdit.js — Alteração em lote das selecionadas      ║
// ║ PRODNEX ERP | Caixa                                                  ║
// ║ - Modal no padrão MODALS.CSS (criado dinamicamente)                  ║
// ║ - Campos: Tipo, Tipo de Documento, Conta, Conta Contábil,            ║
// ║           Categoria, Subcategoria, Dedutível IRPJ/CSLL e PIS/COFINS  ║
// ║ - "— Não alterar —" mantém o valor atual de cada movimentação        ║
// ║ - PATCH /api/caixa/movimentacoes/lote { ids, changes }               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API, PATH_MOV } from './cashMoviments.config.js';
import { LE } from './cashMoviments.utils.js';
import { fetchCashDocumentTypes } from './cashMoviments.documentTypes.js';
import { fetchBankAccounts } from './cashMoviments.bankAccounts.js';
import {
  getSelectedMovementIds,
  clearMovementSelection,
  recarregarLista,
} from './cashMoviments.list.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';

const MODAL_ID = 'cashBatchEditModal';
const KEEP = '';
const CLEAR = '__clear__';
const FROM_SUBCATEGORY = '__subcategory__';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function keepOption() {
  return new Option('— Não alterar —', KEEP);
}

function fillSelect(select, rows, { value = 'id', label = 'name', first = keepOption() } = {}) {
  select.replaceChildren(first);
  rows.forEach((row) => {
    if (row?.[value] == null) return;
    select.add(new Option(String(row[label] ?? ''), String(row[value])));
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || body?.message || `HTTP ${response.status}`);
  return body;
}

function buildModal(count) {
  const root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'modal is-open';
  root.setAttribute('aria-hidden', 'false');
  root.innerHTML = `
    <div class="modal__backdrop" data-close></div>
    <div class="modal__dialog">
      <section class="modal__panel modal-width-6" role="dialog" aria-modal="true" aria-labelledby="bemTitle">
        <header class="modal__header modal-header-color-3">
          <h3 id="bemTitle" class="modal__title">Alterar ${count} movimentação(ões) selecionada(s)</h3>
          <button class="modal__close" type="button" data-close aria-label="Fechar" title="Fechar">&times;</button>
        </header>

        <div class="modal__body">
          <form id="bemForm" class="modal-section" novalidate>
            <p class="bem-help">
              Só os campos alterados serão gravados. Os campos com
              <strong>— Não alterar —</strong> mantêm o valor atual de cada movimentação.
            </p>

            <div class="modal-form-grid modal-form-grid--3">
              <div class="fields fields-h-6 bem-field">
                <label for="bemTipo">Tipo</label>
                <select id="bemTipo">
                  <option value="">— Não alterar —</option>
                  <option value="ENTRADA">ENTRADA</option>
                  <option value="SAIDA">SAÍDA</option>
                </select>
              </div>

              <div class="fields fields-h-6 bem-field">
                <label for="bemDocType">Tipo de Documento</label>
                <select id="bemDocType"><option value="">Carregando...</option></select>
              </div>

              <div class="fields fields-h-6 bem-field">
                <label for="bemConta">Conta</label>
                <select id="bemConta"><option value="">Carregando...</option></select>
              </div>
            </div>

            <div class="modal-form-grid modal-form-grid--3">
              <div class="fields fields-h-6 bem-field">
                <label for="bemChart">Conta Contábil</label>
                <div class="bem-inline">
                  <select id="bemChart">
                    <option value="">— Não alterar —</option>
                    <option value="${CLEAR}">Remover conta contábil</option>
                  </select>
                  <button type="button" class="btn btn-flat btn-sm" id="bemChartSearch"
                    title="Buscar conta contábil" aria-label="Buscar conta contábil">🔍</button>
                </div>
              </div>

              <div class="fields fields-h-6 bem-field">
                <label for="bemCategoria">Categoria</label>
                <select id="bemCategoria"><option value="">Carregando...</option></select>
              </div>

              <div class="fields fields-h-6 bem-field">
                <label for="bemSubcategoria">Subcategoria</label>
                <select id="bemSubcategoria" disabled>
                  <option value="">Escolha a categoria</option>
                </select>
              </div>
            </div>

            <div class="modal-form-grid modal-form-grid--3">
              <div class="fields fields-h-6 bem-field">
                <label for="bemDedutivel">Dedutível no IRPJ/CSLL</label>
                <select id="bemDedutivel">
                  <option value="">— Não alterar —</option>
                  <option value="true">Sim, dedutível</option>
                  <option value="encargos">Só juros, multas e encargos</option>
                  <option value="false">Não dedutível</option>
                  <option value="${FROM_SUBCATEGORY}">Seguir o padrão da subcategoria</option>
                </select>
              </div>

              <div class="fields fields-h-6 bem-field">
                <label for="bemPisCofins">Dedutível no PIS/COFINS</label>
                <select id="bemPisCofins">
                  <option value="">— Não alterar —</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button class="btn btn-cancel btn-sm" type="button" data-close>Cancelar</button>
          <button class="btn btn-save btn-sm" type="submit" form="bemForm">Aplicar alterações</button>
        </footer>
      </section>
    </div>
  `;
  return root;
}

function ensureStyles() {
  if (document.getElementById('bem-styles')) return;
  const style = document.createElement('style');
  style.id = 'bem-styles';
  style.textContent = `
    #${MODAL_ID} { --modal-z-index: 1200; }
    #${MODAL_ID} .bem-field { width: 100%; min-width: 0; }
    #${MODAL_ID} .bem-field select { box-sizing: border-box; width: 100%; }
    #${MODAL_ID} .bem-inline { display: flex; gap: 4px; align-items: stretch; min-width: 0; }
    #${MODAL_ID} .bem-inline select { flex: 1 1 auto; min-width: 0; }
    #${MODAL_ID} .bem-help { margin: 0; color: #64748b; font-size: 12px; }
    #${MODAL_ID} select.bem-changed { border-color: #2563eb; background: #eff6ff; }
  `;
  document.head.appendChild(style);
}

export async function openBatchEditModal(dom) {
  const ids = getSelectedMovementIds();
  if (!ids.length) return;

  ensureStyles();
  document.getElementById(MODAL_ID)?.remove();

  const root = buildModal(ids.length);
  document.body.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const tipo = $('#bemTipo');
  const docType = $('#bemDocType');
  const conta = $('#bemConta');
  const chart = $('#bemChart');
  const categoria = $('#bemCategoria');
  const subcategoria = $('#bemSubcategoria');
  const dedutivel = $('#bemDedutivel');
  const pisCofins = $('#bemPisCofins');
  const submit = root.querySelector('button[form="bemForm"]');

  function close() {
    document.removeEventListener('keydown', onKeydown, true);
    root.remove();
  }

  function onKeydown(event) {
    if (event.key !== 'Escape') return;
    // Busca de conta contábil aberta por cima: deixa ela tratar o ESC
    if (document.querySelector('#chartAccountsModalSearch:not([hidden])')) return;
    event.preventDefault();
    close();
  }

  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', onKeydown, true);

  // Destaque visual dos campos que serão alterados
  const markChanged = (select) => select.classList.toggle('bem-changed', select.value !== KEEP);
  [tipo, docType, conta, chart, categoria, subcategoria, dedutivel, pisCofins].forEach((select) => {
    select.addEventListener('change', () => markChanged(select));
  });

  // Opções
  const loaders = [
    fetchCashDocumentTypes()
      .then((rows) => fillSelect(docType, rows))
      .catch((err) => { LE('[LOTE] tipos de documento', err); docType.replaceChildren(new Option('Erro ao carregar', '')); }),
    fetchBankAccounts()
      .then((rows) => fillSelect(conta, rows))
      .catch((err) => { LE('[LOTE] contas', err); conta.replaceChildren(new Option('Erro ao carregar', '')); }),
    fetchJson(`${API}/categorias`)
      .then((rows) => fillSelect(categoria, (Array.isArray(rows) ? rows : []).filter((r) => r.is_active !== false), { label: 'nome' }))
      .catch((err) => { LE('[LOTE] categorias', err); categoria.replaceChildren(new Option('Erro ao carregar', '')); }),
  ];
  Promise.all(loaders);

  categoria.addEventListener('change', async () => {
    subcategoria.classList.remove('bem-changed');
    if (!categoria.value) {
      subcategoria.replaceChildren(new Option('Escolha a categoria', ''));
      subcategoria.disabled = true;
      return;
    }
    subcategoria.disabled = true;
    subcategoria.replaceChildren(new Option('Carregando...', ''));
    try {
      const rows = await fetchJson(`${API}/subcategorias?categoria_id=${encodeURIComponent(categoria.value)}`);
      fillSelect(
        subcategoria,
        (Array.isArray(rows) ? rows : []).filter((r) => r.is_active !== false),
        { label: 'nome', first: new Option('— Sem subcategoria —', '') },
      );
      subcategoria.disabled = false;
    } catch (err) {
      LE('[LOTE] subcategorias', err);
      subcategoria.replaceChildren(new Option('Erro ao carregar', ''));
    }
  });

  $('#bemChartSearch').addEventListener('click', async () => {
    try {
      const account = await openChartAccountsModalSearch({ onlyPosting: true, onlyActive: true });
      if (!account?.id) return;
      chart.querySelector('option[data-picked]')?.remove();
      const option = new Option(
        [account.code, account.description].filter(Boolean).join(' - ') || `Conta #${account.id}`,
        String(account.id),
      );
      option.dataset.picked = 'true';
      chart.add(option);
      chart.value = String(account.id);
      markChanged(chart);
    } catch (err) {
      LE('[LOTE] conta contábil', err);
    }
  });

  $('#bemForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const changes = {};
    const summary = [];
    const label = (select) => escapeHtml(select.selectedOptions[0]?.textContent?.trim() || '');

    if (tipo.value) { changes.movement_type = tipo.value; summary.push(`Tipo: <b>${label(tipo)}</b>`); }
    if (docType.value) { changes.document_type_id = Number(docType.value); summary.push(`Tipo de Documento: <b>${label(docType)}</b>`); }
    if (conta.value) { changes.bank_account_id = Number(conta.value); summary.push(`Conta: <b>${label(conta)}</b>`); }
    if (chart.value === CLEAR) {
      changes.chart_account_id = null;
      summary.push('Conta Contábil: <b>remover</b>');
    } else if (chart.value) {
      changes.chart_account_id = Number(chart.value);
      summary.push(`Conta Contábil: <b>${label(chart)}</b>`);
    }
    if (categoria.value) {
      changes.category_id = Number(categoria.value);
      changes.subcategory_id = subcategoria.value ? Number(subcategoria.value) : null;
      summary.push(`Categoria: <b>${label(categoria)}</b>`);
      summary.push(`Subcategoria: <b>${subcategoria.value ? label(subcategoria) : 'sem subcategoria'}</b>`);
    }

    if (dedutivel.value) {
      changes.is_deductible = dedutivel.value === FROM_SUBCATEGORY ? null : dedutivel.value !== 'false';
      changes.deduct_charges_only = dedutivel.value === 'encargos';
      summary.push(`Dedutível no IRPJ/CSLL: <b>${label(dedutivel)}</b>`);
    }

    if (pisCofins.value) {
      changes.is_pis_cofins_creditable = pisCofins.value === 'true';
      summary.push(`Dedutível no PIS/COFINS: <b>${label(pisCofins)}</b>`);
    }

    if (!summary.length) {
      showCenterModal({
        variant: 'warning',
        title: 'Nada para alterar',
        message: 'Escolha pelo menos um campo diferente de “— Não alterar —”.',
      });
      return;
    }

    const confirmed = await showCenterModal({
      variant: 'warning',
      title: `Alterar ${ids.length} movimentação(ões)?`,
      message: summary.join('<br>'),
      okText: 'Sim, alterar',
      closeText: 'Cancelar',
    });
    if (confirmed !== true) return;

    submit.disabled = true;
    submit.textContent = '⏳ Aplicando...';
    try {
      const response = await fetch(`${API}/${PATH_MOV}/lote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids, changes }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || body?.message || `HTTP ${response.status}`);
      }

      close();
      clearMovementSelection(dom);
      await recarregarLista(dom);

      showCenterModal({
        variant: 'success',
        title: 'Alteração em lote concluída',
        message: `${body.updated} movimentação(ões) alterada(s).`,
      });
    } catch (err) {
      LE('[LOTE] aplicar', err);
      showCenterModal({
        variant: 'error',
        title: 'Erro ao alterar em lote',
        message: escapeHtml(err?.message || 'Falha ao comunicar com a API.'),
      });
    } finally {
      submit.disabled = false;
      submit.textContent = 'Aplicar alterações';
    }
  });
}
