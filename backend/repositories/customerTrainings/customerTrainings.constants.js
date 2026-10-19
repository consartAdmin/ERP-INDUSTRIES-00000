// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainings.constants.js — Tabelas de treinamentos           ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."customerTrainings"';
export const TB_ATTENDEES = 'public."customerTrainingAttendees"';
export const TB_CUSTOMERS = 'public."customers"';

export const STATUSES = Object.freeze(['scheduled', 'rescheduled', 'done', 'cancelled']);
export const FORMATS = Object.freeze(['online', 'onsite']);

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

// scheduled_at é TIMESTAMP sem fuso: devolvido como texto para não sofrer
// conversão de fuso no driver pg / JSON (servidor em UTC x usuário em BRT)
export const SCHEDULED_AT_SQL = `to_char(t.scheduled_at, 'YYYY-MM-DD"T"HH24:MI')`;
