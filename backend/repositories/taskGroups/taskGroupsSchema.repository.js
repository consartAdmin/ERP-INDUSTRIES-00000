// ╔════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsSchema.repository.js — ensureTable (DDL + índices)       ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './taskGroups.constants.js';

export async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB} (
      task_group_id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      color VARCHAR(20),
      icon VARCHAR(20),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_task_groups_active
      ON ${TB} (is_active);

    CREATE INDEX IF NOT EXISTS idx_task_groups_name
      ON ${TB} (name);
  `);
}
