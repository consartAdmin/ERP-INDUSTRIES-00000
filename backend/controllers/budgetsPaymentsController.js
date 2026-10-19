/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPaymentsController.js                                  ║
   ║ MODULE: Budgets Payments                                            ║
   ║ DESCRIPTION: Controller HTTP para pagamentos de budgets             ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import budgetsPaymentsApi from '../repositories/budgetsPayments/budgetsPayments.index.js';

function ok(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({
    ok: true,
    message,
    ...data
  });
}

function fail(res, error, status = 400) {
  return res.status(status).json({
    ok: false,
    message: error?.message || 'Erro interno.'
  });
}

export async function getBudgetPaymentById(req, res) {
  try {
    const row = await budgetsPaymentsApi.getById(req.params.id);

    if (!row) {
      return fail(res, new Error('Pagamento não encontrado.'), 404);
    }

    return ok(res, { row }, 'Pagamento encontrado.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function listBudgetPaymentsByBudget(req, res) {
  try {
    const rows = await budgetsPaymentsApi.listByBudget(req.params.budgetId);
    const validation = await budgetsPaymentsApi.validateBudgetPaymentsTotal(req.params.budgetId);

    return ok(
      res,
      { rows, count: rows.length, validation },
      'Pagamentos do budget carregados.'
    );
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function createBudgetPayment(req, res) {
  try {
    const row = await budgetsPaymentsApi.create(req.body || {}, {
      auto_generate_installments: req.body?.auto_generate_installments
    });

    return ok(res, { row }, 'Pagamento criado com sucesso.', 201);
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function updateBudgetPayment(req, res) {
  try {
    const row = await budgetsPaymentsApi.update(req.params.id, req.body || {}, {
      regenerate_installments: req.body?.regenerate_installments
    });

    if (!row) {
      return fail(res, new Error('Pagamento não encontrado.'), 404);
    }

    return ok(res, { row }, 'Pagamento atualizado com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function deleteBudgetPayment(req, res) {
  try {
    const row = await budgetsPaymentsApi.remove(req.params.id);

    if (!row) {
      return fail(res, new Error('Pagamento não encontrado.'), 404);
    }

    return ok(res, { row }, 'Pagamento removido com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function deleteBudgetPaymentsByBudget(req, res) {
  try {
    const result = await budgetsPaymentsApi.removeByBudget(req.params.budgetId);
    return ok(res, result, 'Pagamentos do budget removidos com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function regenerateInstallmentsByPayment(req, res) {
  try {
    const result = await budgetsPaymentsApi.regenerateInstallmentsFromPayment(req.params.id);
    return ok(res, result, 'Parcelas regeneradas com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function regenerateInstallmentsByBudget(req, res) {
  try {
    const result = await budgetsPaymentsApi.regenerateInstallmentsFromBudget(req.params.budgetId);
    return ok(res, result, 'Parcelas do budget regeneradas com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function validateBudgetPayments(req, res) {
  try {
    const result = await budgetsPaymentsApi.validateBudgetPaymentsTotal(req.params.budgetId);
    return ok(res, result, 'Validação de pagamentos concluída.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function replaceBudgetPayments(req, res) {
  try {
    const payments =
      Array.isArray(req.body?.payments)
        ? req.body.payments
        : [];

    const installments =
      Array.isArray(req.body?.installments)
        ? req.body.installments
        : [];

    const result =
      await budgetsPaymentsApi.replaceBudgetPayments(
        req.params.budgetId,
        payments,
        {
          auto_generate_installments:
            req.body?.auto_generate_installments,

          installments
        }
      );

    return ok(
      res,
      result,
      'Pagamentos substituídos com sucesso.'
    );

  } catch (error) {
    return fail(
      res,
      error,
      400
    );
  }
}

export default {
  getBudgetPaymentById,
  listBudgetPaymentsByBudget,
  createBudgetPayment,
  updateBudgetPayment,
  deleteBudgetPayment,
  deleteBudgetPaymentsByBudget,
  regenerateInstallmentsByPayment,
  regenerateInstallmentsByBudget,
  validateBudgetPayments,
  replaceBudgetPayments
};