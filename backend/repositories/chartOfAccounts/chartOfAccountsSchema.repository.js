// ╔════════════════════════════════════════════════════════════════════╗
// ║ chartOfAccountsSchema.repository.js — ensureTable() (DDL/trigger)  ║
// ║ Estado do módulo: ensurePromise (uma vez por processo)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  SCHEMA,
  COLUMNS,
  INDEXES,
  CHECKS,
  FOREIGN_KEYS,
  TRIGGERS,
  qi,
  TABLE,
  ALL_COLS,
} from './chartOfAccounts.constants.js';
import { query } from './chartOfAccounts.utils.js';

/* ───────────────────────── ensureTable() ───────────────────────── */

/** Converts a catalog default to SQL (strings are already SQL expressions) */
function sqlDefault(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

function columnDDL(name, col) {
  const type = col.length ? `${col.type}(${col.length})` : col.type;
  const parts = [`${qi(name)} ${type}`];
  const def = sqlDefault(col.default);
  if (def !== null) parts.push(`DEFAULT ${def}`);
  if (!col.nullable) parts.push('NOT NULL');
  return parts.join(' ');
}

function tableDDL() {
  const columnDefs = ALL_COLS.map((c) => columnDDL(c, COLUMNS[c]));

  const keyDefs = INDEXES
    .filter((i) => i.constraint)
    .map((i) =>
      `CONSTRAINT ${qi(i.name)} ${i.primary ? 'PRIMARY KEY' : 'UNIQUE'} (${i.columns.map(qi).join(', ')})`
    );

  const checkDefs = CHECKS.map((c) => `CONSTRAINT ${qi(c.name)} CHECK (${c.expression})`);

  const fkDefs = FOREIGN_KEYS.map(
    (f) =>
      `CONSTRAINT ${qi(f.constraint)} FOREIGN KEY (${qi(f.column)}) ` +
      `REFERENCES ${SCHEMA}.${qi(f.references.table)} (${qi(f.references.column)}) ` +
      `ON UPDATE ${f.onUpdate} ON DELETE ${f.onDelete}`
  );

  return `
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      ${[...columnDefs, ...keyDefs, ...checkDefs, ...fkDefs].join(',\n      ')}
    );
  `;
}

// The catalog describes the trigger; its function body lives here
const UPDATED_AT_TRIGGER = TRIGGERS[0];

async function createSchema() {
  const sequences = ALL_COLS.map((c) => COLUMNS[c].sequence).filter(Boolean);
  for (const seq of sequences) {
    await query(`CREATE SEQUENCE IF NOT EXISTS ${SCHEMA}.${qi(seq)};`);
  }

  await query(tableDDL());

  for (const idx of INDEXES.filter((i) => !i.constraint)) {
    await query(
      `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${qi(idx.name)} ` +
      `ON ${TABLE} USING ${idx.type} (${idx.columns.map(qi).join(', ')});`
    );
  }

  await query(`
    CREATE OR REPLACE FUNCTION ${SCHEMA}.${qi(UPDATED_AT_TRIGGER.function)}()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Creates the trigger only if missing (no DROP → no exclusive lock on every startup)
  await query(`
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = '${UPDATED_AT_TRIGGER.name}'
          AND tgrelid = '${TABLE}'::regclass
      ) THEN
        CREATE TRIGGER ${qi(UPDATED_AT_TRIGGER.name)}
        ${UPDATED_AT_TRIGGER.timing} ${UPDATED_AT_TRIGGER.events.join(' OR ')} ON ${TABLE}
        FOR EACH ${UPDATED_AT_TRIGGER.forEach}
        EXECUTE FUNCTION ${SCHEMA}.${qi(UPDATED_AT_TRIGGER.function)}();
      END IF;
    END
    $do$;
  `);
}

let ensurePromise = null;

/** Creates the table/indexes/trigger once per process; retries on the next call if it fails */
export function ensureTable() {
  if (!ensurePromise) {
    ensurePromise = createSchema().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}
