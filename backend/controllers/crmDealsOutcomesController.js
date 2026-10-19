/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ crmDealsOutcomesController.js                                       ║
 * ║ CONSART ERP — Controller de resultados de negociações CRM           ║
 * ║                                                                      ║
 * ║ Endpoints:                                                          ║
 * ║ • GET    /api/crm/deals-outcomes                                    ║
 * ║ • GET    /api/crm/deals-outcomes/summary                            ║
 * ║ • GET    /api/crm/deals-outcomes/:id                                ║
 * ║ • GET    /api/crm/deals-outcomes/code/:code                         ║
 * ║ • GET    /api/crm/deals-outcomes/:id/operations                     ║
 * ║ • GET    /api/crm/deals-outcomes/code/:code/operations              ║
 * ║ • POST   /api/crm/deals-outcomes                                    ║
 * ║ • PUT    /api/crm/deals-outcomes/:id                                ║
 * ║ • DELETE /api/crm/deals-outcomes/:id                                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import {
  listCrmDealsOutcomes,
  getCrmDealsOutcomeById,
  getCrmDealsOutcomeByCode,
  createCrmDealsOutcome,
  updateCrmDealsOutcome,
  deleteCrmDealsOutcome,
  listCrmDealsOutcomesSummary,
  listOperationsByOutcomeCode,
  listOperationsByOutcomeId
} from '../repositories/crmDealsOutcomes/crmDealsOutcomes.index.js';
import { normalizeCrmCompany } from '../repositories/crmDeals/crmDeals.utils.js';

// CRM da tela: header X-CRM-Company ('BH3' | 'CONSART'); sem header = BH3.
function getCrmCompany(req) {
  return normalizeCrmCompany(req.get('x-crm-company') || req.query.crmCompany);
}

/* =======================================================================
 * HELPERS
 * ======================================================================= */

function handleError(res, error, defaultMessage) {
  console.error(defaultMessage, error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || defaultMessage
  });
}

/* =======================================================================
 * LIST
 * ======================================================================= */

export async function getCrmDealsOutcomes(req, res) {
  try {
    const result = await listCrmDealsOutcomes({
      q: req.query.q || '',
      is_active: req.query.is_active,
      limit: req.query.limit,
      offset: req.query.offset
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao listar crmDealsOutcomes.'
    );
  }
}

export async function getCrmDealsOutcomesSummaryController(req, res) {
  try {
    const rows = await listCrmDealsOutcomesSummary();

    return res.json({
      success: true,
      items: rows
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao listar resumo de crmDealsOutcomes.'
    );
  }
}

/* =======================================================================
 * GET ONE
 * ======================================================================= */

export async function getCrmDealsOutcomeController(req, res) {
  try {
    const row = await getCrmDealsOutcomeById(req.params.id);

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Outcome não encontrado.'
      });
    }

    return res.json({
      success: true,
      item: row
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao buscar crmDealsOutcome por ID.'
    );
  }
}

export async function getCrmDealsOutcomeByCodeController(req, res) {
  try {
    const row = await getCrmDealsOutcomeByCode(req.params.code);

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Outcome não encontrado.'
      });
    }

    return res.json({
      success: true,
      item: row
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao buscar crmDealsOutcome por code.'
    );
  }
}

/* =======================================================================
 * CREATE / UPDATE / DELETE
 * ======================================================================= */

export async function createCrmDealsOutcomeController(req, res) {
  try {
    const created = await createCrmDealsOutcome(req.body || {});

    return res.status(201).json({
      success: true,
      message: 'Outcome criado com sucesso.',
      item: created
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao criar crmDealsOutcome.'
    );
  }
}

export async function updateCrmDealsOutcomeController(req, res) {
  try {
    const updated = await updateCrmDealsOutcome(req.params.id, req.body || {});

    return res.json({
      success: true,
      message: 'Outcome atualizado com sucesso.',
      item: updated
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao atualizar crmDealsOutcome.'
    );
  }
}

export async function deleteCrmDealsOutcomeController(req, res) {
  try {
    const deleted = await deleteCrmDealsOutcome(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Outcome não encontrado.'
      });
    }

    return res.json({
      success: true,
      message: 'Outcome removido com sucesso.',
      item: deleted
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao remover crmDealsOutcome.'
    );
  }
}

/* =======================================================================
 * OPERATIONS
 * ======================================================================= */

export async function getOperationsByOutcomeIdController(req, res) {
  try {
    const result = await listOperationsByOutcomeId(req.params.id, getCrmCompany(req));

    return res.json({
      success: true,
      outcome: result.outcome,
      total: result.total,
      totalValue: result.totalValue,
      rows: result.rows
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao listar operações por outcome_id.'
    );
  }
}

export async function getOperationsByOutcomeCodeController(req, res) {
  try {
    const result = await listOperationsByOutcomeCode(req.params.code, getCrmCompany(req));

    return res.json({
      success: true,
      outcome: result.outcome,
      total: result.total,
      totalValue: result.totalValue,
      rows: result.rows
    });
  } catch (error) {
    return handleError(
      res,
      error,
      '[CRM] Erro ao listar operações por outcome code.'
    );
  }
}