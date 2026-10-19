// ╔══════════════════════════════════════════════════════════════════════╗
// ║ requireBudgetToOrderKey.js — Middleware chave Orçamento → Pedido     ║
// ║ CONSART ERP | ESM                                                   ║
// ║ - Protege POST /api/budgets/:id/to-order                             ║
// ║ - Header: x-budget-to-order-key  (preferido)                         ║
// ║ - Body:   { key } (fallback)                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function requireBudgetToOrderKey(req, res, next) {
  try {
    const enabled = String(process.env.BUDGET_TO_ORDER_KEY_ENABLED ?? 'true') === 'true';
    if (!enabled) return next();

    const expected = String(process.env.BUDGET_TO_ORDER_KEY ?? '').trim();
    if (!expected) {
      return res.status(500).json({
        ok: false,
        error: 'SERVER_MISCONFIG: missing BUDGET_TO_ORDER_KEY',
      });
    }

    const provided =
      String(req.headers['x-budget-to-order-key'] ?? '').trim() ||
      String(req.body?.key ?? '').trim();

    if (!provided || provided !== expected) {
      return res.status(403).json({
        ok: false,
        error: 'KEY_REQUIRED',
        message: 'Chave obrigatória para transformar orçamento em pedido.',
      });
    }

    return next();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'KEY_MIDDLEWARE_FAILED',
      message: String(err?.message || err || 'Erro'),
    });
  }
}