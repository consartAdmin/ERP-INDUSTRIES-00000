/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: debtsController.js                                            ║
   ║ MODULE: Debts Controller                                            ║
   ║ DESCRIPTION: HTTP handlers for debts                                ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import debtsApi from '../repositories/debts/debts.index.js';

import installmentPlansApi from '../repositories/debtInstallmentPlans/debtInstallmentPlans.index.js';

function sendError(res, error, fallbackMessage = 'Erro interno do servidor.') {
  const message = error?.message || fallbackMessage;

  if (
    message.includes('inválido') ||
    message.includes('obrigatório') ||
    message.includes('não encontrada') ||
    message.includes('não encontrado') ||
    message.includes('Não é possível') ||
    message.includes('deve ser')
  ) {
    return res.status(400).json({
      ok: false,
      message
    });
  }

  console.error('[debtsController]', error);

  return res.status(500).json({
    ok: false,
    message: fallbackMessage,
    error: message
  });
}

export async function listDebts(req, res) {
  try {
    const result = await debtsApi.list(req.query);

    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao listar dívidas.');
  }
}

export async function getDebtById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    const row = await debtsApi.getById(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Dívida não encontrada.'
      });
    }

    return res.status(200).json({
      ok: true,
      row
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao buscar dívida.');
  }
}

export async function createDebt(req, res) {
  try {
    const row = await debtsApi.create(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Dívida criada com sucesso.',
      row
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao criar dívida.');
  }
}

export async function updateDebt(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    const row = await debtsApi.update(id, req.body);

    return res.status(200).json({
      ok: true,
      message: 'Dívida atualizada com sucesso.',
      row
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao atualizar dívida.');
  }
}

export async function deleteDebt(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    const result = await debtsApi.remove(id);

    return res.status(200).json({
      ok: true,
      message: 'Dívida excluída com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao excluir dívida.');
  }
}

export async function getDebtsSummary(req, res) {
  try {
    const summary = await debtsApi.getSummary(req.query);

    return res.status(200).json({
      ok: true,
      summary
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao obter resumo das dívidas.');
  }
}

export async function createDebtInstallments(req, res) {
  try {
    const result = await debtsApi.createInstallments(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Parcelas geradas com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao gerar parcelas.');
  }
}

export async function getDebtInstallmentPlans(req, res) {
  try {
    const debtId = Number(req.params.id);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    const rows = await installmentPlansApi.listByDebtId(debtId);

    return res.status(200).json({
      ok: true,
      rows
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao buscar faixas de parcelas.');
  }
}

export async function saveDebtInstallmentPlans(req, res) {
  try {
    const debtId = Number(req.params.id);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    const rows = await installmentPlansApi.replaceByDebtId(
      debtId,
      req.body?.rows || []
    );

    return res.status(200).json({
      ok: true,
      message: 'Faixas de parcelas salvas com sucesso.',
      rows
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao salvar faixas de parcelas.');
  }
}

export async function deleteDebtInstallmentPlan(req, res) {
  try {
    const debtId = Number(req.params.id);
    const planId = Number(req.params.planId);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da dívida inválido.'
      });
    }

    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID da faixa inválido.'
      });
    }

    const result = await installmentPlansApi.removePlan(debtId, planId);

    return res.status(200).json({
      ok: true,
      message: 'Faixa excluída com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao excluir faixa de parcela.');
  }
}

export default {
  listDebts,
  getDebtById,
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtsSummary,
  createDebtInstallments,
  getDebtInstallmentPlans,
  saveDebtInstallmentPlans,
  deleteDebtInstallmentPlan
};