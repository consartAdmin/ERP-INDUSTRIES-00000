// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAds.sanitizers.js — Filtra payload pelos campos permitidos   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getConfig } from './googleAds.utils.js';

export function sanitizeFields(resource, payload = {}) {
  const { allowedFields } = getConfig(resource);
  const clean = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      clean[field] = payload[field];
    }
  }

  return clean;
}
