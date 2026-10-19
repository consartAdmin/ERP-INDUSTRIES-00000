'use strict';

import { bindActions, loadList, refreshItemImage } from './mobilized.actions.js';
import { resetEditor } from './mobilized.form.js';
import { bindModalEvents, buildDetailsModal, configureModal, exposeDetailsApi } from './mobilized.modal.js';
import { renderItems, renderTotals } from './mobilized.render.js';
import { itemImageFile } from './mobilized.state.js';

function init() {
  try {
    document.body.append(itemImageFile);
    configureModal({ refreshItemImage });
    buildDetailsModal(); bindModalEvents(); bindActions(); exposeDetailsApi();
    resetEditor(); renderItems(); renderTotals(); loadList(true);
    console.info('[mobilized.init] Módulo inicializado.');
  } catch (error) {
    console.error('[mobilized.init] Falha na inicialização:', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();

