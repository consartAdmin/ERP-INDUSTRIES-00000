// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: shortCutsProgramation.modal.js                                ║
// ║ MODULE: Programming Shortcuts — Modal                               ║
// ║ DESCRIPTION: Modais de cadastro e categorias dos shortcuts          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    openShortCutsProgramationCategoriesModal,
} from '../shortCutsProgramationCategoriesModal.js';

const MODAL_ID = 'shortcutEditorModal';

function createEditorMarkup() {
    return /*html*/ `
<div id="${MODAL_ID}" class="modal modal-width-10 modal-height-10" aria-hidden="true">
    <div class="modal__backdrop" data-shortcut-modal-close></div>

    <div class="modal__dialog">
        <section class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="formTitle">
    <header class="modal__header modal-header-color-3">
      <div>
        <h2 id="formTitle" class="modal__title">
            Novo Shortcut
        </h2>

         <span id="selectedId">
         Nenhum selecionado
      </span>
    </div>

       <button
            id="btnCloseShortcutModal"
            class="btn btn-inline"
            type="button"
            aria-label="Fechar modal"
            title="Fechar"
            >
          ×
       </button>
     </header>

            <div class="modal__body">
                <form id="shortcutForm" class="sc-form">
                <input id="shortcut_id" type="hidden" />
                <input id="category" type="hidden" />
                <input id="subcategory" type="hidden" />

                <div class="fields fields-inline fields-gap-3">
                    <label>
                        Categoria *
                        <select id="category_id" required>
                            <option value="">Selecione a categoria...</option>
                        </select>
                    </label>

                    <label>
                        Subcategoria
                        <select id="subcategory_id">
                            <option value="">Selecione a subcategoria...</option>
                        </select>
                    </label>

            <div class="fields fields-h-5 fields-w-20 fields-font-3">
                <label>
                    Título *
                    <input id="title" required placeholder="Create Express Controller" />
                </label>
            </div>

            <div class="fields fields-h-5 fields-w-20 fields-font-3">
                    <label>
                        Shortcut Key *
                        <input id="shortcut_key" required placeholder="JS_EXPRESS_CONTROLLER" />
                    </label>
                    </div>

                    <div class="fields fields-h-5 fields-w-5 fields-font-3">
                        <label>
                            Tipo
                            <input id="shortcut_type" placeholder="API, ROUTE, SQL, CSS..." />
                        </label>
                    </div>

                <div class="fields fields-h-5 fields-w-5 fields-font-3">
                        <label>
                            Linguagem *
                            <input id="language" required placeholder="JavaScript" list="languageList" />
                            <datalist id="languageList">
                                <option value="SQL"></option>
                                <option value="JavaScript"></option>
                                <option value="HTML"></option>
                                <option value="CSS"></option>
                                <option value="JSON"></option>
                                <option value="Text"></option>
                                <option value="Shell"></option>
                                <option value="Dockerfile"></option>
                            </datalist>
                        </label>
                    </div>

                     <div class="fields fields-h-5 fields-w-5 fields-font-3">
                        <label>
                            Dificuldade
                            <input id="difficulty" type="number" min="1" max="5" value="1" />
                        </label>
                      </div>  

                    <div class="fields fields-h-5 fields-w-5 fields-font-3">
                        <label>
                            Ordem
                            <input id="sort_order" type="number" value="0" />
                        </label>
                      </div>
                    </div>   

                <label for="description">
                    Descrição
                    <textarea id="description" class="textarea textarea-border-1  textarea-radius-4 textarea-h-1 textarea-w-10 textarea-resize-vertical"
                        placeholder="Explique para que serve este shortcut..."></textarea>
                </label>

                <label for="code">
                    Código *
                    <textarea id="code" class="textarea textarea-border-1  textarea-radius-4 textarea-h-7 textarea-w-10 textarea-resize-vertical textarea-padding-5 textarea-bg-10 textarea-color-1" required
                        spellcheck="false" placeholder="Cole o código aqui..."></textarea>
                </label>

                <label for="utilities">
                    Utilities
                    <textarea id="observations" class="textarea textarea-border-1 textarea-radius-4 textarea-h-7 textarea-w-10 textarea-resize-vertical textarea-padding-5"
                        placeholder="Adicione observações importantes..."></textarea>
                </label>
                
                <label>
                    Tags
                    <input id="tags" placeholder="crud, api, postgres, modal" />
                </label>

                <div class="sc-checks">
                    <label>
                        <input id="favorite" type="checkbox" />
                        Favorito
                    </label>

                    <label>
                        <input id="active" type="checkbox" checked />
                        Ativo
                    </label>
                </div>

                </form>
            </div>

            <footer class="modal__footer modal-footer-color-3">
                <div class="fields fields-inline fields-gap-3 modal-header-color-2">
                    <button id="btnSave" class="btn btn-toolbar btn-sm" type="submit" form="shortcutForm">
                        Salvar
                    </button>
                    <button id="btnClear" class="btn btn-toolbar btn-sm" type="button">
                        Limpar
                    </button>
                    <button id="btnCopyCode" class="btn btn-toolbar btn-sm" type="button">
                        Copiar Código
                    </button>
                    <button id="btnDelete" class="btn btn-toolbar btn-sm" type="button">
                        Inativar
                    </button>
                    <button id="btnRestore" class="btn btn-toolbar btn-sm" type="button">
                        Restaurar
                    </button>
                </div>
            </footer>
        </section>
    </div>
</div>`;
}

export function ensureShortcutModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    const existingForm = document.getElementById('shortcutForm');

    if (existingForm) {
        const existingPanel = existingForm.closest('.sc-panel') || existingForm;
        existingPanel.remove();
    }

    document.body.insertAdjacentHTML('beforeend', createEditorMarkup());
    modal = document.getElementById(MODAL_ID);

    modal.querySelector('[data-shortcut-modal-close]')
        ?.addEventListener('click', closeShortcutModal);
    modal.querySelector('#btnCloseShortcutModal')
        ?.addEventListener('click', closeShortcutModal);

    return modal;
}

export function openShortcutModal() {
    const modal = ensureShortcutModal();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
        modal.querySelector('#title')?.focus();
    });
}

export function closeShortcutModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

export function openCategoriesModal() {
    return openShortCutsProgramationCategoriesModal();
}
