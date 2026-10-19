// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: googleAdsController.js                                        ║
// ║ MODULE: Google Ads Manual Input                                     ║
// ║ CONSART ERP                                                         ║
// ║ Descrição: controller HTTP para CRUD manual do módulo Google Ads.   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as googleAdsApi from '../repositories/googleAds/googleAds.index.js';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const ALLOWED_RESOURCES = new Set([
  'googleAdsAccounts',
  'googleAdsCampaigns',
  'googleAdsAdGroups',
  'googleAdsAds',
  'googleAdsKeywords',
  'googleAdsConversionActions',
  'googleAdsMetricsAdGroupDaily',
  'googleAdsMetricsKeywordDaily',
  'googleAdsMetricsAdDaily',
  'googleAdsMetricsDeviceDaily',
  'googleAdsMetricsGeoDaily',
  'googleAdsMetricsTimeDaily',
  'googleAdsOauthTokens',
  'googleAdsSyncLogs',
  'googleAdsClickTracking',
  'googleAdsErpAttribution',
]);

function ensureResource(resource) {
  if (!ALLOWED_RESOURCES.has(resource)) {
    const err = new Error(`Recurso inválido: ${resource}`);
    err.statusCode = 400;
    throw err;
  }
}

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    ok: false,
    message: error.message || 'Erro interno do servidor.',
    error: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
  });
}

/* ============================================================================
 * CRUD GENÉRICO
 * ========================================================================== */

export async function listResource(req, res) {
  try {
    const { resource } = req.params;
    ensureResource(resource);

    const result = await googleAdsApi.list(resource, req.query);

    return res.json({
      ok: true,
      resource,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getResourceById(req, res) {
  try {
    const { resource, id } = req.params;
    ensureResource(resource);

    const row = await googleAdsApi.getById(resource, id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Registro não encontrado.',
      });
    }

    return res.json({
      ok: true,
      resource,
      data: row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createResource(req, res) {
  try {
    const { resource } = req.params;
    ensureResource(resource);

    const created = await googleAdsApi.create(resource, req.body);

    return res.status(201).json({
      ok: true,
      message: 'Registro criado com sucesso.',
      resource,
      data: created,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateResource(req, res) {
  try {
    const { resource, id } = req.params;
    ensureResource(resource);

    const updated = await googleAdsApi.update(resource, id, req.body);

    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: 'Registro não encontrado para atualização.',
      });
    }

    return res.json({
      ok: true,
      message: 'Registro atualizado com sucesso.',
      resource,
      data: updated,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deleteResource(req, res) {
  try {
    const { resource, id } = req.params;
    ensureResource(resource);

    const deleted = await googleAdsApi.remove(resource, id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: 'Registro não encontrado para exclusão.',
      });
    }

    return res.json({
      ok: true,
      message: 'Registro removido com sucesso.',
      resource,
      data: deleted,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* ============================================================================
 * DASHBOARD / RESUMOS
 * ========================================================================== */

export async function getDashboardSummary(req, res) {
  try {
    const summary = await googleAdsApi.getDashboardSummary(req.query);

    return res.json({
      ok: true,
      data: summary,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getCampaignPerformance(req, res) {
  try {
    const rows = await googleAdsApi.getCampaignPerformance(req.query);

    return res.json({
      ok: true,
      rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getDailySeries(req, res) {
  try {
    const rows = await googleAdsApi.getDailySeries(req.query);

    return res.json({
      ok: true,
      rows,
      total: rows.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
}