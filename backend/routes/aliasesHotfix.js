// ╔══════════════════════════════════════════════════════════════╗
// ║ aliasesHotfix.js – Aliases mínimos p/ destravar o emissor   ║
/* ╚══════════════════════════════════════════════════════════════╝ */
import { Router } from 'express';
const router = Router();

// helper para logar acertos de alias
function logAlias(from, to) {
  try { console.log(JSON.stringify({ level: "INFO", msg: "ALIAS_HIT", from, to })); } catch {}
}

/** /api/clientes/by-doc/:doc  →  /api/clientes?doc=:doc
 *  OBS: sem /api aqui dentro, pq este router está montado em app.use('/api', ...)
 */
router.get('/clientes/by-doc/:doc', (req, _res, next) => {
  const doc = encodeURIComponent(req.params.doc || '');
  const qs  = new URLSearchParams(req.query);
  qs.set('doc', doc);
  const to = `/clientes?${qs.toString()}`;
  logAlias(req.originalUrl || req.url, to);
  req.url = to;
  next();
});

/** /api/pedido/:id  →  /api/pedidos/:id */
router.get('/pedido/:id', (req, _res, next) => {
  const qs = new URLSearchParams(req.query);
  const to = `/pedidos/${encodeURIComponent(req.params.id)}${qs.size ? `?${qs.toString()}` : ''}`;
  logAlias(req.originalUrl || req.url, to);
  req.url = to;
  next();
});

/** /api/vendas/pedidos/:id  →  /api/pedidos/:id */
router.get('/vendas/pedidos/:id', (req, _res, next) => {
  const qs = new URLSearchParams(req.query);
  const to = `/pedidos/${encodeURIComponent(req.params.id)}${qs.size ? `?${qs.toString()}` : ''}`;
  logAlias(req.originalUrl || req.url, to);
  req.url = to;
  next();
});

/** /api/produtos-fiscal/detalhes/:id  →  /api/produtos-fiscal/:id */
router.get('/produtos-fiscal/detalhes/:id', (req, _res, next) => {
  const qs = new URLSearchParams(req.query);
  const to = `/produtos-fiscal/${encodeURIComponent(req.params.id)}${qs.size ? `?${qs.toString()}` : ''}`;
  logAlias(req.originalUrl || req.url, to);
  req.url = to;
  next();
});

/** /api/nfe/pedido/:id  →  /api/pedidos/:id  (mantém ?by=numero e adiciona cache-bust leve) */
router.get('/nfe/pedido/:id', (req, _res, next) => {
  const qs = new URLSearchParams(req.query);
  if (!qs.has('_')) qs.set('_', Date.now().toString());
  const to = `/pedidos/${encodeURIComponent(req.params.id)}?${qs.toString()}`;
  logAlias(req.originalUrl || req.url, to);
  req.url = to;
  next();
});

export default router;
