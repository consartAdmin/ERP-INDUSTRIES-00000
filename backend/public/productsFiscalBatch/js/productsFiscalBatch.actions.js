// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.actions.js                               ║
// ║ MODULE: Products Fiscal Batch — Actions                            ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  showCenterModal,
} from '/public/includes/js/centerAlertModal.js';

import {
  openFiscalClassificationModal,
} from '/public/modalsSearch/fiscalClassificationModalSearch.js';

import {
  linkProductsFiscal,
  listFiscalProfiles,
  listProducts,
  unlinkProductFiscal,
} from './productsFiscalBatch.api.js';

import {
  API_BASE,
  ROUTES,
} from './productsFiscalBatch.config.js';

import {
  buildListParams,
} from './productsFiscalBatch.filters.js';

import {
  fillFiscalProfiles,
  setClassification,
  setFiscalProfile,
} from './productsFiscalBatch.form.js';

import {
  clearSelection,
} from './productsFiscalBatch.products.js';

import {
  renderPagination,
  renderProducts,
  setLoading,
} from './productsFiscalBatch.render.js';

import {
  dom,
  state,
} from './productsFiscalBatch.state.js';

import {
  validateBatchLink,
} from './productsFiscalBatch.validation.js';

import {
  getErrorMessage,
} from './productsFiscalBatch.utils.js';

// ============================================================================
// HELPERS
// ============================================================================

function confirmCenterModal({
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
}) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');

    modal.className =
      'modal is-open products-fiscal-confirm-modal';

    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute(
      'aria-labelledby',
      'productsFiscalConfirmTitle'
    );

    modal.innerHTML = `
      <div class="modal__backdrop"></div>

      <div class="modal__dialog">
        <section class="modal__panel modal__panel--sm">
          <header class="modal__header modal-header-color-3">
            <h2
              id="productsFiscalConfirmTitle"
              class="modal__title"
            >
              ${title}
            </h2>

            <button
              type="button"
              class="modal__close"
              data-modal-close
              aria-label="Fechar"
            >
              &times;
            </button>
          </header>

          <div class="modal__body">
            ${message}
          </div>

          <footer class="modal__footer modal-footer-color-3">
            <button
              type="button"
              data-modal-cancel
              class="btn btn-new btn-sm"
            >
              ${cancelText}
            </button>

            <button
              type="button"
              data-modal-confirm
              class="btn btn-new btn-sm"
            >
              ${confirmText}
            </button>
          </footer>
        </section>
      </div>
    `;

    const backdrop = modal.querySelector('.modal__backdrop');
    const closeButton = modal.querySelector('[data-modal-close]');
    const cancelButton = modal.querySelector('[data-modal-cancel]');
    const confirmButton = modal.querySelector('[data-modal-confirm]');

    const finish = (confirmed) => {
      document.removeEventListener('keydown', handleKeydown);
      modal.remove();
      resolve(confirmed);
    };

    const handleKeydown = (event) => {
      if (event.key === 'Escape') {
        finish(false);
      }
    };

    cancelButton.addEventListener(
      'click',
      () => finish(false),
      { once: true }
    );

    closeButton.addEventListener(
      'click',
      () => finish(false),
      { once: true }
    );

    confirmButton.addEventListener(
      'click',
      () => finish(true),
      { once: true }
    );

    backdrop.addEventListener(
      'click',
      () => finish(false),
      { once: true }
    );

    document.addEventListener('keydown', handleKeydown);
    document.body.appendChild(modal);
    confirmButton.focus();
  });
}

function setApplying(applying) {
  if (!dom.applyButton) return;

  dom.applyButton.disabled = applying;

  dom.applyButton.textContent = applying
    ? 'Aplicando vínculo...'
    : 'Aplicar vínculo para selecionados';
}

function setUnlinking(unlinking) {
  if (!dom.productsBody) return;

  dom.productsBody
    .querySelectorAll('button')
    .forEach((button) => {
      if (
        button.textContent === 'Desvincular' ||
        button.dataset.unlinking === 'true'
      ) {
        button.disabled = unlinking;
        button.dataset.unlinking =
          unlinking ? 'true' : 'false';
      }
    });
}

