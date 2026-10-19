// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/database/js/database.init.js                   ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadTables, registerActions } from './database.actions.js';
import { registerForm } from './database.form.js';
import { closeModal, closeStructureModal } from './database.modal.js';
import { renderStructure, renderTabs } from './database.render.js';
import { validateRequiredElements } from './database.validation.js';

async function init() {
    validateRequiredElements();
    closeModal();
    closeStructureModal();
    registerActions();
    registerForm();
    renderTabs();
    renderStructure();
    await loadTables();
}

init();
