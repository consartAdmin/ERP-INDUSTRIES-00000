// ╔════════════════════════════════════════════════════════════════════╗
// ║ analyticsTrackingGa4Client.repository.js — ENV guards + client GA4 ║
// ║ Avisos de ENV e criação do client ocorrem no import (como antes)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { BetaAnalyticsDataClient } from '@google-analytics/data';

// ---------------------------------------------------------------------
// ENV guards
// ---------------------------------------------------------------------
const GA4_PROPERTY_ID  = process.env.GA4_PROPERTY_ID;
const GA4_CLIENT_EMAIL = process.env.GA4_CLIENT_EMAIL;
const GA4_PRIVATE_KEY  = process.env.GA4_PRIVATE_KEY;

if (!GA4_PROPERTY_ID)  console.warn('[GA4] ⚠ GA4_PROPERTY_ID não definido no .env');
if (!GA4_CLIENT_EMAIL) console.warn('[GA4] ⚠ GA4_CLIENT_EMAIL não definido no .env');
if (!GA4_PRIVATE_KEY)  console.warn('[GA4] ⚠ GA4_PRIVATE_KEY não definido no .env');

export const client = new BetaAnalyticsDataClient({
  credentials: {
    client_email: GA4_CLIENT_EMAIL,
    private_key: (GA4_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
});

export const property = `properties/${GA4_PROPERTY_ID}`;
