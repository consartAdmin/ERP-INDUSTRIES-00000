(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  async function salvar(ev) {
    ev.preventDefault();
    const resultado = app.validation.criarPayload(app.state.elements);
    if (!resultado.ok) {
      app.utils.showToast(resultado.message, 'error');
      return;
    }
    try {
      await app.api.salvar(resultado.userId, resultado.payload);
      app.utils.showToast('Usuário salvo com sucesso.', 'success');
      app.modal.fechar();
      app.actions.carregarUsuarios();
    } catch (err) {
      console.error('Erro ao salvar usuário:', err);
      app.utils.showToast(err.message || 'Erro ao salvar usuário.', 'error');
    }
  }

  app.form = { salvar };
})();
