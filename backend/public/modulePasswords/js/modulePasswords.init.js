// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.init.js                                       ║
// ║ MODULE: Senhas dos Módulos — Init                                   ║
// ║ Único script carregado pelo HTML                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { bindActions, loadAndRender } from './modulePasswords.actions.js';

function init() {
  bindActions();
  void loadAndRender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
