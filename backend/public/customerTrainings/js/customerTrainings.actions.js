// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.actions.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ Carregamento de dados + eventos da página e dos modais               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import {
    completeTraining,
    createTraining,
    deleteTraining,
    fetchCustomer,
    fetchTraining,
    fetchTrainings,
    openTrainingPdf,
    sendTrainingEmail,
    updateTraining,
} from './customerTrainings.api.js';
import { DEFAULTS, els } from './customerTrainings.config.js';
import {
    collectCompletePayload,
    collectEmailPayload,
    collectTrainingPayload,
    syncAttendeesFromInputs,
} from './customerTrainings.form.js';
import {
    closeCompleteModal,
    closeEmailModal,
    closeModalEl,
    closeTrainingModal,
    confirmAction,
    openCompleteModal,
    openEmailModal,
    openTrainingModal,
    renderAttendees,
    renderCustomer,
    showMessage,
} from './customerTrainings.modal.js';
import { renderCalendar, renderList, renderListError, renderTabs } from './customerTrainings.render.js';
import {
    setCalCursor,
    setCalMode,
    setCalRows,
    setCustomer,
    setLimit,
    setListResult,
    setPage,
    setTab,
    state,
} from './customerTrainings.state.js';
import { addDays, calendarRange, debounce, toIsoDate } from './customerTrainings.utils.js';
import { validateEmailRecipients, validateTraining } from './customerTrainings.validation.js';

