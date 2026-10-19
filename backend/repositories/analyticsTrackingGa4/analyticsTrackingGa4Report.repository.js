// ╔════════════════════════════════════════════════════════════════════╗
// ║ analyticsTrackingGa4Report.repository.js — Realtime / Summary GA4  ║
// ║ Realtime: activeUsers | Summary (7 dias): sessions, totalUsers,    ║
// ║ eventCount, conversions, screenPageViews                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { client, property } from './analyticsTrackingGa4Client.repository.js';

// ---------------------------------------------------------------------
// 🔴 Realtime — estável (recomendado)
// ---------------------------------------------------------------------
export async function getRealtime() {
  const [response] = await client.runRealtimeReport({
    property,
    metrics: [{ name: 'activeUsers' }],
  });

  return response;
}

// ---------------------------------------------------------------------
// 📊 Summary — últimos 7 dias (agregado)
// ---------------------------------------------------------------------
export async function getSummary() {
  const [response] = await client.runReport({
    property,
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'eventCount' },
      { name: 'conversions' },
      { name: 'screenPageViews' }, // ✅ Pageviews REAL
    ],
  });

  return response;
}
