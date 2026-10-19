// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingConfigController.js — Config Tracking (GET/PUT/TEST)         ║
// ║ CONSART ERP · ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as trackingConfigApi from '../services/apis/trackingConfigApi.js';

// Helpers
const ok = (res, data) => res.status(200).json(data);
const bad = (res, msg, detail) => res.status(400).json({ ok: false, error: msg, detail });

// Normaliza DB -> JSON do frontend
function mapDbToUi(row) {
  return {
    ok: true,
    gtmContainerId: row.gtm_container_id,
    gtmEnabled: !!row.gtm_enabled,

    ga4MeasurementId: row.ga4_measurement_id,
    // nunca expor secret em claro pro frontend
    ga4ApiSecret: row.ga4_api_secret ? true : false,
    ga4Enabled: !!row.ga4_enabled,

    adsConversionId: row.ads_conversion_id,
    adsConversionLabel: row.ads_conversion_label,
    adsEnabled: !!row.ads_enabled,

    metaPixelId: row.meta_pixel_id,
    metaEnabled: !!row.meta_enabled,

    updatedAt: row.updated_at || null,
  };
}

export async function getConfig(req, res) {
  try {
    const row = await trackingConfigApi.getConfig();
    return ok(res, mapDbToUi(row));
  } catch (e) {
    return bad(res, 'Falha ao ler config', e?.message);
  }
}

export async function putConfig(req, res) {
  try {
    const row = await trackingConfigApi.upsertConfig(req.body || {});
    return ok(res, mapDbToUi(row));
  } catch (e) {
    return bad(res, 'Falha ao salvar config', e?.message);
  }
}

/**
 * TESTE:
 * - Se vier body, valida body (modo payload)
 * - Se body vier vazio, valida config salva (modo sistema)
 */
export async function testConfig(req, res) {
  try {
    const body = req.body && Object.keys(req.body).length ? req.body : null;

    let payload;
    if (body) {
      payload = body;
    } else {
      const row = await trackingConfigApi.getConfig();
      payload = mapDbToUi(row);
    }

    const checks = {
      gtm: {
        ok: !!payload.gtmEnabled && !!payload.gtmContainerId,
        message: (!!payload.gtmEnabled && !!payload.gtmContainerId) ? 'GTM parece válido.' : 'GTM desativado.',
      },
      ga4: {
        ok: !!payload.ga4Enabled && !!payload.ga4MeasurementId,
        message: (!!payload.ga4Enabled && !!payload.ga4MeasurementId) ? 'GA4 Measurement ID OK.' : 'GA4 desativado.',
      },
      ads: {
        ok: !!payload.adsEnabled && !!payload.adsConversionId && !!payload.adsConversionLabel,
        message: (!!payload.adsEnabled && !!payload.adsConversionId && !!payload.adsConversionLabel) ? 'Conversão configurada.' : 'Google Ads desativado.',
      },
      meta: {
        ok: !!payload.metaEnabled && !!payload.metaPixelId,
        message: (!!payload.metaEnabled && !!payload.metaPixelId) ? 'Pixel ID OK.' : 'Meta Pixel desativado.',
      },
    };

    const allOk = Object.values(checks).every(x => x.ok);

    return ok(res, {
      ok: allOk,
      source: body ? 'payload' : 'db',
      checks,
      hint: 'Valide também no Tag Assistant, GA4 Realtime e Meta Events Manager (bloqueios do navegador podem ocultar scripts).',
    });
  } catch (e) {
    return bad(res, 'Falha no teste', e?.message);
  }
}
