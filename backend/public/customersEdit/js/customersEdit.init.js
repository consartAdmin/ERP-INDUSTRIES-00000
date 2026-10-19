// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.init.js — Inicialização | PRODNEX ERP                 ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import { initializeCustomersEdit } from './customersEdit.actions.js';
import './customersEdit.tab.anexos.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeCustomersEdit().catch((error) => {
    console.error('[customersEdit.init] Falha ao inicializar:', error);
  });
});
