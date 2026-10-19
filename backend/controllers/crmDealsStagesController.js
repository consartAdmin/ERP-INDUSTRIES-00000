/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ crmDealsStagesController.js                                             ║
 * ║ Controller de Etapas do CRM                                             ║
 * ║ CONSART ERP | Backend ESM + PostgreSQL                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝ */

import {
  listStages,
  countStages,
  getStageById,
  createStage,
  updateStage,
  removeStage,
} from '../repositories/crmDealsStages/crmDealsStages.index.js';

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function sendError(res, error) {
  const status = error?.status || 500;
  return res.status(status).json({
    success: false,
    message: error?.message || 'Erro interno ao processar etapas do CRM.',
  });
}

/* ========================================================================== */
/* CONTROLLER                                                                 */
/* ========================================================================== */

export async function getCrmDealsStages(req, res) {
  try {
    const items = await listStages(req.query);
    const total = await countStages(req.query);

    return res.status(200).json({
      success: true,
      total,
      items,
      data: items,
    });
  } catch (error) {
    console.error('[crmDealsStagesController] getCrmDealsStages:', error);
    return sendError(res, error);
  }
}

export async function getCrmDealsStageById(req, res) {
  try {
    const item = await getStageById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Etapa não encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      item,
      data: item,
    });
  } catch (error) {
    console.error('[crmDealsStagesController] getCrmDealsStageById:', error);
    return sendError(res, error);
  }
}

export async function postCrmDealsStage(req, res) {
  try {
    const item = await createStage(req.body);

    return res.status(201).json({
      success: true,
      message: 'Etapa criada com sucesso.',
      item,
      data: item,
    });
  } catch (error) {
    console.error('[crmDealsStagesController] postCrmDealsStage:', error);
    return sendError(res, error);
  }
}

export async function putCrmDealsStage(req, res) {
  try {
    const item = await updateStage(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Etapa atualizada com sucesso.',
      item,
      data: item,
    });
  } catch (error) {
    console.error('[crmDealsStagesController] putCrmDealsStage:', error);
    return sendError(res, error);
  }
}

export async function deleteCrmDealsStage(req, res) {
  try {
    const hardDelete =
      String(req.query.hardDelete || '').trim().toLowerCase() === 'true';

    const item = await removeStage(req.params.id, { hardDelete });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Etapa não encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      message: hardDelete
        ? 'Etapa removida permanentemente com sucesso.'
        : 'Etapa desativada com sucesso.',
      item,
      data: item,
    });
  } catch (error) {
    console.error('[crmDealsStagesController] deleteCrmDealsStage:', error);
    return sendError(res, error);
  }
}