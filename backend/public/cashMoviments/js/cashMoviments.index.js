// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.index.js — Entry (init)                               ║
// ║ PRODNEX ERP | Caixa                                                 ║
// ║ ✅ Inicializa filtros, tabela, fornecedores e plano de contas       ║
// ║ ✅ Integra modal de fornecedores (cadastro + edição)                ║
// ║ ✅ Integra modal de plano de contas (cadastro + edição)             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getDom } from './cashMoviments.dom.js';
import { state } from './cashMoviments.state.js';

import { ensureFitMovsHeightGlobal } from './cashMoviments.layout.js';
import { bindEvents } from './cashMoviments.events.js?v=9';

import { toInputDateTimeLocal } from './cashMoviments.utils.js';
import { carregarAnoMes } from './cashMoviments.filters.js';
import { carregarCategorias, buildAccountsCacheFromSelects } from './cashMoviments.categories.js';
import { recarregarLista } from './cashMoviments.list.js';

import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';
import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';
import { aplicarPadroesCliente } from './cashMoviments.customerDefaults.js';

import {
  loadCashDocumentTypeSelects,
} from './cashMoviments.documentTypes.js';

import {
  loadBankAccountSelects,
} from './cashMoviments.bankAccounts.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

/* =========================================================================
   FORNECEDOR / CLIENTE — CADASTRO
============================================================================ */

function setupFornecedorModal(dom) {
  const inputFornecedor = document.getElementById('fornecedor');
  const btnBuscarFornecedor = document.getElementById('btnBuscarFornecedor');
  const inputFornecedorId = document.getElementById('fornecedorId');
  const inputFornecedorTaxId = document.getElementById('fornecedorTaxId');

  if (!inputFornecedor || !btnBuscarFornecedor) return;

  async function abrirModalFornecedor() {
    try {
      const fornecedor = await openSuppliersModalSearch({ allowCustomers: true });
      if (!fornecedor) return;

      inputFornecedor.value = fornecedor.name ?? '';
      if (inputFornecedorId) inputFornecedorId.value = fornecedor.supplier_id ?? fornecedor.customer_id ?? '';
      if (inputFornecedorTaxId) inputFornecedorTaxId.value = fornecedor.tax_id ?? '';

      // Cliente: pré-preenche conta contábil / categoria / subcategoria
      await aplicarPadroesCliente(dom, fornecedor, 'create');
    } catch (err) {
      console.error('[caixa.index] erro ao selecionar fornecedor:', err);
      alert('Não foi possível abrir a busca de fornecedores.');
    }
  }

  btnBuscarFornecedor.addEventListener('click', abrirModalFornecedor);
  inputFornecedor.addEventListener('dblclick', abrirModalFornecedor);
}

/* =========================================================================
   FORNECEDOR / CLIENTE — EDIÇÃO
============================================================================ */

function setupFornecedorModalEdicao(dom) {
  const inputFornecedor = document.getElementById('edit_fornecedor');
  const btnBuscarFornecedor = document.getElementById('edit_btnBuscarFornecedor');
  const inputFornecedorId = document.getElementById('edit_fornecedorId');
  const inputFornecedorTaxId = document.getElementById('edit_fornecedorTaxId');

  if (!inputFornecedor || !btnBuscarFornecedor) return;

  async function abrirModalFornecedor() {
    try {
      const fornecedor = await openSuppliersModalSearch({ allowCustomers: true });
      if (!fornecedor) return;

      inputFornecedor.value = fornecedor.name ?? '';
      if (inputFornecedorId) inputFornecedorId.value = fornecedor.supplier_id ?? fornecedor.customer_id ?? '';
      if (inputFornecedorTaxId) inputFornecedorTaxId.value = fornecedor.tax_id ?? '';

      // Cliente: pré-preenche conta contábil / categoria / subcategoria
      await aplicarPadroesCliente(dom, fornecedor, 'edit');
    } catch (err) {
      console.error('[caixa.index] erro ao selecionar fornecedor na edição:', err);
      alert('Não foi possível abrir a busca de fornecedores.');
    }
  }

  btnBuscarFornecedor.addEventListener('click', abrirModalFornecedor);
  inputFornecedor.addEventListener('dblclick', abrirModalFornecedor);
}

