// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.auth.js — Auth headers                                     ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}