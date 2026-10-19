// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: controllers/budgetsShippingController.js                       ║
// ║ MODULE: Budgets Shipping Controller                                  ║
// ║ CONSART ERP                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Api from '../repositories/budgetsShipping/budgetsShipping.index.js';

// Postgres foreign_key_violation, mapped by constraint name.
const FK_ERRORS = {
  fk_budget_shipping_budget: { status: 404, message: 'Orçamento não encontrado.' },
  budgets_shipping_transporter_id_fkey: { status: 400, message: 'Transportadora não encontrada.' },
};

function parseBudgetId(req) {
  const budgetId = Number(req.params.budgetId);
  return Number.isInteger(budgetId) && budgetId > 0 ? budgetId : null;
}

function sendError(res, err, context, fallbackMessage) {
  if (err?.code === '23503' && FK_ERRORS[err.constraint]) {
    const { status, message } = FK_ERRORS[err.constraint];
    return res.status(status).json({ success: false, message });
  }

  console.error(`[budgetsShippingController.${context}]`, err);
  return res.status(500).json({
    success: false,
    message: err.message || fallbackMessage
  });
}

export async function getByBudgetId(req, res) {
  try {
    const budgetId = parseBudgetId(req);

    if (!budgetId) {
      return res.status(400).json({ success: false, message: 'budgetId inválido.' });
    }

    const data = await Api.getByBudgetId(budgetId);

    return res.json({
      success: true,
      data
    });
  } catch (err) {
    return sendError(res, err, 'getByBudgetId', 'Erro ao buscar frete do orçamento.');
  }
}

export async function upsert(req, res) {
  try {
    const budgetId = parseBudgetId(req);

    if (!budgetId) {
      return res.status(400).json({ success: false, message: 'budgetId inválido.' });
    }

    const data = await Api.upsert(budgetId, req.body || {});

    return res.json({
      success: true,
      data
    });
  } catch (err) {
    return sendError(res, err, 'upsert', 'Erro ao salvar frete do orçamento.');
  }
}

export async function remove(req, res) {
  try {
    const budgetId = parseBudgetId(req);

    if (!budgetId) {
      return res.status(400).json({ success: false, message: 'budgetId inválido.' });
    }

    await Api.remove(budgetId);

    return res.json({
      success: true,
      message: 'Frete removido com sucesso.'
    });
  } catch (err) {
    return sendError(res, err, 'remove', 'Erro ao remover frete do orçamento.');
  }
}
