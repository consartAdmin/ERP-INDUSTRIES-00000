// ╔══════════════════════════════════════════════════════════════════════╗
// ║ debts.init.js — Inicialização do Controle de Dívidas               ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║                                                                      ║
// ║ ✅ Injeta e inicializa os modais                                     ║
// ║ ✅ Atualiza o cache dos elementos DOM                                ║
// ║ ✅ Configura formulário e eventos                                    ║
// ║ ✅ Carrega tabela, paginação e resumos                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './debts.state.js';
import { els, refreshDom } from './debts.config.js';
import { resetDebtForm } from './debts.form.js';
import { bindEvents } from './debts.actions.js';
import { refreshAll } from './debts.filters.js';
import { showToast } from './debts.utils.js';
import { initializeDebtModals } from './debts.modal.js';

/**
 * Inicializa o módulo Controle de Dívidas.
 */
async function initDebts() {
  try {
    // Captura os elementos presentes originalmente no HTML.
    refreshDom();

    // Insere os modais no documento.
    initializeDebtModals();

    // Atualiza as referências para incluir os elementos dos modais.
    refreshDom();

    // Define o tamanho inicial da página.
    state.limit = Number(els.pageSize?.value) || 50;

    // Prepara o formulário para uma nova operação.
    resetDebtForm();

    // Registra os eventos gerais do módulo.
    bindEvents();

    // Carrega tabela, paginação e indicadores.
    await refreshAll();
  } catch (error) {
    console.error('[debts.init] Falha ao iniciar o módulo:', error);

    showToast(
      'Erro ao iniciar o módulo de controle de dívidas.',
      'error',
    );
  }
}

/**
 * Executa apenas quando o DOM estiver disponível.
 */
function bootstrap() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebts, {
      once: true,
    });

    return;
  }

  void initDebts();
}

bootstrap();
