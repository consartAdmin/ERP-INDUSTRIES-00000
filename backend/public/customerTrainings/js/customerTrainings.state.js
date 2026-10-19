// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.state.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULTS } from './customerTrainings.config.js';

export const state = {
    tab: 'calendar',

    // Calendário
    calMode: 'month',
    calCursor: new Date(),
    calRows: [],

    // Lista
    page: 1,
    limit: DEFAULTS.limit,
    total: 0,
    listRows: [],

    // Edição
    editing: null, // treinamento carregado (com attendees) ou null quando novo
    customer: null, // { customer_id, trade_name, legal_name, ... }
    attendees: [], // [{ attendee_id?, name, email, phone, attended }]
};

export function setTab(tab) {
    state.tab = tab;
}

export function setCalMode(mode) {
    state.calMode = mode;
}

export function setCalCursor(date) {
    state.calCursor = date;
}

export function setCalRows(rows) {
    state.calRows = rows;
}

export function setListResult({ rows, total }) {
    state.listRows = rows;
    state.total = total;
}

export function setPage(page) {
    state.page = Math.max(1, page);
}

export function setLimit(limit) {
    state.limit = limit;
    state.page = 1;
}

export function setEditing(training) {
    state.editing = training;
    state.attendees = (training?.attendees || []).map((a) => ({ ...a }));
    state.customer = training
        ? {
            customer_id: training.customer_id,
            trade_name: training.customer_trade_name,
            legal_name: training.customer_legal_name,
            contact_name: training.customer_contact_name,
            email: training.customer_email,
            phone_number: training.customer_phone,
            mobile_number: training.customer_mobile,
            isFull: true, // contatos já vieram no getById
        }
        : null;
}

export function setCustomer(customer) {
    state.customer = customer;
}
