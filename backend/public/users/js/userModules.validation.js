(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  function criarPayload(elements) {
    const userId = elements.usuarioId.value ? Number(elements.usuarioId.value) : null;
    const nome = elements.usuarioNome.value.trim();
    const email = elements.usuarioEmail.value.trim();
    const senha = elements.usuarioSenha.value;

    if (!nome || !email) {
      return { ok: false, message: 'Nome e e-mail são obrigatórios.' };
    }
    if (!userId && !senha) {
      return { ok: false, message: 'Senha é obrigatória para novo usuário.' };
    }

    const payload = {
      name: nome,
      email,
      access_level: elements.usuarioAccessLevel.value || 'User',
      is_active: elements.usuarioAtivo.value === 'true',
    };
    if (senha) payload.password = senha;

    return { ok: true, userId, payload };
  }

  app.validation = { criarPayload };
})();
