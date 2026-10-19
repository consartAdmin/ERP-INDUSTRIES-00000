// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsMobile.mappers.js — rótulo de localização                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeText } from './productsMobile.sanitizers.js';

export function buildLocation(row = {}) {
  const parts = [
    row.local,
    row.corredor,
    row.prateleira,
    row.bandeja,
    row.position,
    row.box,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return parts.length
    ? parts.join(' / ')
    : 'Sem localização cadastrada';
}
