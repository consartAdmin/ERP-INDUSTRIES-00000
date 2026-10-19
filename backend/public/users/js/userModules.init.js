// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: userModules.init.js                                           ║
// ║ MODULE: User Management — Initialization                            ║
// ║ DESCRIPTION: Imports modules, maps DOM elements and registers events ║
// ╚══════════════════════════════════════════════════════════════════════╝

import './userModules.config.js';
import './userModules.state.js';
import './userModules.utils.js';
import './userModules.validation.js';
import './userModules.api.js';
import './userModules.render.js';
import './userModules.modal.js';
import './userModules.actions.js';
import './userModules.form.js';

(() => {
  'use strict';

  const app = (window.userModules = window.userModules || {});

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ DOM ELEMENT MAPPING                                              ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function mapearElementos() {
    app.state.elements = {
      // Table
      tbody: document.getElementById('tableBody'),
      resumo: document.getElementById('usersResumo'),
      paginaInfo: document.getElementById('apTableInfo'),

      // Filters
      filtroBusca: document.getElementById('filtroBusca'),
      filtroAccessLevel: document.getElementById('filtroAccessLevel'),
      filtroAtivo: document.getElementById('filtroAtivo'),

      // Filter buttons
      btnAplicar: document.getElementById('btnAplicarFiltros'),
      btnLimpar: document.getElementById('btnLimparFiltros'),

      // Pagination
      btnAnterior: document.getElementById('btnPreviousPage'),
      btnProxima: document.getElementById('btnNextPage'),

      // New user
      btnNovo: document.getElementById('btnNovoUsuario'),

      // Modal
      modalBackdrop: document.getElementById('modalUsuario'),
      modalTitulo: document.getElementById('modalTitulo'),
      btnFecharModal: document.getElementById('btnCloseForm'),
      btnCancelarModal: document.getElementById('btnCancelForm'),

      // Form
      formUsuario: document.getElementById('formUsuario'),
      btnSalvarUsuario: document.getElementById('arForm'),

      // Form fields
      usuarioId: document.getElementById('usuarioId'),
      usuarioNome: document.getElementById('usuarioNome'),
      usuarioEmail: document.getElementById('usuarioEmail'),
      usuarioAccessLevel: document.getElementById(
        'usuarioAccessLevel'
      ),
      usuarioAtivo: document.getElementById('usuarioAtivo'),
      usuarioSenha: document.getElementById('usuarioSenha'),
    };
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ REQUIRED ELEMENT VALIDATION                                      ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function validarElementos() {
    const elementosAusentes = Object.entries(app.state.elements)
      .filter(([, elemento]) => !elemento)
      .map(([nome]) => nome);

    if (elementosAusentes.length > 0) {
      throw new Error(
        `Elementos HTML não encontrados: ${elementosAusentes.join(', ')}`
      );
    }
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ FILTER EVENTS                                                    ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventosFiltros() {
    const e = app.state.elements;

    e.btnAplicar.addEventListener('click', () => {
      app.state.paginaAtual = 1;
      app.actions.carregarUsuarios();
    });

    e.btnLimpar.addEventListener('click', () => {
      e.filtroBusca.value = '';
      e.filtroAccessLevel.value = '';
      e.filtroAtivo.value = '';

      app.state.paginaAtual = 1;
      app.actions.carregarUsuarios();
    });

    e.filtroBusca.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;

      event.preventDefault();
      app.state.paginaAtual = 1;
      app.actions.carregarUsuarios();
    });
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ PAGINATION EVENTS                                                ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventosPaginacao() {
    const e = app.state.elements;

    e.btnAnterior.addEventListener('click', () => {
      if (app.state.paginaAtual <= 1) return;

      app.state.paginaAtual -= 1;
      app.actions.carregarUsuarios();
    });

    e.btnProxima.addEventListener('click', () => {
      if (app.state.paginaAtual >= app.state.totalPaginas) return;

      app.state.paginaAtual += 1;
      app.actions.carregarUsuarios();
    });
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ TABLE SORTING EVENTS                                             ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventosOrdenacao() {
    document
      .querySelectorAll('.users-table th[data-sort]')
      .forEach((th) => {
        th.addEventListener('click', () => {
          const coluna = th.getAttribute('data-sort');

          if (!coluna) return;

          if (app.state.ordenacao.sort === coluna) {
            app.state.ordenacao.dir =
              app.state.ordenacao.dir === 'asc'
                ? 'desc'
                : 'asc';
          } else {
            app.state.ordenacao.sort = coluna;
            app.state.ordenacao.dir = 'asc';
          }

          app.state.paginaAtual = 1;
          app.actions.carregarUsuarios();
        });
      });
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ MODAL EVENTS                                                     ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventosModal() {
    const e = app.state.elements;
    const backdrop = e.modalBackdrop.querySelector(
      '.modal__backdrop'
    );

    e.btnNovo.addEventListener('click', app.modal.abrirNovo);
    e.btnFecharModal.addEventListener('click', app.modal.fechar);
    e.btnCancelarModal.addEventListener(
      'click',
      app.modal.fechar
    );

    backdrop?.addEventListener('click', app.modal.fechar);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!e.modalBackdrop.classList.contains('is-open')) return;

      app.modal.fechar();
    });
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ FORM EVENTS                                                      ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventosFormulario() {
    const e = app.state.elements;

    /*
     * The Save button is a direct child of modal__footer and therefore
     * is outside formUsuario. requestSubmit() connects the button to
     * the form while preserving native HTML validation.
     */
    e.btnSalvarUsuario.addEventListener('click', (event) => {
      event.preventDefault();
      e.formUsuario.requestSubmit();
    });

    /*
     * The actual create/update operation remains registered on the
     * form's submit event.
     */
    e.formUsuario.addEventListener(
      'submit',
      app.form.salvar
    );
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ EVENT REGISTRATION                                               ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function registrarEventos() {
    registrarEventosFiltros();
    registrarEventosPaginacao();
    registrarEventosOrdenacao();
    registrarEventosModal();
    registrarEventosFormulario();
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║ APPLICATION INITIALIZATION                                       ║
  // ╚══════════════════════════════════════════════════════════════════╝

  function inicializar() {
    try {
      mapearElementos();
      validarElementos();
      registrarEventos();
      app.actions.carregarUsuarios();
    } catch (error) {
      console.error(
        'Erro ao inicializar o módulo de usuários:',
        error
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      inicializar,
      { once: true }
    );
  } else {
    inicializar();
  }
})();