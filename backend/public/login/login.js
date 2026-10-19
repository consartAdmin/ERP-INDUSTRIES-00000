// ╔══════════════════════════════════════════════════════════════════╗
// ║ login.js — Frontend do login (PRODNEX ERP)                       ║
// ║ Captura login, envia ao backend, armazena JWT e redireciona      ║
// ╚══════════════════════════════════════════════════════════════════╝

// Helper: mostra mensagem se vier ?expired=1 ou ?session_expired=1
(function () {
  const params = new URLSearchParams(window.location.search);
  const expired = params.get('expired') || params.get('session_expired');
  if (expired && document.getElementById('mensagemErro')) {
    document.getElementById('mensagemErro').textContent =
      'Sua sessão expirou. Faça login novamente.';
  }
})();

document
  .getElementById('formLogin')
  .addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('usuario').value.trim();
    const password = document.getElementById('senha').value;
    const msgErro = document.getElementById('mensagemErro');
    msgErro.textContent = '';

    if (!login || !password) {
      msgErro.textContent = 'Login e senha são obrigatórios.';
      return;
    }

    // Desabilita botão enquanto processa login
    const btnEntrar = e.target.querySelector('button[type="submit"]');
    btnEntrar.disabled = true;
    btnEntrar.textContent = 'Entrando...';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        msgErro.textContent =
          data.erro || data.error || 'Usuário ou senha inválidos.';
        btnEntrar.disabled = false;
        btnEntrar.textContent = 'Entrar';
        return;
      }

      // 🔐 Salva token e dados do usuário
      // (nome da chave 'token' é o que a barra de status usa)
      if (data.token) {
        localStorage.setItem('token', data.token);          // usado pela status bar
        localStorage.setItem('auth_token', data.token);     // legado, se algo ainda usar
      }

      if (data.user) {
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        localStorage.setItem('usuario_nome', data.user.name || '');
        localStorage.setItem('usuario_acesso', data.user.access_level || '');
      }

      // Opcional: guardar info de expiração que o backend mandar
      if (data.expiresAt) {
        localStorage.setItem('token_expires_at', data.expiresAt);
      } else {
        localStorage.removeItem('token_expires_at');
      }

      // 🔄 Redireciona para a home
      window.location.href = '/home/home.html';
    } catch (err) {
      console.error('[LOGIN] Erro de conexão:', err);
      msgErro.textContent = 'Erro ao conectar com o servidor.';
    } finally {
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar';
    }
  });

// 👁 Toggle mostrar/ocultar senha
const btnToggle = document.getElementById('toggleSenha');
const senhaInput = document.getElementById('senha');
if (btnToggle && senhaInput) {
  btnToggle.addEventListener('click', () => {
    const visivel = senhaInput.type === 'text';
    senhaInput.type = visivel ? 'password' : 'text';
    btnToggle.setAttribute(
      'aria-label',
      visivel ? 'Mostrar senha' : 'Ocultar senha'
    );
  });
}
