(() => {
  'use strict';
  const app = (window.userModules = window.userModules || {});
  const API_BASE = window.API_BASE || '';
  app.config = Object.freeze({ API: `${API_BASE}/api/users`, limit: 10 });
})();
