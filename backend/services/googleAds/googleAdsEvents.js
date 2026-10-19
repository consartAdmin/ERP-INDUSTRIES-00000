// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsEvents.js — Google Ads Offline Events (Conversions)         ║
// ║ CONSART ERP | ESM                                                    ║
// ║                                                                      ║
// ║ - Upload offline click conversions (gclid / gbraid / wbraid)         ║
// ║ - Isolado do GAQL (somente WRITE)                                    ║
// ║ - Usado pelo trackingRealtimeController                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* eslint-disable no-console */

function nowIso() {
  return new Date().toISOString();
}

function normDigits(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`[GoogleAdsEvents] ENV ausente: ${name}`);
  return v;
}

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${requireEnv('GOOGLE_ADS_ACCESS_TOKEN')}`,
    'developer-token': requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  };

  // MCC (opcional)
  if (process.env.GOOGLE_ADS_MANAGER_ID) {
    headers['login-customer-id'] = process.env.GOOGLE_ADS_MANAGER_ID;
  }

  return headers;
}

/**
 * Upload Offline Click Conversion
 * Docs:
 * https://developers.google.com/google-ads/api/docs/conversions/upload-clicks
 */
export async function uploadClickConversion({
  customerId,
  conversionActionResourceName,
  gclid,
  conversionDateTime, // "YYYY-MM-DD HH:mm:ss-03:00"
  value,
  currencyCode = 'BRL',
  validateOnly = false,
  requestId = '',
}) {
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION || '22';
  const cid = normDigits(customerId || process.env.GOOGLE_ADS_CUSTOMER_ID);

  if (!cid) throw new Error('[GoogleAdsEvents] customerId inválido');
  if (!conversionActionResourceName) throw new Error('[GoogleAdsEvents] conversionActionResourceName obrigatório');
  if (!gclid) throw new Error('[GoogleAdsEvents] gclid obrigatório');
  if (!conversionDateTime) throw new Error('[GoogleAdsEvents] conversionDateTime obrigatório');
  if (value === undefined || value === null) throw new Error('[GoogleAdsEvents] value obrigatório');

  const url = `https://googleads.googleapis.com/v${apiVersion}/customers/${cid}:uploadClickConversions`;

  const payload = {
    conversions: [
      {
        conversionAction: conversionActionResourceName,
        gclid,
        conversionDateTime,
        conversionValue: Number(value),
        currencyCode,
      },
    ],
    partialFailure: true,
    validateOnly: !!validateOnly,
  };

  console.log('[GoogleAdsEvents][uploadClickConversion] start', {
    ts: nowIso(),
    requestId,
    customerId: cid,
    conversionActionResourceName,
    value: Number(value),
    currencyCode,
    validateOnly,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const raw = await res.text().catch(() => '');
  let json;
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }

  if (!res.ok) {
    console.error('[GoogleAdsEvents][uploadClickConversion] HTTP_ERROR', {
      ts: nowIso(),
      requestId,
      status: res.status,
      statusText: res.statusText,
      response: json,
    });
    throw new Error(`Google Ads uploadClickConversions failed (${res.status})`);
  }

  console.log('[GoogleAdsEvents][uploadClickConversion] ok', {
    ts: nowIso(),
    requestId,
    results: json?.results?.length || 0,
    partialFailureError: json?.partialFailureError || null,
  });

  return json;
}

/**
 * Helper: map event → conversion action
 * (centraliza regra de negócio)
 */
export function mapEventToConversionAction(eventName) {
  const map = {
    purchase: process.env.GADS_CONV_PURCHASE,
    add_to_cart: process.env.GADS_CONV_ADD_TO_CART,
  };

  return map[eventName] || null;
}