function getErrorDetails(error) {
  return {
    name: error?.name || null,
    message: error?.message || null,
    status: error?.status || null,
    code: error?.code || null,
    requestId:
      error?.requestId ||
      error?.request_id ||
      null,
    path: error?.path || null,
    debug: error?.debug || null,
    stack: error?.stack || null,
  };
}

function buildErrorMessage(error, fallback) {
  const message = getErrorMessage(
    error,
    fallback
  );

  const requestId =
    error?.requestId ||
    error?.request_id ||
    null;

  if (!requestId) {
    return message;
  }

  return `
    ${message}
    <br><br>
    <small>
      Referência da requisição:
      <strong>${requestId}</strong>
    </small>
  `;
}

// ============================================================================
// CARREGAR PRODUTOS
// ============================================================================

export async function loadProducts({
  force = false,
} = {}) {
  if (state.loading && !force) {
    console.info(
      '[ProductsFiscalBatch] Listagem já está sendo carregada.'
    );

    return false;
  }

  const startedAt = Date.now();

  setLoading(true);

  try {
    console.info(
      '[ProductsFiscalBatch] Carregando produtos.',
      {
        force,
        params: buildListParams(),
      }
    );

    let result = await listProducts(
      buildListParams()
    );

    let total = result.total;
    let totalPages = Math.max(
      1,
      Math.ceil(total / state.pageSize)
    );

    /*
     * Se a página atual deixou de existir após um filtro,
     * vínculo ou desvínculo, corrige a página e executa
     * uma segunda consulta dentro da mesma operação.
     *
     * Isso evita chamar loadProducts() recursivamente
     * enquanto state.loading ainda está true.
     */
    if (state.page > totalPages) {
      state.page = totalPages;

      result = await listProducts(
        buildListParams()
      );

      total = result.total;
      totalPages = Math.max(
        1,
        Math.ceil(total / state.pageSize)
      );
    }

    state.products = result.rows;
    state.total = total;
    state.totalPages = totalPages;

    renderProducts(handleUnlinkProduct);

    console.info(
      '[ProductsFiscalBatch] Produtos carregados.',
      {
        row_count: state.products.length,
        total: state.total,
        page: state.page,
        total_pages: state.totalPages,
        duration_ms:
          Date.now() - startedAt,
      }
    );

    return true;
  } catch (error) {
    console.error(
      '[ProductsFiscalBatch] Erro ao buscar produtos.',
      {
        ...getErrorDetails(error),
        params: buildListParams(),
        duration_ms:
          Date.now() - startedAt,
        error,
      }
    );

    state.products = [];
    state.total = 0;
    state.totalPages = 1;

    renderProducts(handleUnlinkProduct);

    showCenterModal({
      variant: 'error',
      title: 'Erro ao buscar produtos',
      message: buildErrorMessage(
        error,
        'Não foi possível consultar os produtos.'
      ),
      timeoutMs: 10000,
    });

    return false;
  } finally {
    setLoading(false);
    renderPagination();
  }
}

// ============================================================================
// CARREGAR PERFIS FISCAIS
// ============================================================================

export async function loadFiscalProfiles() {
  const startedAt = Date.now();

  try {
    const profiles =
      await listFiscalProfiles();

    fillFiscalProfiles(profiles);

    console.info(
      '[ProductsFiscalBatch] Perfis fiscais carregados.',
      {
        profile_count: profiles.length,
        duration_ms:
          Date.now() - startedAt,
      }
    );

    return true;
  } catch (error) {
    console.error(
      '[ProductsFiscalBatch] Erro ao carregar perfis fiscais.',
      {
        ...getErrorDetails(error),
        route:
          ROUTES.fiscalProfileList,
        duration_ms:
          Date.now() - startedAt,
        error,
      }
    );

    showCenterModal({
      variant: 'warning',
      title: 'Perfis Fiscais',
      message: buildErrorMessage(
        error,
        'Não foi possível carregar os perfis fiscais.'
      ),
      timeoutMs: 10000,
    });

    return false;
  }
}

