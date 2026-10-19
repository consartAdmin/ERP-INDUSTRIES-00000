// ╔════════════════════════════════════════════════════════════════════╗
// ║ centerAlertModal.js — Modal central reutilizável (ESM)            ║
// ║ - Botões personalizados + action(modalRef)                        ║
// ║ - Fecha com a tecla ESC                                           ║
// ║ - Marca d’água CONSART no fundo                                   ║
// ╚════════════════════════════════════════════════════════════════════╝
//
// ┌────────────────────────────────────────────────────────────────────┐
// │ COMO USAR NOS OUTROS ARQUIVOS                                      │
// └────────────────────────────────────────────────────────────────────┘
//
// 1) IMPORTAR (o arquivo que importa precisa ser módulo ESM)
//
//    HTML:  <script type="module" src="/js/minhaTela.js"></script>
//    CSS:   inclua o CSS das classes .center-modal-* / .cm-* na página
//
//    import { showCenterModal } from './centerAlertModal.js';
//    // ou: import CenterModal from './centerAlertModal.js';
//    //     CenterModal.showCenterModal({ ... });
//
// 2) SUBSTITUIR alert()
//
//    // Antes:  alert('Registro salvo com sucesso!');
//    // Depois:
//    showCenterModal({
//      variant: 'success',            // 'info' | 'success' | 'warning' | 'error'
//      title: 'Sucesso',
//      message: 'Registro salvo com sucesso!',
//    });
//
//    // 'info' e 'success' fecham sozinhos em 4,5s (barra de progresso).
//    // 'warning' e 'error' ficam abertos até o usuário fechar.
//    // timeoutMs: 8000 → muda o tempo | timeoutMs: null → nunca fecha sozinho
//
//    // Para esperar o usuário fechar antes de continuar:
//    await showCenterModal({ variant: 'error', title: 'Erro', message: 'Falha ao salvar.' });
//
// 3) SUBSTITUIR confirm()
//
//    // Antes:  if (confirm('Excluir este cliente?')) excluir();
//    // Depois:
//    const ok = await showCenterModal({
//      variant: 'warning',
//      title: 'Confirmar exclusão',
//      message: 'Deseja realmente excluir este cliente?',
//      okText: 'Sim, excluir',        // padrão: 'OK'
//      closeText: 'Cancelar',         // padrão: 'Fechar'
//    });
//
//    if (ok === true) excluir();
//
//    // Retornos (botões padrão):
//    //   true  → clicou OK
//    //   false → clicou Fechar/Cancelar
//    //   null  → ESC, clique no fundo, tempo esgotado ou outro modal abriu
//
// 4) BOTÕES PERSONALIZADOS + action(modalRef)
//
//    const resultado = await showCenterModal({
//      variant: 'info',
//      title: 'Nota fiscal',
//      message: 'O que deseja fazer?',
//      closeOnEscape: false,          // impede fechar com ESC
//      buttons: [
//        { label: 'Cancelar', variant: 'cancel' },
//        {
//          label: 'Emitir NF',
//          variant: 'primary',
//          action: async (modalRef) => {
//            await emitirNota();      // o botão fica desabilitado enquanto roda
//            return 'emitida';        // vira o retorno do showCenterModal
//          },
//        },
//      ],
//    });
//
//    // Retorno: o valor que a action retornar; se ela não retornar nada,
//    // volta o próprio objeto do botão ({ label, variant, ... }).
//    // modalRef.close(valor) fecha na hora com o valor informado.
//    // Se a action der erro, o modal continua aberto e o botão é reativado.
//    // Com buttons, clicar no fundo NÃO fecha e não existe auto-fechamento.
//
// 5) USAR EM SCRIPTS ANTIGOS (sem type="module")
//
//    // Em um arquivo módulo carregado uma vez na página:
//    import { showCenterModal } from './centerAlertModal.js';
//    window.showCenterModal = showCenterModal;
//
//    // Nos scripts antigos:
//    window.showCenterModal({ variant: 'info', title: 'Aviso', message: '...' });
//
// ⚠️ ATENÇÃO: title e message são inseridos via innerHTML (aceitam HTML,
//    ex.: '<b>Cliente:</b> 123'). Nunca passe texto digitado pelo usuário
//    sem escapar antes, para evitar XSS.
//
// ⚠️ Só existe um modal por vez: abrir outro fecha o anterior, e o
//    anterior retorna null.

'use strict';

