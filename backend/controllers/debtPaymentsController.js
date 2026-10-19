/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: debtPaymentsController.js                                     ║
   ║ MODULE: Debt Payments Controller                                    ║
   ║ DESCRIPTION: HTTP handlers for debt payments                        ║
   ║ CONSART ERP · Express · ESM                                         ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import debtPaymentsApi from '../repositories/debtPayments/debtPayments.index.js';

function sendError(res, error, fallbackMessage = 'Erro interno do servidor.') {
  const message = error?.message || fallbackMessage;

  if (
    message.includes('inválido') ||
    message.includes('obrigatório') ||
    message.includes('deve ser') ||
    message.includes('não encontrada') ||
    message.includes('não encontrado')
  ) {
    return res.status(400).json({
      ok: false,
      message
    });
  }

  console.error('[debtPaymentsController]', error);

  return res.status(500).json({
    ok: false,
    message: fallbackMessage,
    error: message
  });
}

export async function listDebtPayments(req, res) {
  try {
    const debtId = Number(req.params.debtId || req.query.debt_id || req.query.debtId);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'debtId inválido.'
      });
    }

    const rows = await debtPaymentsApi.listByDebtId(debtId);
    const summary = await debtPaymentsApi.getSummaryByDebtId(debtId);

    return res.status(200).json({
      ok: true,
      debt_id: debtId,
      summary,
      rows
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao listar pagamentos da dívida.');
  }
}

export async function getDebtPaymentById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID do pagamento inválido.'
      });
    }

    const row = await debtPaymentsApi.getById(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Pagamento não encontrado.'
      });
    }

    return res.status(200).json({
      ok: true,
      row
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao buscar pagamento.');
  }
}

export async function createDebtPayment(req, res) {
  try {
    const debtId = Number(req.params.debtId || req.body.debt_id || req.body.debtId);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'debtId inválido.'
      });
    }

    const payload = {
      ...req.body,
      debt_id: debtId
    };

    const result = await debtPaymentsApi.createPayment(payload);

    return res.status(201).json({
      ok: true,
      message: 'Pagamento registrado com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao registrar pagamento.');
  }
}

export async function getDebtPaymentsCashDefaults(req, res) {
  try {
    const debtId = Number(req.params.debtId);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'debtId inválido.'
      });
    }

    const defaults = await debtPaymentsApi.getDebtCashDefaults(debtId);

    if (!defaults) {
      return res.status(404).json({
        ok: false,
        message: 'Dívida não encontrada.'
      });
    }

    return res.status(200).json({ ok: true, data: defaults });
  } catch (error) {
    return sendError(res, error, 'Erro ao buscar padrões do caixa.');
  }
}

export async function updateDebtPayment(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID do pagamento inválido.'
      });
    }

    const result = await debtPaymentsApi.updatePayment(id, req.body || {});

    return res.status(200).json({
      ok: true,
      message: 'Pagamento atualizado com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao atualizar pagamento.');
  }
}

export async function getDebtPaymentCash(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID do pagamento inválido.'
      });
    }

    const data = await debtPaymentsApi.getDebtPaymentCash(id);

    return res.status(200).json({ ok: true, data: data || {} });
  } catch (error) {
    return sendError(res, error, 'Erro ao buscar a movimentação do pagamento.');
  }
}

export async function deleteDebtPayment(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'ID do pagamento inválido.'
      });
    }

    const result = await debtPaymentsApi.deletePayment(id);

    return res.status(200).json({
      ok: true,
      message: 'Pagamento excluído com sucesso.',
      ...result
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao excluir pagamento.');
  }
}

export async function getDebtPaymentsSummary(req, res) {
  try {
    const debtId = Number(req.params.debtId || req.query.debt_id || req.query.debtId);

    if (!Number.isInteger(debtId) || debtId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'debtId inválido.'
      });
    }

    const summary = await debtPaymentsApi.getSummaryByDebtId(debtId);

    return res.status(200).json({
      ok: true,
      summary
    });
  } catch (error) {
    return sendError(res, error, 'Erro ao obter resumo dos pagamentos.');
  }
}

export default {
  listDebtPayments,
  getDebtPaymentById,
  createDebtPayment,
  updateDebtPayment,
  getDebtPaymentCash,
  deleteDebtPayment,
  getDebtPaymentsSummary
};