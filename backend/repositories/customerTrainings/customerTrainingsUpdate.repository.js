// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsUpdate.repository.js — update / complete          ║
// ║ - update: trocar a data de um agendado vira "Reagendado"           ║
// ║ - complete: notas, pendências e presença → status "Realizado"      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_ATTENDEES } from './customerTrainings.constants.js';
import {
  badRequest,
  normalizeAttendees,
  normalizeTrainingPayload,
  toBool,
  toPositiveInt,
  toStrOrNull,
} from './customerTrainings.sanitizers.js';
import { ensureTable } from './customerTrainingsSchema.repository.js';
import { replaceAttendees } from './customerTrainingsAttendees.repository.js';
import { getById } from './customerTrainingsQuery.repository.js';

async function getCurrentOrThrow(id) {
  const current = await getById(id);
  if (!current) throw badRequest('Treinamento não encontrado.', 404);
  return current;
}

function resolveStatus(current, f) {
  if (f.status && f.status !== current.status) return f.status;

  const dateChanged = f.scheduled_at.slice(0, 16) !== String(current.scheduled_at).replace('T', ' ');
  if (dateChanged && ['scheduled', 'rescheduled'].includes(current.status)) return 'rescheduled';

  return current.status;
}

export async function update(id, payload = {}, userId = null) {
  await ensureTable();

  const current = await getCurrentOrThrow(id);
  const f = normalizeTrainingPayload(payload);
  const attendees = normalizeAttendees(payload.attendees);
  const status = resolveStatus(current, f);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      UPDATE ${TB}
      SET
        customer_id = $2,
        title = $3,
        topics = $4,
        scheduled_at = $5,
        duration_minutes = $6,
        format = $7,
        location_or_link = $8,
        trainer_name = $9,
        status = $10,
        updated_by = $11,
        updated_at = NOW()
      WHERE training_id = $1
      `,
      [
        current.training_id,
        f.customer_id,
        f.title,
        f.topics,
        f.scheduled_at,
        f.duration_minutes,
        f.format,
        f.location_or_link,
        f.trainer_name,
        status,
        userId,
      ]
    );

    await replaceAttendees(client, current.training_id, attendees);

    await client.query('COMMIT');
    return getById(current.training_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// payload: { notes, pending_items, attendance: [{ attendee_id, attended }] }
export async function complete(id, payload = {}, userId = null) {
  await ensureTable();

  const current = await getCurrentOrThrow(id);
  if (current.status === 'cancelled') {
    throw badRequest('Treinamento cancelado não pode ser concluído.');
  }

  const attendance = Array.isArray(payload.attendance) ? payload.attendance : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      UPDATE ${TB}
      SET
        status = 'done',
        notes = $2,
        pending_items = $3,
        completed_at = COALESCE(completed_at, NOW()),
        updated_by = $4,
        updated_at = NOW()
      WHERE training_id = $1
      `,
      [current.training_id, toStrOrNull(payload.notes), toStrOrNull(payload.pending_items), userId]
    );

    for (const item of attendance) {
      const attendeeId = toPositiveInt(item?.attendee_id);
      if (!attendeeId) continue;

      await client.query(
        `UPDATE ${TB_ATTENDEES} SET attended = $3 WHERE attendee_id = $1 AND training_id = $2`,
        [attendeeId, current.training_id, toBool(item.attended) ?? false]
      );
    }

    await client.query('COMMIT');
    return getById(current.training_id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markEmailSent(id) {
  await ensureTable();
  await pool.query(
    `UPDATE ${TB} SET last_email_sent_at = NOW() WHERE training_id = $1`,
    [id]
  );
}
