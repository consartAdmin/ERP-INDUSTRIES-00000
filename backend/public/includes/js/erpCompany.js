// ╔══════════════════════════════════════════════════════════════════════╗
// ║ erpCompany.js — Telas da Consart ERP (BH3 x CONSART)                 ║
// ║ Script normal (não module), carregado ANTES dos módulos da página.   ║
// ║ A empresa vem de window.ERP_COMPANY ou do ?company= da URL           ║
// ║ (ex.: customersListConsart.html ou ?company=CONSART). Com empresa:   ║
// ║ • todo fetch para /api/ do próprio servidor leva X-ERP-Company;      ║
// ║ • window.erpCompanyUrl(url) acrescenta ?company= em links/relatórios;║
// ║ • o título da página ganha "(Consart ERP)" e uma faixa no topo.      ║
// ║ Sem empresa, não faz nada (telas originais continuam iguais).        ║
// ╚══════════════════════════════════════════════════════════════════════╝
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var company = String(window.ERP_COMPANY || params.get('company') || '').trim().toUpperCase();

  // Telas com página própria da Consart (nome real na URL)
  var CONSART_PAGES = {
    '/public/customersList/customersList.html': '/public/customersListConsart/customersListConsart.html',
    '/public/customersRegistration/customersRegistration.html': '/public/customersRegistrationConsart/customersRegistrationConsart.html',
    '/public/customersEdit/customersEdit.html': '/public/customersEditConsart/customersEditConsart.html',
    '/public/customerStatusTypes/customerStatusTypes.html': '/public/customerStatusTypesConsart/customerStatusTypesConsart.html',
    '/public/customerSegments/customerSegments.html': '/public/customerSegmentsConsart/customerSegmentsConsart.html',
    '/public/sellers/sellers.html': '/public/sellersConsart/sellersConsart.html'
  };

  window.erpCompanyUrl = function (url) {
    if (!company) return url;
    var u = new URL(url, window.location.href);
    if (company === 'CONSART' && CONSART_PAGES[u.pathname]) {
      return CONSART_PAGES[u.pathname] + u.search + u.hash;
    }
    u.searchParams.set('company', company);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : u.toString();
  };

  if (!company) return;
  window.ERP_COMPANY = company;

  if (typeof window.fetch === 'function' && !window.fetch.__erpCompany) {
    var originalFetch = window.fetch.bind(window);

    var isOwnApi = function (url) {
      try {
        var u = new URL(url, window.location.href);
        var apiOrigin = '';
        try { apiOrigin = new URL(window.apiBase || window.location.origin).origin; } catch (e) {}
        var sameServer = u.origin === window.location.origin || u.origin === apiOrigin;
        return sameServer && u.pathname.indexOf('/api/') === 0;
      } catch (e) {
        return false;
      }
    };

    var patchedFetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (!isOwnApi(url)) return originalFetch(input, init);

      if (typeof input === 'string') {
        try {
          var withCompany = new URL(input, window.location.href);
          if (!withCompany.searchParams.has('company')) {
            withCompany.searchParams.set('company', company);
            input = withCompany.toString();
          }
        } catch (e) {}
      }

      var opts = Object.assign({}, init || {});
      var headers = new Headers(opts.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-ERP-Company')) headers.set('X-ERP-Company', company);
      opts.headers = headers;
      return originalFetch(input, opts);
    };

    patchedFetch.__erpCompany = true;
    window.fetch = patchedFetch;
  }

  if (company === 'CONSART' && !window.CRM_COMPANY) {
    document.title = document.title.replace(/\s*\|/, ' (Consart ERP) |');

    // Faixa no topo para ninguém confundir com o cadastro original
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('erpCompanyBanner')) return;
      var bar = document.createElement('div');
      bar.id = 'erpCompanyBanner';
      bar.textContent = 'Consart ERP';
      bar.style.cssText =
        'margin:8px auto 0;max-width:1400px;padding:6px 14px;border-radius:8px;' +
        'background:#0f766e;color:#fff;font-weight:700;letter-spacing:.04em;text-align:center;';
      var mount = document.getElementById('menuConsartMount');
      if (mount && mount.parentNode) mount.parentNode.insertBefore(bar, mount.nextSibling);
      else document.body.insertBefore(bar, document.body.firstChild);
    });
  }
})();
