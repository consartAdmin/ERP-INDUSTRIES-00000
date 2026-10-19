(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hh}:${mm}`;
  }

  function showToast(msg, tipo = 'info') {
    console.log(`[${tipo.toUpperCase()}]`, msg);
  }

  app.utils = { formatDate, showToast };
})();
