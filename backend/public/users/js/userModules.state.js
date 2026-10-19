(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});
  app.state = {
    paginaAtual: 1,
    totalPaginas: 1,
    ordenacao: { sort: 'user_id', dir: 'asc' },
    elements: {},
  };
})();
