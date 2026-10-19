// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.form.js ║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ Coleta dos formulários → payloads da API                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { els } from './customerTrainings.config.js';
import { state } from './customerTrainings.state.js';
import { parseEmailList } from './customerTrainings.utils.js';

const trimmed = (el) => el.value.trim();

// Mantém state.attendees em sincronia com o que foi digitado na tabela
export function syncAttendeesFromInputs() {
    els.attendeesBody.querySelectorAll('tr[data-index]').forEach((tr) => {
        const attendee = state.attendees[Number(tr.dataset.index)];
        if (!attendee) return;

        tr.querySelectorAll('[data-attendee-field]').forEach((input) => {
            attendee[input.dataset.attendeeField] = input.value.trim();
        });
    });
}

export function collectTrainingPayload() {
    syncAttendeesFromInputs();

    return {
        customer_id: Number(els.fCustomerId.value) || null,
        title: trimmed(els.fTitle),
        scheduled_at: els.fScheduledAt.value,
        duration_minutes: Number(els.fDuration.value) || null,
        format: els.fFormat.value,
        status: els.fStatus.value,
        trainer_name: trimmed(els.fTrainer),
        location_or_link: trimmed(els.fLocation),
        topics: els.fTopics.value.trim(),
        attendees: state.attendees
            .map((a) => ({
                name: (a.name || '').trim(),
                email: (a.email || '').trim(),
                phone: (a.phone || '').trim(),
                attended: a.attended ?? null,
            }))
            .filter((a) => a.name || a.email),
    };
}

export function collectCompletePayload() {
    return {
        notes: els.cNotes.value.trim(),
        pending_items: els.cPending.value.trim(),
        attendance: [...els.attendanceList.querySelectorAll('[data-attendee-id]')].map((input) => ({
            attendee_id: Number(input.dataset.attendeeId),
            attended: input.checked,
        })),
    };
}

export function collectEmailPayload() {
    return {
        kind: els.eKind.value,
        to: parseEmailList(els.eTo.value),
        message: els.eMessage.value.trim(),
        attach_pdf: els.eAttachPdf.checked,
    };
}
