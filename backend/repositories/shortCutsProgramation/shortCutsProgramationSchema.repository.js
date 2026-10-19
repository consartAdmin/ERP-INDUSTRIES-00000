// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationSchema.repository.js — ensureTable            ║
// ║ Cria categorias, subcategorias, atalhos, índices e FKs             ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_CATEGORIES, TB_SUBCATEGORIES } from './shortCutsProgramation.constants.js';

export async function ensureTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TB_CATEGORIES}
    (
      category_id BIGSERIAL PRIMARY KEY,
      name        VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon        VARCHAR(100),
      color       VARCHAR(20),
      sort_order  INTEGER DEFAULT 0,
      active      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${TB_SUBCATEGORIES}
    (
      subcategory_id BIGSERIAL PRIMARY KEY,
      category_id    BIGINT NOT NULL,
      name           VARCHAR(100) NOT NULL,
      description    TEXT,
      sort_order     INTEGER DEFAULT 0,
      active         BOOLEAN DEFAULT TRUE,
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW(),

      CONSTRAINT fk_shortcuts_subcategory_category
        FOREIGN KEY (category_id)
        REFERENCES public."shortCutsCategories"(category_id)
        ON DELETE CASCADE,

      CONSTRAINT uq_shortcuts_subcategory
        UNIQUE(category_id, name)
    );

    CREATE TABLE IF NOT EXISTS ${TB}
    (
      shortcut_id    BIGSERIAL PRIMARY KEY,

      category       VARCHAR(80),
      subcategory    VARCHAR(80),

      category_id    BIGINT,
      subcategory_id BIGINT,

      title          VARCHAR(200) NOT NULL,
      shortcut_key   VARCHAR(100) UNIQUE NOT NULL,
      shortcut_type  VARCHAR(30),
      language       VARCHAR(30) NOT NULL,
      description    TEXT,
      code           TEXT NOT NULL,
      code_template  TEXT,
      example        TEXT,
      observations   TEXT,
      tags           TEXT,
      difficulty     SMALLINT DEFAULT 1,
      favorite       BOOLEAN DEFAULT FALSE,
      active         BOOLEAN DEFAULT TRUE,
      sort_order     INTEGER DEFAULT 0,
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS category VARCHAR(80);

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS subcategory VARCHAR(80);

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS category_id BIGINT;

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS subcategory_id BIGINT;

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS shortcut_type VARCHAR(30);

    ALTER TABLE ${TB}
      ADD COLUMN IF NOT EXISTS code_template TEXT;

    CREATE INDEX IF NOT EXISTS idx_shortcuts_categories_active
      ON ${TB_CATEGORIES}(active);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_categories_name
      ON ${TB_CATEGORIES}(name);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_subcategories_category
      ON ${TB_SUBCATEGORIES}(category_id);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_subcategories_active
      ON ${TB_SUBCATEGORIES}(active);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_category
      ON ${TB}(category);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_category_id
      ON ${TB}(category_id);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_subcategory_id
      ON ${TB}(subcategory_id);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_language
      ON ${TB}(language);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_key
      ON ${TB}(shortcut_key);

    CREATE INDEX IF NOT EXISTS idx_shortcuts_programation_active
      ON ${TB}(active);
  `);

    await addForeignKeyIfNotExists({
        tableName: 'shortCutsProgramation',
        constraintName: 'fk_shortcuts_programation_category',
        sql: `
      ALTER TABLE ${TB}
      ADD CONSTRAINT fk_shortcuts_programation_category
      FOREIGN KEY (category_id)
      REFERENCES public."shortCutsCategories"(category_id)
    `,
    });

    await addForeignKeyIfNotExists({
        tableName: 'shortCutsProgramation',
        constraintName: 'fk_shortcuts_programation_subcategory',
        sql: `
      ALTER TABLE ${TB}
      ADD CONSTRAINT fk_shortcuts_programation_subcategory
      FOREIGN KEY (subcategory_id)
      REFERENCES public."shortCutsSubCategories"(subcategory_id)
    `,
    });
}

async function addForeignKeyIfNotExists({ tableName, constraintName, sql }) {
    const exists = await pool.query(
        `
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = $1
      AND c.conname = $2
    LIMIT 1
    `,
        [tableName, constraintName]
    );

    if (!exists.rowCount) {
        await pool.query(sql);
    }
}
