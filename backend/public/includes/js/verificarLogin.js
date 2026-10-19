(function verificarLogin() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/public/login/login.html';
  }
})();
