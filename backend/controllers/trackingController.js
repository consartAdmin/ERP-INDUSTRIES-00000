// ╔══════════════════════════════════════════════════════════════════════╗
// ║ trackingController.js — Controller Trackeamento (API REST)          ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js'; // ✅ ADD (necessário p/ realtime-events)
import { getConfig, upsertConfig } from '../services/apis/trackingConfigApi.js';

/* --------------------------------------------------------------------- */
/* GET /api/tracking/config                                              */
/* --------------------------------------------------------------------- */
export async function getTrackingConfig(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const cfg = await getConfig();

    res.json({
      gtmContainerId: cfg.gtm_container_id,
      gtmEnabled: cfg.gtm_enabled,

      ga4MeasurementId: cfg.ga4_measurement_id,
      ga4ApiSecret: !!cfg.ga4_api_secret,
      ga4Enabled: cfg.ga4_enabled,

      adsConversionId: cfg.ads_conversion_id,
      adsConversionLabel: cfg.ads_conversion_label,
      adsEnabled: cfg.ads_enabled,

      metaPixelId: cfg.meta_pixel_id,
      metaEnabled: cfg.meta_enabled,

      updatedAt: cfg.updated_at,
    });
  } catch (err) {
    console.error('[getTrackingConfig]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* PUT /api/tracking/config                                              */
/* --------------------------------------------------------------------- */
export async function updateTrackingConfig(req, res) {
  try {
    const saved = await upsertConfig(req.body || {});

    res.json({
      ok: true,
      gtmContainerId: saved.gtm_container_id,
      gtmEnabled: saved.gtm_enabled,

      ga4MeasurementId: saved.ga4_measurement_id,
      ga4ApiSecret: !!saved.ga4_api_secret,
      ga4Enabled: saved.ga4_enabled,

      adsConversionId: saved.ads_conversion_id,
      adsConversionLabel: saved.ads_conversion_label,
      adsEnabled: saved.ads_enabled,

      metaPixelId: saved.meta_pixel_id,
      metaEnabled: saved.meta_enabled,

      updatedAt: saved.updated_at,
    });
  } catch (err) {
    console.error('[updateTrackingConfig]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* --------------------------------------------------------------------- */
/* POST /api/tracking/test                                               */
/* --------------------------------------------------------------------- */
export async function testTrackingConfig(req, res) {
  const b = req.body || {};
  const checks = {};

  checks.gtm = b.gtmEnabled
    ? /^GTM-[A-Z0-9]+$/i.test(b.gtmContainerId || '')
      ? { ok: true, message: 'GTM OK' }
      : { ok: false, message: 'GTM inválido ou vazio' }
    : { ok: false, message: 'GTM desativado' };

  checks.ga4 = b.ga4Enabled
    ? /^G-[A-Z0-9]+$/i.test(b.ga4MeasurementId || '')
      ? { ok: true, message: 'GA4 OK' }
      : { ok: false, message: 'GA4 inválido ou vazio' }
    : { ok: false, message: 'GA4 desativado' };

  checks.ads = b.adsEnabled
    ? b.adsConversionId && b.adsConversionLabel
      ? { ok: true, message: 'Ads OK' }
      : { ok: false, message: 'Ads incompleto' }
    : { ok: false, message: 'Ads desativado' };

  checks.meta = b.metaEnabled
    ? /^[0-9]{5,20}$/.test(b.metaPixelId || '')
      ? { ok: true, message: 'Meta Pixel OK' }
      : { ok: false, message: 'Pixel inválido' }
    : { ok: false, message: 'Meta desativado' };

  res.json({
    ok: Object.values(checks).every(c => c.ok),
    checks,
  });
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/snippet/ecommerce.js                                */
/* --------------------------------------------------------------------- */
export async function serveEcommerceSnippet(req, res) {
  try {
    const cfg = await getConfig();

    const gtmEnabled = !!cfg.gtm_enabled && !!cfg.gtm_container_id;
    const ga4Enabled = !!cfg.ga4_enabled && !!cfg.ga4_measurement_id;
    const metaEnabled = !!cfg.meta_enabled && !!cfg.meta_pixel_id;

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    res.send(`
/* CONSART ERP · Tracking Loader */
window.CONSART_TRACKING = {
  gtmEnabled: ${gtmEnabled},
  gtmId: '${cfg.gtm_container_id || ''}',
  ga4Enabled: ${ga4Enabled},
  ga4Id: '${cfg.ga4_measurement_id || ''}',
  metaEnabled: ${metaEnabled},
  metaId: '${cfg.meta_pixel_id || ''}',
  generatedAt: '${new Date().toISOString()}'
};

window.dataLayer = window.dataLayer || [];
console.log('CONSART_TRACKING snippet loaded', window.CONSART_TRACKING);

/* ---------------- GTM ---------------- */
${gtmEnabled ? `
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0], j=d.createElement(s);
  j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${cfg.gtm_container_id}');
` : ''}

/* ---------------- GA4 direto (fallback) ---------------- */
${!gtmEnabled && ga4Enabled ? `
(function(){
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id=${cfg.ga4_measurement_id}';
  document.head.appendChild(s);
  function gtag(){dataLayer.push(arguments);}
  window.gtag=gtag;
  gtag('js', new Date());
  gtag('config', '${cfg.ga4_measurement_id}');
})();
` : ''}

/* ---------------- Meta Pixel ---------------- */
${metaEnabled ? `
(function(f,b,e,v,n,t,s){
  if(f.fbq) return;
  n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq) f._fbq=n;
  n.push=n; n.loaded=!0; n.version='2.0'; n.queue=[];
  t=b.createElement(e); t.async=!0; t.src=v;
  s=b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t,s);
})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${cfg.meta_pixel_id}');
fbq('track','PageView');
` : ''}

`);
  } catch (err) {
    console.error('[serveEcommerceSnippet]', err);
    res.status(500).send(`// erro: ${err.message}`);
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/tracking/realtime-events                                     */
/* Suporta paginação simples: ?before=<created_at>&limit=50              */
/* Retorna: { ok:true, data:{ updatedAt, rows:[...]} }                   */
/* --------------------------------------------------------------------- */
export async function getRealtimeEvents(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    const params = [];
    let whereSql = '';

    if (before && !Number.isNaN(before.getTime())) {
      params.push(before.toISOString());
      whereSql = `WHERE created_at < $${params.length}`;
    }

    params.push(limit);

    const { rows } = await pool.query(
      `
      SELECT
        time, event, page, product, sku, qty, value, session,
        created_at
      FROM public.tracking_events
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length}
      `,
      params
    );

    const updatedAt = new Date().toLocaleTimeString('pt-BR', { hour12: false });

    res.json({ ok: true, data: { updatedAt, rows } });
  } catch (err) {
    console.error('[tracking.getRealtimeEvents] error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
