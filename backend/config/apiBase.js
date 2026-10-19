// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 🌐 apiBase.js — Configuração dinâmica de endpoints (CONSART ERP)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASES = {
  local: 'http://localhost:8080',
  homolog: 'https://erp.prodnex.com.br',
  prod: 'https://erp.prodnex.com.br',
  cloudRun: 'https://erp.prodnex.com.br',
};

(function detectApiBase() {
  try {
    const host = location.hostname;
    let base = location.origin;

    if (host === 'localhost' || host === '127.0.0.1') {
      base = API_BASES.local;
    }

    else if (host.includes('run.app')) {
      base = API_BASES.cloudRun;
    }

    else if (host === 'erp.prodnex.com.br') {
      base = API_BASES.prod;
    }

    else if (host.includes('homolog')) {
      base = API_BASES.homolog;
    }

    window.apiBase = base;

    console.log('[apiBase] Endpoint ativo:', window.apiBase);
  } catch (err) {
    console.error('[apiBase] Erro ao detectar ambiente:', err);
    window.apiBase = location.origin;
  }
})();

function getApiBase() {
  return window.apiBase || location.origin;
}

window.getApiBase = getApiBase;