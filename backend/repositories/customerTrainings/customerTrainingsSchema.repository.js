// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsSchema.repository.js — ensureTable (DDL + índices)║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_ATTENDEES } from './customerTrainings.constants.js';

let ensured = false;

export async function ensureTable() {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      training_id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      title VARCHAR(200) NOT NULL,
      topics TEXT,
      scheduled_at TIMESTAMP NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      format VARCHAR(20) DEFAULT 'online',
      location_or_link VARCHAR(500),
      trainer_name VARCHAR(150),
      status VARCHAR(20) DEFAULT 'scheduled',
      notes TEXT,
      pending_items TEXT,
      completed_at TIMESTAMP,
      last_email_sent_at TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_customer_trainings_customer
      ON ${TB} (customer_id);

    CREATE INDEX IF NOT EXISTS idx_customer_trainings_scheduled
      ON ${TB} (scheduled_at);

    CREATE INDEX IF NOT EXISTS idx_customer_trainings_status
      ON ${TB} (status);

    CREATE TABLE IF NOT EXISTS ${TB_ATTENDEES} (
      attendee_id SERIAL PRIMARY KEY,
      training_id INTEGER NOT NULL REFERENCES ${TB} (training_id) ON DELETE CASCADE,
      name VARCHAR(150),
      email VARCHAR(200),
      phone VARCHAR(40),
      attended BOOLEAN,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_customer_training_attendees_training
      ON ${TB_ATTENDEES} (training_id);
  `);

  ensured = true;
}
