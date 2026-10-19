// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.js — Entry Point                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { bootstrapReportsProductsStock } from './reportsProductsStock.bootstrap.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapReportsProductsStock, { once: true });
} else {
  bootstrapReportsProductsStock();
}