const LAYER_ID = 'center-modal-layer-consart';

const ICONS = {
  info: '🟦',
  success: '✅',
  warning: '⚠️',
  error: '⛔',
};

// Finalizador do modal atualmente aberto
let activeModalFinish = null;

const STYLE_ID = 'center-modal-dialog-reset';

// Remove o estilo padrão do navegador para <dialog>, mantendo o visual
// atual (.center-modal-backdrop continua fazendo o escurecimento).
function ensureDialogResetStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    dialog.center-modal-layer {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      overflow: visible;
    }

    dialog.center-modal-layer::backdrop {
      background: transparent;
    }
  `;

  document.head.appendChild(style);
}

const CAN_USE_DIALOG =
  typeof HTMLDialogElement === 'function' &&
  typeof HTMLDialogElement.prototype.showModal === 'function';
/* =====================================================================
   LAYER
===================================================================== */

function ensureLayer() {
  // Finaliza corretamente qualquer modal anterior
  if (typeof activeModalFinish === 'function') {
    activeModalFinish(null);
  }

  const old = document.getElementById(LAYER_ID);

  if (old) {
    if (old.open) old.close();
    old.remove();
  }

  ensureDialogResetStyles();

  // <dialog> + showModal() entra no top-layer do navegador e fica ACIMA
  // de outros <dialog> modais já abertos (ex.: #dlgLot). Uma <div> comum,
  // mesmo com z-index alto, fica atrás do top-layer e inerte.
  const layer = document.createElement(CAN_USE_DIALOG ? 'dialog' : 'div');
  layer.id = LAYER_ID;
  layer.className = 'center-modal-layer';

  const backdrop = document.createElement('div');
  backdrop.className = 'center-modal-backdrop';

  const holder = document.createElement('div');
  holder.className = 'center-modal-holder';

  // Marca d’água CONSART
  const watermark = document.createElement('div');
  watermark.className = 'cm-watermark';

  layer.appendChild(backdrop);
  holder.appendChild(watermark);
  layer.appendChild(holder);

  document.body.appendChild(layer);

  if (CAN_USE_DIALOG) {
    layer.showModal();
  }

  return {
    layer,
    backdrop,
    holder,
  };
}

function closeLayer() {
  const layer = document.getElementById(LAYER_ID);

  if (!layer) return;

  layer.classList.add('is-leaving');

  window.setTimeout(() => {
    if (layer.open) layer.close();
    layer.remove();
  }, 180);
}

/* =====================================================================
   SHOW MODAL
===================================================================== */

/**
 * Exibe um modal central.
 *
 * Opções:
 *
 * variant:
 *   'info' | 'success' | 'warning' | 'error'
 *
 * title:
 *   string
 *
 * message:
 *   string
 *
 * timeoutMs:
 *   number | null
 *
 * closeOnEscape:
 *   boolean
 *
 * buttons:
 * [
 *   {
 *     label: string,
 *     variant?:
 *       'ok' | 'success' | 'primary' |
 *       'cancel' | 'danger' | 'close',
 *     className?: string,
 *     action?: (modalRef) => Promise | void
 *   }
 * ]
 */
export function showCenterModal(opt = {}) {
  return new Promise((resolve) => {
    const variant = ICONS[opt.variant] ? opt.variant : 'info';
    const title = opt.title || '';
    const message = opt.message || '';

    const buttons = Array.isArray(opt.buttons)
      ? opt.buttons
      : null;

    // ESC fica habilitado por padrão.
    // Use closeOnEscape: false para impedir.
    const closeOnEscape = opt.closeOnEscape !== false;

    let timeoutMs = opt.timeoutMs;

    if (timeoutMs === undefined) {
      timeoutMs = (
        variant === 'success' ||
        variant === 'info'
      )
        ? 4500
        : null;
    }

    const {
      layer,
      backdrop,
      holder,
    } = ensureLayer();

    let finished = false;
    let animationFrameId = null;

    /* =================================================================
       FINALIZAÇÃO CENTRALIZADA
    ================================================================= */

    function finish(result = null) {
      if (finished) return;

      finished = true;

      document.removeEventListener('keydown', handleKeydown);

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (activeModalFinish === finish) {
        activeModalFinish = null;
      }

      closeLayer();
      resolve(result);
    }

    activeModalFinish = finish;

    /* =================================================================
       TECLA ESC
    ================================================================= */

    function handleKeydown(event) {
      if (event.key !== 'Escape') return;
      if (!closeOnEscape) return;

      event.preventDefault();
      event.stopPropagation();

      finish(null);
    }

    document.addEventListener('keydown', handleKeydown);

    /* =================================================================
       BACKDROP
    ================================================================= */

    backdrop.addEventListener('click', () => {
      // Modal com botões personalizados só fecha pelos botões ou ESC
      if (!buttons) {
        finish(null);
      }
    });

    /* =================================================================
       CARD
    ================================================================= */

    const card = document.createElement('div');
    card.className = [
      'center-modal',
      `card-${variant}`,
      opt.className || '',
    ]
      .filter(Boolean)
      .join(' ');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'center-modal-title');
    card.tabIndex = -1;

    card.innerHTML = `
      <div class="cm-header">
        <span class="cm-icon" aria-hidden="true">
          ${ICONS[variant]}
        </span>

        <h3 id="center-modal-title" class="cm-title">
          ${title}
        </h3>
      </div>

      <div class="cm-body">
        ${message}
      </div>

      <div class="cm-footer"></div>

      <div
        class="cm-progress"
        style="display: none"
        aria-hidden="true"
      >
        <span></span>
      </div>
    `;

    holder.appendChild(card);

    const footer = card.querySelector('.cm-footer');
    const progress = card.querySelector('.cm-progress');
    const bar = progress.querySelector('span');

    /* =================================================================
       BOTÕES PERSONALIZADOS
    ================================================================= */

    if (buttons && buttons.length > 0) {
      buttons.forEach((btn) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = btn.label || 'OK';

        if (btn.className) {
          button.className = btn.className;
        } else {
          const buttonVariant = String(
            btn.variant || ''
          ).toLowerCase();

          const isOkVariant = [
            'ok',
            'success',
            'primary',
            'confirm',
          ].includes(buttonVariant);

          const isCloseVariant = [
            'close',
            'cancel',
            'danger',
            'delete',
          ].includes(buttonVariant);

          let extraClass = 'cm-close';

          if (isOkVariant) {
            extraClass = 'cm-ok';
          } else if (isCloseVariant) {
            extraClass = 'cm-close';
          }

          button.className = `cm-btn ${extraClass}`;
        }

        button.addEventListener('click', async () => {
          if (button.disabled || finished) return;

          let actionResult;

          try {
            button.disabled = true;

            if (typeof btn.action === 'function') {
              actionResult = await btn.action({
                close: finish,
                layer,
                backdrop,
                holder,
                card,
                button,
              });
            }

            if (finished) return;

            finish(
              actionResult !== undefined
                ? actionResult
                : btn
            );
          } catch (error) {
            console.error(
              '[centerAlertModal.buttonAction]',
              error
            );

            button.disabled = false;
          }
        });

        footer.appendChild(button);
      });
    } else {
      /* ===============================================================
         BOTÕES PADRÃO
      =============================================================== */

      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.textContent = opt.closeText || 'Fechar';
      btnClose.className = 'cm-btn cm-close';

      const btnOk = document.createElement('button');
      btnOk.type = 'button';
      btnOk.textContent = opt.okText || 'OK';
      btnOk.className = 'cm-btn cm-ok';

      btnClose.addEventListener('click', () => {
        finish(false);
      });

      btnOk.addEventListener('click', () => {
        finish(true);
      });

      footer.appendChild(btnClose);
      footer.appendChild(btnOk);
    }

    /* =================================================================
       FOCO INICIAL
    ================================================================= */

    requestAnimationFrame(() => {
      if (finished) return;

      const firstButton = footer.querySelector('button');

      if (firstButton) {
        firstButton.focus();
      } else {
        card.focus();
      }
    });

    /* =================================================================
       AUTO-DISMISS + BARRA DE PROGRESSO
    ================================================================= */

    if (timeoutMs != null && !buttons) {
      const duration = Math.max(0, Number(timeoutMs) || 0);

      progress.style.display = 'block';

      const startedAt = performance.now();

      function tick(currentTime) {
        if (finished) return;

        const elapsed = currentTime - startedAt;
        const percentage = duration === 0
          ? 1
          : Math.min(1, elapsed / duration);

        bar.style.transform = `scaleX(${percentage})`;

        if (percentage >= 1) {
          finish(null);
          return;
        }

        animationFrameId = requestAnimationFrame(tick);
      }

      animationFrameId = requestAnimationFrame(tick);
    }
  });
}

export default {
  showCenterModal,
};