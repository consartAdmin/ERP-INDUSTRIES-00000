// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.init.js ║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadCalendar, registerActions } from './customerTrainings.actions.js';
import { els } from './customerTrainings.config.js';
import { renderTabs } from './customerTrainings.render.js';

function validarElementosObrigatorios() {
    const ausentes = Object.entries(els)
        .filter(([, el]) => !el || (el instanceof NodeList && !el.length))
        .map(([name]) => name);

    if (ausentes.length) {
        throw new Error(`Elementos HTML ausentes: ${ausentes.join(', ')}`);
    }
}

function iniciar() {
    validarElementosObrigatorios();
    registerActions();
    renderTabs();
    loadCalendar();
}

iniciar();
