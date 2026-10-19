// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.config.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const API = '/api/customer-trainings';

export const DEFAULTS = Object.freeze({
    limit: 50,
    duration: 60,
    searchDebounceMs: 350,
    maxEventsPerDay: 3,
});

export const STATUS_LABELS = Object.freeze({
    scheduled: 'Agendado',
    rescheduled: 'Reagendado',
    done: 'Realizado',
    cancelled: 'Cancelado',
});

export const FORMAT_LABELS = Object.freeze({
    online: 'Online',
    onsite: 'Presencial',
});

export const WEEKDAYS = Object.freeze(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);

const $ = (sel) => document.querySelector(sel);

export const els = Object.freeze({
    btnReload: $('#btnReload'),
    btnNewTraining: $('#btnNewTraining'),

    // Abas
    tabList: $('#ctTabs'),
    calendarPanel: $('#calendarPanel'),
    listPanel: $('#listPanel'),

    // Calendário
    calTitle: $('#calTitle'),
    calGrid: $('#calGrid'),
    btnCalPrev: $('#btnCalPrev'),
    btnCalNext: $('#btnCalNext'),
    btnCalToday: $('#btnCalToday'),
    calModeButtons: document.querySelectorAll('[data-cal-mode]'),

    // Lista
    fltSearch: $('#fltSearch'),
    fltStatus: $('#fltStatus'),
    fltTrainer: $('#fltTrainer'),
    fltDateFrom: $('#fltDateFrom'),
    fltDateTo: $('#fltDateTo'),
    btnClearFilters: $('#btnClearFilters'),
    listBody: $('#listBody'),
    listTotal: $('#listTotal'),
    btnPrev: $('#btnPrev'),
    btnNext: $('#btnNext'),
    paginationLabel: $('#paginationLabel'),
    limitSelect: $('#limitSelect'),

    // Modal do treinamento
    trainingModal: $('#trainingModal'),
    trainingModalTitle: $('#trainingModalTitle'),
    trainingStatusBadge: $('#trainingStatusBadge'),
    fCustomerId: $('#fCustomerId'),
    fCustomerName: $('#fCustomerName'),
    btnPickCustomer: $('#btnPickCustomer'),
    fTitle: $('#fTitle'),
    fScheduledAt: $('#fScheduledAt'),
    fDuration: $('#fDuration'),
    fFormat: $('#fFormat'),
    fStatus: $('#fStatus'),
    fTrainer: $('#fTrainer'),
    fLocation: $('#fLocation'),
    fTopics: $('#fTopics'),
    attendeesBody: $('#attendeesBody'),
    btnAddAttendee: $('#btnAddAttendee'),
    btnAttendeeFromCustomer: $('#btnAttendeeFromCustomer'),
    btnDeleteTraining: $('#btnDeleteTraining'),
    btnTrainingPdf: $('#btnTrainingPdf'),
    btnTrainingEmail: $('#btnTrainingEmail'),
    btnTrainingComplete: $('#btnTrainingComplete'),
    btnSaveTraining: $('#btnSaveTraining'),

    // Modal de conclusão
    completeModal: $('#completeModal'),
    cNotes: $('#cNotes'),
    cPending: $('#cPending'),
    attendanceList: $('#attendanceList'),
    btnConfirmComplete: $('#btnConfirmComplete'),

    // Modal de e-mail
    emailModal: $('#emailModal'),
    eKind: $('#eKind'),
    eTo: $('#eTo'),
    eMessage: $('#eMessage'),
    eAttachPdf: $('#eAttachPdf'),
    btnSendEmail: $('#btnSendEmail'),
});
