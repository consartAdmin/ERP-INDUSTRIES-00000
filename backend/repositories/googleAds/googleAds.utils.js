// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAds.utils.js — Resolução da config por recurso               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLES } from './googleAds.constants.js';

export function getConfig(resource) {
  const config = TABLES[resource];
  if (!config) {
    const err = new Error(`Recurso inválido: ${resource}`);
    err.statusCode = 400;
    throw err;
  }
  return config;
}
