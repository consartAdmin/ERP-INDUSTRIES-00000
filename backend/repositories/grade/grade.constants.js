// ╔════════════════════════════════════════════════════════════════════╗
// ║ grade.constants.js — Base da API, timeout, debug e endpoints       ║
/* ║ Rotas alinhadas ao backend atual (gradesProdutos / gradesVinculos)   ║ */
// ╚════════════════════════════════════════════════════════════════════╝

export const API = (typeof window !== 'undefined' && window.apiBase) ? window.apiBase : '';
export const DEFAULT_TIMEOUT_MS = 15000;
export const DEBUG = false;

// ──────────────────────────────────────────────────────────────────────────
// Endpoints (documentados)
export const R = Object.freeze({
  produtoById:          (id)     => `/api/produtos/${encodeURIComponent(id)}`,                 // GET
  gradesLista:          ()       => `/api/grades?limit=9999&order=g.grade ASC`,               // GET (opções de select)
  vinculosBySku:        (sku)    => `/api/produtos/${encodeURIComponent(sku)}/grades`,        // GET
  vinculosSyncBySku:    (sku)    => `/api/produtos/${encodeURIComponent(sku)}/grades-vinculos`, // PUT {mode, grades[]}
  vinculoCreate:        ()       => `/api/grades-produtos`,                                   // POST
  vinculoUpdate:        (id)     => `/api/grades-produtos/${encodeURIComponent(id)}`,         // PUT
  vinculoDelete:        (id)     => `/api/grades-produtos/${encodeURIComponent(id)}`,         // DELETE
});
