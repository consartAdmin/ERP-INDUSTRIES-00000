// ╔════════════════════════════════════════════════════════════╗
// ║ units.config.js — Configuração do módulo Unidades           ║
// ╚════════════════════════════════════════════════════════════╝

export const UNITS_CONFIG = Object.freeze({
  apiPath: '/api/units',
  defaultPageSize: 20,
  minPageSize: 1,
  maxPageSize: 100,
  searchDebounceMs: 250,
});