// ============================================================================
// SELECIONAR CLASSIFICAÇÃO FISCAL
// ============================================================================

export function pickClassification() {
  openFiscalClassificationModal({
    apiBase: API_BASE,

    onPick(fiscalClassification) {
      const classification = {
        id:
          fiscalClassification
            .fiscal_classification_id ??
          fiscalClassification.id,

        ncm:
          fiscalClassification.ncm_code ??
          fiscalClassification.ncm,

        cest:
          fiscalClassification.cest_code ??
          fiscalClassification.cest,

        description:
          fiscalClassification
            .classification_name ??
          fiscalClassification.description ??
          fiscalClassification.descricao,
      };

      setClassification(classification);

      const linkedProfileId =
        fiscalClassification
          .fiscal_profile_id ??
        fiscalClassification
          .fiscalProfileId ??
        fiscalClassification
          .default_fiscal_profile_id ??
        fiscalClassification
          .perfil_fiscal_id;

      setFiscalProfile(
        linkedProfileId || ''
      );

      console.info(
        '[ProductsFiscalBatch] Classificação fiscal selecionada.',
        {
          fiscal_classification_id:
            classification.id,

          ncm:
            classification.ncm ||
            null,

          cest:
            classification.cest ||
            null,

          fiscal_profile_id:
            linkedProfileId ||
            null,
        }
      );
    },
  });
}

// ============================================================================
// APLICAR VÍNCULO FISCAL EM LOTE
// ============================================================================

export async function applyBatchLink() {
  const validation =
    validateBatchLink(state);

  if (!validation.valid) {
    showCenterModal({
      variant: 'warning',
      title: validation.title,
      message: validation.message,
      timeoutMs: 6000,
    });

    return;
  }

  const selectedProductCodes =
    Array.from(state.selected)
      .map((productCode) =>
        String(productCode || '').trim()
      )
      .filter(Boolean);

  if (!selectedProductCodes.length) {
    showCenterModal({
      variant: 'warning',
      title: 'Produtos inválidos',
      message:
        'Não foi possível identificar os códigos dos produtos selecionados.',
      timeoutMs: 6000,
    });

    return;
  }

  const fiscalClassificationId =
    Number(state.classification.id);

  const confirmed =
    await confirmCenterModal({
      title:
        'Aplicar vínculo em lote',

      message: `
        <div>
          <strong>Classificação:</strong>
          ${dom.summaryClassification?.textContent || '-'}
          <br>

          <strong>Perfil Fiscal:</strong>
          ${dom.summaryProfile?.textContent || '-'}
          <br><br>

          O vínculo será aplicado a
          <strong>${selectedProductCodes.length}</strong>
          produto(s).
        </div>
      `,

      confirmText:
        'Aplicar vínculo',

      cancelText:
        'Cancelar',
    });

  if (!confirmed) return;

  const startedAt = Date.now();

  const requestPayload = {
    product_codes:
      selectedProductCodes,

    fiscal_classification_id:
      fiscalClassificationId,

    source_system:
      'productsFiscalBatch',
  };

  setApplying(true);

  try {
    console.info(
      '[ProductsFiscalBatch] Iniciando vínculo fiscal em lote.',
      {
        route:
          ROUTES.batchLink,

        method:
          'PUT',

        product_count:
          selectedProductCodes.length,

        payload:
          requestPayload,
      }
    );

    const response =
      await linkProductsFiscal(
        requestPayload
      );

    console.info(
      '[ProductsFiscalBatch] Vínculo fiscal gravado.',
      {
        response,
        duration_ms:
          Date.now() - startedAt,
      }
    );

    /*
     * Limpa a seleção antes de renderizar novamente.
     */
    clearSelection();

    /*
     * A atualização é obrigatória.
     * O modal de sucesso só é exibido depois que
     * GET /api/v2/products-fiscal/batch-list concluir.
     */
    console.info(
      '[ProductsFiscalBatch] Atualizando listagem após o vínculo.'
    );

    const refreshed =
      await loadProducts({
        force: true,
      });

    if (!refreshed) {
      throw new Error(
        'O vínculo foi gravado, mas não foi possível atualizar a listagem.'
      );
    }

    console.info(
      '[ProductsFiscalBatch] Vínculo e listagem confirmados.',
      {
        product_count:
          selectedProductCodes.length,

        duration_ms:
          Date.now() - startedAt,
      }
    );

    showCenterModal({
      variant: 'success',
      title:
        'Vínculo aplicado com sucesso',

      message:
        `O vínculo fiscal foi aplicado a ` +
        `${selectedProductCodes.length} produto(s).`,

      timeoutMs: 5000,
    });
  } catch (error) {
    console.error(
      '[ProductsFiscalBatch] Erro ao aplicar vínculo em lote.',
      {
        ...getErrorDetails(error),

        route:
          ROUTES.batchLink,

        method:
          'PUT',

        request:
          requestPayload,

        duration_ms:
          Date.now() - startedAt,

        error,
      }
    );

    showCenterModal({
      variant: 'error',
      title:
        'Erro ao aplicar vínculo',

      message: buildErrorMessage(
        error,
        'Não foi possível aplicar o vínculo.'
      ),

      timeoutMs: 12000,
    });
  } finally {
    setApplying(false);
  }
}

