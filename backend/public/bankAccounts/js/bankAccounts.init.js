'use strict';
import { bindModal } from './bankAccounts.modal.js';
import { bindBankAccountForm } from './bankAccounts.form.js';
import { bindBankAccountActions, loadBankAccounts, loadBanks, saveBankAccount } from './bankAccounts.actions.js';
async function init() { bindModal(); bindBankAccountForm(saveBankAccount); bindBankAccountActions(); await loadBanks(); await loadBankAccounts(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
