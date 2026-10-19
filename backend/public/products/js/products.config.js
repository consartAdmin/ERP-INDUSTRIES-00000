// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.config.js — Configurações do módulo de produtos            ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API_BASE = (window.apiBase || window.location.origin || '').replace(/\/+$/, '');
export const SIGNED_TTL_MS = 25 * 60 * 1000;