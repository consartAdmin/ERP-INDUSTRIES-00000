// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsCreate.repository.js — create                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './customerTrainings.constants.js';
import { normalizeAttendees, normalizeTrainingPayload } from './customerTrainings.sanitizers.js';
import { ensureTable } from './customerTrainingsSchema.repository.js';
import { replaceAttendees } from './customerTrainingsAttendees.repository.js';
import { getById } from './customerTrainingsQuery.repository.js';

export async function create(payload = {}, userId = null) {
  await ensureTable();

  const f = normalizeTrainingPayload(payload);
  const attendees = normalizeAttendees(payload.attendees);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `
      INSERT INTO ${TB} (
        customer_id, title, topics, scheduled_at, duration_minutes,
        format, location_or_link, trainer_name, status,
        created_by, updated_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, NOW(), NOW())
      RETURNING training_id
      `,
      [
        f.customer_id,
        f.title,
        f.topics,
        f.scheduled_at,
        f.duration_minutes,
        f.format,
        f.location_or_link,
        f.trainer_name,
        f.status || 'scheduled',
        userId,
      ]
    );

    const trainingId = rows[0].training_id;
    await replaceAttendees(client, trainingId, attendees);

    await client.query('COMMIT');
    return getById(trainingId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
