(function () {
  // Em vez de sair se já existir, vamos REUTILIZAR a barra
  let bar = document.getElementById('status-usuario-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'status-usuario-bar';
    document.body.appendChild(bar);
  }

  // Decodifica JWT (sem libs externas)
  function decodeJwt(token) {
    try {
      const payload = token.split('.')[1] || '';
      const base64 = payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '=');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  // Lê token de vários lugares (compatibilidade com código antigo)
  function getRawToken() {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('auth_token')
    );
  }

  function getUsuarioAtual() {
    const token = getRawToken();
    if (!token) {
      return { nome: 'Não autenticado', id: null, email: '', perfil: '', exp: null };
    }
    const p = decodeJwt(token) || {};
    console.log('[status-usuario] payload JWT:', p);

    const id =
      p.id ?? p.user_id ?? p.sub ?? null;
    const nome =
      p.nome ??
      p.name ??
      p.username ??
      p.login ??
      (p.email ? p.email.split('@')[0] : 'Usuário');
    const email = p.email ?? '';
    const perfil = p.access_level ?? p.role ?? p.perfil ?? p.permissao ?? '';
    const exp = p.exp ? p.exp * 1000 : null; // ms

    return { id, nome, email, perfil, exp };
  }

  function formatarTempo(msRestante) {
    const totalSeg = Math.max(0, Math.floor(msRestante / 1000));
    const h = String(Math.floor(totalSeg / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeg % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeg % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function criarOuAtualizarBarra(usuario, barEl) {
    // Substitui qualquer HTML antigo pela nossa estrutura
    barEl.innerHTML = `
      <span>👤 <strong id="su-nome"></strong> <span class="muted" id="su-id"></span></span>
      <span class="sep"></span>
      <span class="muted" id="su-perfil"></span>
      <span class="sep"></span>
      <span class="muted" id="su-host"></span>
      <div class="right">
        <span id="su-contador" class="muted"></span>
        <span id="su-hora" class="muted"></span>
        <button type="button" id="su-logout">Sair</button>
      </div>
    `;

    const host = location.hostname;
    document.getElementById('su-nome').textContent = usuario.nome || 'Usuário';
    document.getElementById('su-id').textContent = usuario.id ? `(ID ${usuario.id})` : '';
    document.getElementById('su-perfil').textContent = usuario.perfil ? `Perfil: ${usuario.perfil}` : '';
    document.getElementById('su-host').textContent = `Ambiente: ${host}`;

    // Relógio
    function tickHora() {
      const d = new Date();
      const txt = d.toLocaleTimeString('pt-BR', { hour12: false });
      const el = document.getElementById('su-hora');
      if (el) el.textContent = txt;
    }
    tickHora();
    setInterval(tickHora, 1000);

    // Contador de sessão
    if (usuario.exp) {
      const elContador = document.getElementById('su-contador');
      const timer = setInterval(() => {
        const restante = usuario.exp - Date.now();
        if (restante <= 0) {
          elContador.textContent = 'Sessão expirada';
          clearInterval(timer);
          // Limpa tokens e manda de volta pra tela de login
          localStorage.removeItem('token');
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('auth_token');
          window.location.href = '/public/login/login.html?expired=1';
        } else {
          elContador.textContent = `⏳ ${formatarTempo(restante)}`;
        }
      }, 1000);
    } else {
      const elContador = document.getElementById('su-contador');
      if (elContador) elContador.textContent = '';
    }

    // Logout manual
    const btnLogout = document.getElementById('su-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('auth_token');
        window.location.href = '/public/login/login.html';
      });
    }
  }

  const usuario = getUsuarioAtual();
  criarOuAtualizarBarra(usuario, bar);
})();
