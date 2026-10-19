// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingLoaderController.js — Entrega /api/tracking/loader.js         ║
// ║ CONSART ERP · ESM                                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { buildLoaderJs } from '../services/apis/trackingLoaderApi.js';
import * as trackingConfigApi from '../services/apis/trackingConfigApi.js';

const ALLOW_ORIGINS = new Set([
  'https://bh3distribuidora.com.br',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:3000',
]);

export async function loaderJs(req, res) {
  try {
    const origin = String(req.headers.origin || '');

    // ✅ CORS (permitir BH3 + localhost)
    if (ALLOW_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);

    // ✅ ESSENCIAL contra OpaqueResponseBlocking
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const js = await buildLoaderJs({ origin });

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

    // ✅ DEBUG: desliga cache (troque pra max-age=300 depois)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).send(js);
  } catch (e) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res
      .status(500)
      .send(`console.error("tracking loader error: ${String(e?.message || e)}");`);
  }
}

export async function status(req, res) {
  const row = await trackingConfigApi.getConfig();
  return res.json({
    ok: true,
    gtmEnabled: !!row.gtm_enabled,
    gtmId: row.gtm_container_id || null,
    ga4Enabled: !!row.ga4_enabled,
    ga4Id: row.ga4_measurement_id || null,
    metaEnabled: !!row.meta_enabled,
    metaId: row.meta_pixel_id || null,
    updatedAt: row.updated_at || null,
  });
}
