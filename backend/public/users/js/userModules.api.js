(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  async function request(url, options) {
    const res = await fetch(url, options);
    let data;
    try {
      data = await res.json();
    } catch (_err) {
      throw new Error(`Erro HTTP ${res.status}`);
    }
    if (!res.ok || !data.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);
    return data;
  }

  function listar(params) {
    return request(`${app.config.API}?${params.toString()}`);
  }

  function buscar(userId) {
    return request(`${app.config.API}/${userId}`);
  }

  function salvar(userId, payload) {
    return request(userId ? `${app.config.API}/${userId}` : app.config.API, {
      method: userId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  function excluir(userId) {
    return request(`${app.config.API}/${userId}`, { method: 'DELETE' });
  }

  app.api = { listar, buscar, salvar, excluir };
})();
