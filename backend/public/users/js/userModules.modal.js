(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  function exibir() {
    const modal = app.state.elements.modalBackdrop;
    modal.classList.remove('hidden');
    modal.classList.add('is-open');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }

  function abrirNovo() {
    const e = app.state.elements;
    e.usuarioId.value = '';
    e.usuarioNome.value = '';
    e.usuarioEmail.value = '';
    e.usuarioAccessLevel.value = 'User';
    e.usuarioAtivo.value = 'true';
    e.usuarioSenha.value = '';
    e.modalTitulo.textContent = 'Novo Usuário';
    exibir();
  }

  function abrirEdicao(user) {
    const e = app.state.elements;
    e.usuarioId.value = user.user_id;
    e.usuarioNome.value = user.name || '';
    e.usuarioEmail.value = user.email || '';
    e.usuarioAccessLevel.value = user.access_level || 'User';
    e.usuarioAtivo.value = user.is_active ? 'true' : 'false';
    e.usuarioSenha.value = '';
    e.modalTitulo.textContent = 'Editar Usuário';
    exibir();
  }

  function fechar() {
    const modal = app.state.elements.modalBackdrop;
    modal.classList.add('hidden');
    modal.classList.remove('is-open');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  app.modal = { abrirNovo, abrirEdicao, fechar };
})();
