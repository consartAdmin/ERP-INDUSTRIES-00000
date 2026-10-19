'use strict';
import { bindModal } from './banks.modal.js';
import { bindBankForm } from './banks.form.js';
import { bindBankActions, loadBanks, saveBank } from './banks.actions.js';
function init() { bindModal(); bindBankForm(saveBank); bindBankActions(); loadBanks(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
