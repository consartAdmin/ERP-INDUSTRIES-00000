// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.modal.js║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ Modais: treinamento, conclusão e e-mail                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULTS, els, STATUS_LABELS } from './customerTrainings.config.js';
import { setEditing, state } from './customerTrainings.state.js';
import { customerLabel, escapeHtml } from './customerTrainings.utils.js';

export function showMessage(message) {
    alert(message);
}

export function confirmAction(message) {
    return confirm(message);
}

function openModalEl(modal) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

export function closeModalEl(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    if (!document.querySelector('.modal.is-open')) {
        document.body.style.overflow = '';
    }
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DO TREINAMENTO
// ═══════════════════════════════════════════════════════════════════

export function renderCustomer() {
    els.fCustomerId.value = state.customer?.customer_id ?? '';
    els.fCustomerName.value = customerLabel(state.customer);
}

export function renderAttendees() {
    els.attendeesBody.innerHTML = state.attendees.length
        ? state.attendees.map((a, index) => `
            <tr data-index="${index}">
                <td><input type="text" data-attendee-field="name" value="${escapeHtml(a.name)}" placeholder="Nome" maxlength="150" /></td>
                <td><input type="email" data-attendee-field="email" value="${escapeHtml(a.email)}" placeholder="email@cliente.com" maxlength="200" /></td>
                <td><input type="text" data-attendee-field="phone" value="${escapeHtml(a.phone)}" placeholder="(00) 00000-0000" maxlength="40" /></td>
                <td><button type="button" class="btn btn-delete btn-sm" data-remove-attendee="${index}" title="Remover">×</button></td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="ct-empty">Nenhum participante. Adicione quem vai participar do treinamento.</td></tr>';
}

function renderTrainingActions() {
    const training = state.editing;
    const isSaved = Boolean(training?.training_id);

    els.btnDeleteTraining.classList.toggle('hidden', !isSaved);
    els.btnTrainingPdf.classList.toggle('hidden', !isSaved);
    els.btnTrainingEmail.classList.toggle('hidden', !isSaved);
    els.btnTrainingComplete.classList.toggle('hidden', !isSaved || training.status === 'cancelled');
    els.btnTrainingComplete.textContent = training?.status === 'done' ? '✎ Editar conclusão' : '✔ Concluir treinamento';

    els.trainingStatusBadge.classList.toggle('hidden', !isSaved);
    if (isSaved) {
        els.trainingStatusBadge.className = `ct-status ct-status--${training.status}`;
        els.trainingStatusBadge.textContent = STATUS_LABELS[training.status] || training.status;
    }
}

// training = null → novo (opcionalmente com data pré-definida "YYYY-MM-DD")
export function openTrainingModal(training = null, { date = '' } = {}) {
    setEditing(training);

    els.trainingModalTitle.textContent = training
        ? `Treinamento nº ${training.training_id}`
        : 'Novo treinamento';

    els.fTitle.value = training?.title || '';
    els.fScheduledAt.value = training?.scheduled_at || (date ? `${date}T09:00` : '');
    els.fDuration.value = training?.duration_minutes || DEFAULTS.duration;
    els.fFormat.value = training?.format || 'online';
    els.fStatus.value = training?.status || 'scheduled';
    els.fTrainer.value = training?.trainer_name || '';
    els.fLocation.value = training?.location_or_link || '';
    els.fTopics.value = training?.topics || '';

    renderCustomer();
    renderAttendees();
    renderTrainingActions();
    openModalEl(els.trainingModal);

    (training ? els.fTitle : els.btnPickCustomer).focus();
}

export function closeTrainingModal() {
    closeModalEl(els.trainingModal);
    setEditing(null);
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DE CONCLUSÃO
// ═══════════════════════════════════════════════════════════════════

export function openCompleteModal() {
    const training = state.editing;
    if (!training) return;

    els.cNotes.value = training.notes || '';
    els.cPending.value = training.pending_items || '';

    const attendees = training.attendees || [];
    els.attendanceList.innerHTML = attendees.length
        ? attendees.map((a) => `
            <label class="ct-check" for="att_${a.attendee_id}">
                <input id="att_${a.attendee_id}" type="checkbox" data-attendee-id="${a.attendee_id}"
                    ${a.attended === false ? '' : 'checked'} />
                ${escapeHtml(a.name || a.email)} ${a.email && a.name ? `<small>${escapeHtml(a.email)}</small>` : ''}
            </label>
        `).join('')
        : '<p class="fields-help">Nenhum participante cadastrado.</p>';

    openModalEl(els.completeModal);
    els.cNotes.focus();
}

export function closeCompleteModal() {
    closeModalEl(els.completeModal);
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DE E-MAIL
// ═══════════════════════════════════════════════════════════════════

const KIND_BY_STATUS = { done: 'report', cancelled: 'cancel' };

export function openEmailModal() {
    const training = state.editing;
    if (!training) return;

    const kind = KIND_BY_STATUS[training.status] || 'invite';
    const emails = (training.attendees || []).map((a) => a.email).filter(Boolean);

    els.eKind.value = kind;
    els.eTo.value = [...new Set(emails)].join(', ');
    els.eMessage.value = '';
    els.eAttachPdf.checked = kind === 'report';

    openModalEl(els.emailModal);
    els.eTo.focus();
}

export function closeEmailModal() {
    closeModalEl(els.emailModal);
}