// ============================================================================
// DESVINCULAR PRODUTO
// ============================================================================

export async function handleUnlinkProduct(
  productId,
  productCode
) {
  const normalizedProductCode =
    String(productCode || '').trim();

  if (!normalizedProductCode) {
    showCenterModal({
      variant: 'warning',
      title:
        'Produto inválido',

      message:
        'Não foi possível identificar o código do produto.',

      timeoutMs: 6000,
    });

    return;
  }

  const confirmed =
    await confirmCenterModal({
      title:
        'Desvincular vínculo fiscal',

      message: `
        Deseja realmente desvincular este produto?
        <br><br>

        <strong>Produto ID:</strong>
        ${productId}
        <br>

        <strong>SKU:</strong>
        ${normalizedProductCode}
      `,

      confirmText:
        'Desvincular',

      cancelText:
        'Cancelar',
    });

  if (!confirmed) return;

  const startedAt = Date.now();

  setUnlinking(true);

  try {
    console.info(
      '[ProductsFiscalBatch] Iniciando desvínculo fiscal.',
      {
        route:
          `${ROUTES.unlinkCurrent}/${normalizedProductCode}/close`,

        method:
          'POST',

        product_id:
          productId,

        product_code:
          normalizedProductCode,
      }
    );

    const response =
      await unlinkProductFiscal(
        normalizedProductCode
      );

    state.selected.delete(
      normalizedProductCode
    );

    console.info(
      '[ProductsFiscalBatch] Desvínculo fiscal gravado.',
      {
        response,
        product_code:
          normalizedProductCode,

        duration_ms:
          Date.now() - startedAt,
      }
    );

    const refreshed =
      await loadProducts({
        force: true,
      });

    if (!refreshed) {
      throw new Error(
        'O vínculo foi removido, mas não foi possível atualizar a listagem.'
      );
    }

    showCenterModal({
      variant: 'success',
      title:
        'Produto desvinculado',

      message:
        `Vínculo fiscal removido do produto ` +
        `${normalizedProductCode}.`,

      timeoutMs: 4000,
    });
  } catch (error) {
    console.error(
      '[ProductsFiscalBatch] Erro ao desvincular produto.',
      {
        ...getErrorDetails(error),

        product_id:
          productId,

        product_code:
          normalizedProductCode,

        duration_ms:
          Date.now() - startedAt,

        error,
      }
    );

    showCenterModal({
      variant: 'error',
      title:
        'Erro ao desvincular',

      message: buildErrorMessage(
        error,
        'Não foi possível remover o vínculo.'
      ),

      timeoutMs: 12000,
    });
  } finally {
    setUnlinking(false);
  }
}