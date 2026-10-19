/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPaymentInstallmentsController.js                       ║
   ║ MODULE: Budget Payment Installments                                 ║
   ║ DESCRIPTION: Controller HTTP para parcelas de pagamentos            ║
   ║ CONSART ERP · ESM                                                   ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import budgetsPaymentInstallmentsApi from '../repositories/budgetsPaymentInstallments/budgetsPaymentInstallments.index.js';

function ok(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({
    ok: true,
    message,
    ...data
  });
}

function fail(res, error, status = 400) {
  const message = error?.message || 'Erro interno.';
  return res.status(status).json({
    ok: false,
    message
  });
}

export async function getBudgetPaymentInstallmentById(req, res) {
  try {
    const row = await budgetsPaymentInstallmentsApi.getById(req.params.id);

    if (!row) {
      return fail(res, new Error('Parcela não encontrada.'), 404);
    }

    return ok(res, { row }, 'Parcela encontrada.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function listBudgetPaymentInstallmentsByBudget(req, res) {
  try {
    const rows = await budgetsPaymentInstallmentsApi.listByBudget(req.params.budgetId);
    return ok(res, { rows, count: rows.length }, 'Parcelas do budget carregadas.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function listBudgetPaymentInstallmentsByBudgetPayment(req, res) {
  try {
    const rows = await budgetsPaymentInstallmentsApi.listByBudgetPayment(req.params.budgetPaymentId);
    return ok(res, { rows, count: rows.length }, 'Parcelas da linha de pagamento carregadas.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function createBudgetPaymentInstallment(req, res) {
  try {
    const row = await budgetsPaymentInstallmentsApi.create(req.body || {});
    return ok(res, { row }, 'Parcela criada com sucesso.', 201);
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function updateBudgetPaymentInstallment(req, res) {
  try {
    const row = await budgetsPaymentInstallmentsApi.update(req.params.id, req.body || {});

    if (!row) {
      return fail(res, new Error('Parcela não encontrada.'), 404);
    }

    return ok(res, { row }, 'Parcela atualizada com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function deleteBudgetPaymentInstallment(req, res) {
  try {
    const row = await budgetsPaymentInstallmentsApi.remove(req.params.id);

    if (!row) {
      return fail(res, new Error('Parcela não encontrada.'), 404);
    }

    return ok(res, { row }, 'Parcela removida com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function deleteBudgetPaymentInstallmentsByBudgetPayment(req, res) {
  try {
    const result = await budgetsPaymentInstallmentsApi.removeByBudgetPayment(req.params.budgetPaymentId);
    return ok(res, result, 'Parcelas da linha de pagamento removidas com sucesso.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function generateInstallmentsFromBudgetPayment(req, res) {
  try {
    const result = await budgetsPaymentInstallmentsApi.generateFromBudgetPayment(
      req.params.budgetPaymentId,
      { base_date: req.body?.base_date || req.query?.base_date || null }
    );

    return ok(res, result, 'Parcelas geradas com sucesso a partir da linha de pagamento.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function generateInstallmentsFromBudget(req, res) {
  try {
    const result = await budgetsPaymentInstallmentsApi.generateFromBudget(
      req.params.budgetId,
      { base_date: req.body?.base_date || req.query?.base_date || null }
    );

    return ok(res, result, 'Parcelas geradas com sucesso a partir do budget.');
  } catch (error) {
    return fail(res, error, 400);
  }
}

export default {
  getBudgetPaymentInstallmentById,
  listBudgetPaymentInstallmentsByBudget,
  listBudgetPaymentInstallmentsByBudgetPayment,
  createBudgetPaymentInstallment,
  updateBudgetPaymentInstallment,
  deleteBudgetPaymentInstallment,
  deleteBudgetPaymentInstallmentsByBudgetPayment,
  generateInstallmentsFromBudgetPayment,
  generateInstallmentsFromBudget
};