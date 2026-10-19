// ╔══════════════════════════════════════════════════════════════════════╗
// ║ apiBaseOrigin.js — CRM Reativação (PRODNEX ERP)                      ║
// ║ Retorna ORIGIN (sem /api) para modais legados                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import { API_ORIGIN, apiBase } from './config.js';

export function apiBaseOrigin() {
  // Preferir API_ORIGIN (já é origem)
  const origin = String(API_ORIGIN || '').trim();
  if (origin) return origin.replace(/\/$/, '');

  // Fallback: se alguém só tiver apiBase (que é .../api), remove /api no fim
  const base = String(apiBase || '').trim();
  return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
}