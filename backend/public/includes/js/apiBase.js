// ╔══════════════════════════════════════════════════════════════╗
// ║ 🌐 apiBase.js — Configuração dinâmica PRODNEX ERP           ║
// ╚══════════════════════════════════════════════════════════════╝

(function detectApiBase() {
  try {
    window.apiBase = window.location.origin;

    console.log(
      '[apiBase] Endpoint ativo:',
      window.apiBase
    );

  } catch (err) {
    console.error(
      '[apiBase] Erro ao detectar base:',
      err
    );

    window.apiBase = 'http://localhost:8080';
  }
})();

function getApiBase() {
  return window.apiBase || window.location.origin;
}

window.getApiBase = getApiBase;