// Evita duplo clique em botões que chamam a API
async function withBusy(button, fn) {
    if (button.disabled) return;
    button.disabled = true;
    try {
        await fn();
    } catch (error) {
        console.error('[customerTrainings]', error);
        showMessage(error.message || 'Erro inesperado.');
    } finally {
        button.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════════════════
// CARREGAMENTO
// ═══════════════════════════════════════════════════════════════════

export async function loadCalendar() {
    const { start, end } = calendarRange(state.calCursor, state.calMode);

    try {
        const result = await fetchTrainings({
            date_from: toIsoDate(start),
            date_to: toIsoDate(end),
            limit: 500,
        });
        setCalRows(result.rows || []);
    } catch (error) {
        console.error('[customerTrainings] calendário', error);
        setCalRows([]);
        showMessage(`Erro ao carregar o calendário: ${error.message}`);
    }

    renderCalendar();
}

export async function loadList() {
    try {
        const result = await fetchTrainings({
            q: els.fltSearch.value.trim(),
            status: els.fltStatus.value,
            trainer: els.fltTrainer.value.trim(),
            date_from: els.fltDateFrom.value,
            date_to: els.fltDateTo.value,
            page: state.page,
            limit: state.limit,
        });
        setListResult({ rows: result.rows || [], total: result.total || 0 });
        renderList();
    } catch (error) {
        console.error('[customerTrainings] lista', error);
        renderListError(`Erro ao carregar treinamentos: ${error.message}`);
    }
}

export function reloadCurrentView() {
    return state.tab === 'calendar' ? loadCalendar() : loadList();
}

async function openTrainingById(id) {
    try {
        openTrainingModal(await fetchTraining(id));
    } catch (error) {
        showMessage(`Erro ao abrir o treinamento: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════
// ABAS / CALENDÁRIO / LISTA
// ═══════════════════════════════════════════════════════════════════

function registerViewEvents() {
    els.tabList.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-tab]');
        if (!tab || tab.dataset.tab === state.tab) return;
        setTab(tab.dataset.tab);
        renderTabs();
        reloadCurrentView();
    });

    els.btnReload.addEventListener('click', reloadCurrentView);
    els.btnNewTraining.addEventListener('click', () => openTrainingModal(null));

    // Calendário
    const shiftCalendar = (step) => {
        const c = state.calCursor;
        setCalCursor(state.calMode === 'week'
            ? addDays(c, 7 * step)
            : new Date(c.getFullYear(), c.getMonth() + step, 1));
        loadCalendar();
    };

    els.btnCalPrev.addEventListener('click', () => shiftCalendar(-1));
    els.btnCalNext.addEventListener('click', () => shiftCalendar(1));
    els.btnCalToday.addEventListener('click', () => {
        setCalCursor(new Date());
        loadCalendar();
    });

    els.calModeButtons.forEach((btn) => btn.addEventListener('click', () => {
        if (btn.dataset.calMode === state.calMode) return;
        setCalMode(btn.dataset.calMode);
        loadCalendar();
    }));

    els.calGrid.addEventListener('click', (event) => {
        const eventBtn = event.target.closest('[data-event-id]');
        if (eventBtn) return openTrainingById(eventBtn.dataset.eventId);

        // "+N mais" → abre a semana daquele dia
        const more = event.target.closest('[data-more-date]');
        if (more) {
            setCalMode('week');
            setCalCursor(new Date(`${more.dataset.moreDate}T12:00`));
            return loadCalendar();
        }

        const day = event.target.closest('[data-date]');
        if (day) openTrainingModal(null, { date: day.dataset.date });
    });

    // Lista
    const reloadFirstPage = () => {
        setPage(1);
        loadList();
    };

    els.fltSearch.addEventListener('input', debounce(reloadFirstPage, DEFAULTS.searchDebounceMs));
    els.fltTrainer.addEventListener('input', debounce(reloadFirstPage, DEFAULTS.searchDebounceMs));
    [els.fltStatus, els.fltDateFrom, els.fltDateTo].forEach((el) => el.addEventListener('change', reloadFirstPage));

    els.btnClearFilters.addEventListener('click', () => {
        [els.fltSearch, els.fltStatus, els.fltTrainer, els.fltDateFrom, els.fltDateTo].forEach((el) => { el.value = ''; });
        reloadFirstPage();
    });

    els.listBody.addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-id]');
        if (row) openTrainingById(row.dataset.id);
    });

    els.btnPrev.addEventListener('click', () => {
        setPage(state.page - 1);
        loadList();
    });

    els.btnNext.addEventListener('click', () => {
        setPage(state.page + 1);
        loadList();
    });

    els.limitSelect.addEventListener('change', () => {
        setLimit(Number(els.limitSelect.value) || DEFAULTS.limit);
        loadList();
    });
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DO TREINAMENTO
// ═══════════════════════════════════════════════════════════════════

function customerContactAsAttendee(customer) {
    return {
        name: customer.contact_name || customer.trade_name || customer.legal_name || '',
        email: customer.email || '',
        phone: customer.mobile_number || customer.phone_number || '',
        attended: null,
    };
}

async function addCustomerContact() {
    if (!state.customer?.customer_id) {
        showMessage('Selecione o cliente primeiro.');
        return;
    }

    // O resultado da busca não traz os contatos → busca o cadastro completo
    if (!state.customer.isFull) {
        setCustomer({ ...state.customer, ...(await fetchCustomer(state.customer.customer_id)), isFull: true });
    }

    const contact = customerContactAsAttendee(state.customer);
    if (!contact.email && !contact.name) {
        showMessage('O cadastro do cliente não possui contato informado.');
        return;
    }

    syncAttendeesFromInputs();
    const exists = state.attendees.some((a) => contact.email && a.email?.toLowerCase() === contact.email.toLowerCase());
    if (exists) {
        showMessage('O contato do cliente já está na lista de participantes.');
        return;
    }

    state.attendees.push(contact);
    renderAttendees();
}

async function saveTraining() {
    const payload = collectTrainingPayload();
    const error = validateTraining(payload);
    if (error) {
        showMessage(error);
        return;
    }

    const saved = state.editing?.training_id
        ? await updateTraining(state.editing.training_id, payload)
        : await createTraining(payload);

    openTrainingModal(saved);
    reloadCurrentView();
}

async function removeTraining() {
    const training = state.editing;
    if (!training?.training_id) return;
    if (!confirmAction(`Excluir o treinamento "${training.title}"?`)) return;

    await deleteTraining(training.training_id);
    closeTrainingModal();
    reloadCurrentView();
}

function registerTrainingModalEvents() {
    els.btnPickCustomer.addEventListener('click', () => openCustomersModalSearch({
        onPick: (customer) => {
            setCustomer(customer);
            renderCustomer();
        },
    }));

    els.btnAddAttendee.addEventListener('click', () => {
        syncAttendeesFromInputs();
        state.attendees.push({ name: '', email: '', phone: '', attended: null });
        renderAttendees();
        els.attendeesBody.querySelector('tr:last-child input')?.focus();
    });

    els.btnAttendeeFromCustomer.addEventListener('click', () => withBusy(els.btnAttendeeFromCustomer, addCustomerContact));

    els.attendeesBody.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-remove-attendee]');
        if (!btn) return;
        syncAttendeesFromInputs();
        state.attendees.splice(Number(btn.dataset.removeAttendee), 1);
        renderAttendees();
    });

    els.btnSaveTraining.addEventListener('click', () => withBusy(els.btnSaveTraining, saveTraining));
    els.btnDeleteTraining.addEventListener('click', () => withBusy(els.btnDeleteTraining, removeTraining));
    els.btnTrainingPdf.addEventListener('click', () => withBusy(els.btnTrainingPdf, () => openTrainingPdf(state.editing.training_id)));
    els.btnTrainingComplete.addEventListener('click', openCompleteModal);
    els.btnTrainingEmail.addEventListener('click', openEmailModal);
}

// ═══════════════════════════════════════════════════════════════════
// MODAIS DE CONCLUSÃO E E-MAIL
// ═══════════════════════════════════════════════════════════════════

async function confirmComplete() {
    const updated = await completeTraining(state.editing.training_id, collectCompletePayload());
    closeCompleteModal();
    openTrainingModal(updated);
    reloadCurrentView();

    if (confirmAction('Treinamento concluído! Deseja enviar o relatório por e-mail aos participantes?')) {
        openEmailModal();
    }
}

async function sendEmail() {
    const payload = collectEmailPayload();
    const error = validateEmailRecipients(payload.to);
    if (error) {
        showMessage(error);
        return;
    }

    const result = await sendTrainingEmail(state.editing.training_id, payload);
    closeEmailModal();
    showMessage(`E-mail enviado para: ${(result.to || payload.to).join(', ')}`);
}

function registerSecondaryModalEvents() {
    els.btnConfirmComplete.addEventListener('click', () => withBusy(els.btnConfirmComplete, confirmComplete));
    els.btnSendEmail.addEventListener('click', () => withBusy(els.btnSendEmail, sendEmail));

    els.eKind.addEventListener('change', () => {
        els.eAttachPdf.checked = els.eKind.value === 'report';
    });
}

// ═══════════════════════════════════════════════════════════════════
// FECHAMENTO GENÉRICO (×, Cancelar, backdrop, Esc)
// ═══════════════════════════════════════════════════════════════════

function closeByElement(modal) {
    if (modal === els.trainingModal) closeTrainingModal();
    else closeModalEl(modal);
}

function registerCloseEvents() {
    document.addEventListener('click', (event) => {
        const closer = event.target.closest('[data-close-modal]');
        if (closer) closeByElement(closer.closest('.modal'));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        // Fecha só o modal de cima (e-mail/conclusão ficam sobre o do treinamento)
        const open = [els.emailModal, els.completeModal, els.trainingModal]
            .find((m) => m.classList.contains('is-open'));
        if (open && !document.getElementById('cms-overlay')) closeByElement(open);
    });
}

export function registerActions() {
    registerViewEvents();
    registerTrainingModalEvents();
    registerSecondaryModalEvents();
    registerCloseEvents();
}
