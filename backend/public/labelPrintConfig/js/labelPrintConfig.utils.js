// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: labelPrintConfig.utils.js                                     ║
// ║ MODULE: Label Print Config — Utilities                              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : fallback;
}

export function toBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  return ['true', '1', 'yes', 'y', 'sim', 's'].includes(
    String(value).toLowerCase()
  );
}

export function mmToPx(mm) {
  return Number(mm) * 3.7795275591;
}

export function getBarcodeMock(type) {
  const barcodeMocks = {
    QR: '▦ ▦ ▦ ▦ ▦',
    EAN13: '7891234567890',
    EAN8: '78912345',
    UPC: '012345678905',
    CODE39: 'CODE-39-123',
    CODE128: '████████████████████████',
  };

  return barcodeMocks[type] || barcodeMocks.CODE128;
}
