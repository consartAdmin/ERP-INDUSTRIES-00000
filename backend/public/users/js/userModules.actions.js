(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  function criarParametros() {
    const e = app.state.elements;
    const params = new URLSearchParams({
      page: String(app.state.paginaAtual),
      limit: String(app.config.limit),
    });
    if (e.filtroBusca.value.trim()) params.set('q', e.filtroBusca.value.trim());
    if (e.filtroAccessLevel.value) params.set('access_level', e.filtroAccessLevel.value);
    if (e.filtroAtivo.value) params.set('is_active', e.filtroAtivo.value);
    if (app.state.ordenacao.sort) {
      params.set('sort', app.state.ordenacao.sort);
      params.set('dir', app.state.ordenacao.dir);
    }
    return params;
  }

  async function carregarUsuarios() {
    try {
      const data = await app.api.listar(criarParametros());
      app.render.preencherTabela(data.rows || []);
      app.render.atualizarResumo(data.total || 0, data.page || 1, data.limit || app.config.limit);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      app.utils.showToast('Erro ao carregar usuários.', 'error');
    }
  }

  async function excluirUsuario(userId, nome) {
    const confirma = window.confirm(
      `Deseja realmente excluir o usuário "${nome}" (ID ${userId})? Essa ação não poderá ser desfeita.`
    );
    if (!confirma) return;
    try {
      await app.api.excluir(userId);
      app.utils.showToast('Usuário excluído com sucesso.', 'success');
      carregarUsuarios();
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      app.utils.showToast(err.message || 'Erro ao excluir usuário.', 'error');
    }
  }

  app.actions = { carregarUsuarios, excluirUsuario };
})();