/* =========================================================================
   CONTA CONTÁBIL — CADASTRO
   Espera no HTML:
   - #chartAccountLabel
   - #chartAccountId
   - #btnBuscarChartAccount
============================================================================ */

function setupChartAccountsModal() {
  const inputLabel = document.getElementById('chartAccountLabel');
  const inputId = document.getElementById('chartAccountId');
  const btn = document.getElementById('btnBuscarChartAccount');

  if (!inputLabel || !inputId || !btn) return;

  async function abrirModal() {
    try {
      const conta = await openChartAccountsModalSearch({
        onlyPosting: true,
        onlyActive: true,
      });

      if (!conta) return;

      inputId.value = conta.id ?? '';
      inputLabel.value = `${conta.code ?? ''} - ${conta.description ?? ''}`;
    } catch (err) {
      console.error('[caixa.index] erro ao selecionar conta contábil:', err);
      alert('Não foi possível abrir a busca de contas contábeis.');
    }
  }

  btn.addEventListener('click', abrirModal);
  inputLabel.addEventListener('dblclick', abrirModal);
}

/* =========================================================================
   CONTA CONTÁBIL — EDIÇÃO
   Espera no HTML:
   - #edit_chartAccountLabel
   - #edit_chartAccountId
   - #edit_btnBuscarChartAccount
============================================================================ */

function setupChartAccountsModalEdicao() {
  const inputLabel = document.getElementById('edit_chartAccountLabel');
  const inputId = document.getElementById('edit_chartAccountId');
  const btn = document.getElementById('edit_btnBuscarChartAccount');

  if (!inputLabel || !inputId || !btn) return;

  async function abrirModal() {
    try {
      const conta = await openChartAccountsModalSearch({
        onlyPosting: true,
        onlyActive: true,
      });

      if (!conta) return;

      inputId.value = conta.id ?? '';
      inputLabel.value = `${conta.code ?? ''} - ${conta.description ?? ''}`;
    } catch (err) {
      console.error('[caixa.index] erro ao selecionar conta contábil na edição:', err);
      alert('Não foi possível abrir a busca de contas contábeis.');
    }
  }

  btn.addEventListener('click', abrirModal);
  inputLabel.addEventListener('dblclick', abrirModal);
}

/* =========================================================================
   INIT
============================================================================ */

/* =========================================================================
   INIT
============================================================================ */

async function init() {
  console.log('[CAIXA][INDEX] Inicialização iniciada');

  const dom = getDom();

  try {
    state.initializing = true;

    // Layout
    ensureFitMovsHeightGlobal();

    // Tipos de documento — cadastro e edição
    await loadCashDocumentTypeSelects();

    // Todos os eventos, incluindo Editar/Excluir
    bindEvents(dom);

    // Modais auxiliares
    setupFornecedorModal(dom);
    setupFornecedorModalEdicao(dom);
    setupChartAccountsModal();
    setupChartAccountsModalEdicao();

    // Data/hora padrão
    if (dom.elDataHora && !dom.elDataHora.value) {
      dom.elDataHora.value = toInputDateTimeLocal(new Date());
    }

    // Filtros e categorias
    carregarAnoMes(dom);
    await carregarCategorias(dom);

    // Contas bancárias — filtro, cadastro e edição
    await loadBankAccountSelects();

    // Cache das contas de caixa
    buildAccountsCacheFromSelects(dom);

    // Tabela e resumo
    await recarregarLista(dom);

    console.log('[CAIXA][INDEX] Inicialização concluída');
  } catch (err) {
    console.error(
      '[CAIXA][INDEX] Erro ao inicializar módulo Caixa:',
      err
    );

    window.alert('Erro ao iniciar o módulo Caixa.');
  } finally {
    state.initializing = false;
  }
}