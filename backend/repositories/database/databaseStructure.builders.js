// ╔════════════════════════════════════════════════════════════════════╗
// ║ databaseStructure.builders.js — Monta o SQL (DDL) de cada operação ║
// ║ O cliente nunca envia SQL: envia { type, ... } e o SQL nasce aqui  ║
// ║ com identificadores validados, tipos e DEFAULTs em allowlist.      ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  ALLOWED_BASE_TYPES,
  FK_ACTIONS,
  PG_IDENTIFIER_MAX,
  SAFE_DEFAULT_EXPRESSIONS,
} from './database.constants.js';
import { assertSafeIdentifier, quoteExistingIdent, quoteIdent } from './database.sanitizers.js';

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeType(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const match = raw.match(/^([a-z][a-z0-9 ]*?)\s?(\(\s?\d+\s?(?:,\s?\d+\s?)?\))?(\[\])?$/);

  if (!match || !ALLOWED_BASE_TYPES.has(match[1])) {
    throw badRequest(`Tipo de dado não permitido: ${value}`);
  }

  const size = match[2] ? match[2].replace(/\s/g, '') : '';
  return `${match[1]}${size}${match[3] || ''}`;
}

function buildDefault(value) {
  const raw = String(value).trim();

  if (SAFE_DEFAULT_EXPRESSIONS.some((re) => re.test(raw))) return raw;

  return `'${raw.replace(/'/g, "''")}'`;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function assertNonEmpty(columns, label) {
  if (!Array.isArray(columns) || !columns.length) {
    throw badRequest(`Informe ao menos uma coluna para ${label}.`);
  }
}

// Colunas da tabela atual: confere no catálogo e cita com segurança
function existingColumnList(structure, columns, label) {
  assertNonEmpty(columns, label);
  const names = columns.map(String);
  assertColumnsExist(structure, names);
  return names.map(quoteExistingIdent).join(', ');
}

// Colunas de outra tabela (não conferidas aqui): regra estrita de identificador
function identList(columns, label) {
  assertNonEmpty(columns, label);
  return columns.map((c) => quoteIdent(c)).join(', ');
}

function assertColumnsExist(structure, columns) {
  const existing = new Set(structure.columns.map((c) => c.column_name));
  const missing = columns.filter((c) => !existing.has(c));

  if (missing.length) {
    throw badRequest(`Coluna(s) inexistente(s) em ${structure.table}: ${missing.join(', ')}`);
  }
}

function findColumn(structure, name) {
  const column = structure.columns.find((c) => c.column_name === name);
  if (!column) throw badRequest(`Coluna inexistente: ${name}`);
  return column;
}

function constraintName(explicit, table, columns, suffix) {
  if (hasValue(explicit)) return assertSafeIdentifier(explicit, 'Nome da constraint');

  return [table, ...columns, suffix].join('_').slice(0, PG_IDENTIFIER_MAX);
}

function assertConstraintExists(structure, name) {
  const all = [
    structure.primaryKey,
    ...structure.foreignKeys,
    ...structure.uniques,
    ...structure.checks,
  ].filter(Boolean);

  if (!all.some((c) => c.name === name)) {
    throw badRequest(`Constraint inexistente em ${structure.table}: ${name}`);
  }
}

function fkAction(value, label) {
  const action = String(value || 'NO ACTION').trim().toUpperCase();
  if (!FK_ACTIONS.has(action)) throw badRequest(`${label} inválido: ${value}`);
  return action;
}

// ─────────────────────────────────────────────────────────────────────
// Operações
// ─────────────────────────────────────────────────────────────────────

const BUILDERS = {
  'column.add'(op, s, fullTable) {
    const name = assertSafeIdentifier(op.column, 'Nome da coluna');

    if (s.columns.some((c) => c.column_name === name)) {
      throw badRequest(`A coluna ${name} já existe.`);
    }

    let sql = `ALTER TABLE ${fullTable} ADD COLUMN ${quoteIdent(name)} ${normalizeType(op.dataType)}`;
    if (hasValue(op.default)) sql += ` DEFAULT ${buildDefault(op.default)}`;
    if (op.nullable === false) sql += ' NOT NULL';

    return [sql];
  },

  'column.alter'(op, s, fullTable) {
    const name = String(op.column ?? '');
    const current = findColumn(s, name);
    const col = quoteExistingIdent(name);
    const statements = [];

    if (hasValue(op.dataType)) {
      const type = normalizeType(op.dataType);

      if (type !== String(current.data_type).toLowerCase()) {
        statements.push(`ALTER TABLE ${fullTable} ALTER COLUMN ${col} TYPE ${type} USING ${col}::${type}`);
      }
    }

    if (typeof op.nullable === 'boolean' && op.nullable !== current.is_nullable) {
      statements.push(`ALTER TABLE ${fullTable} ALTER COLUMN ${col} ${op.nullable ? 'DROP' : 'SET'} NOT NULL`);
    }

    // DEFAULT reenviado igual ao atual (ex.: 'ATIVO'::character varying) não é alterado
    const prevDefault = current.column_default ?? null;
    const sameDefault = hasValue(op.default)
      ? String(op.default).trim() === prevDefault
      : prevDefault === null;

    if (op.default !== undefined && !sameDefault) {
      statements.push(hasValue(op.default)
        ? `ALTER TABLE ${fullTable} ALTER COLUMN ${col} SET DEFAULT ${buildDefault(op.default)}`
        : `ALTER TABLE ${fullTable} ALTER COLUMN ${col} DROP DEFAULT`);
    }

    // Renomear por último: os comandos acima usam o nome atual
    if (hasValue(op.newName) && op.newName !== name) {
      const newName = assertSafeIdentifier(op.newName, 'Novo nome da coluna');

      if (s.columns.some((c) => c.column_name === newName)) {
        throw badRequest(`Já existe uma coluna chamada ${newName}.`);
      }

      statements.push(`ALTER TABLE ${fullTable} RENAME COLUMN ${col} TO ${quoteIdent(newName)}`);
    }

    return statements;
  },

  'column.drop'(op, s, fullTable) {
    const name = String(op.column ?? '');
    findColumn(s, name);

    return [`ALTER TABLE ${fullTable} DROP COLUMN ${quoteExistingIdent(name)}${op.cascade ? ' CASCADE' : ''}`];
  },

  'pk.set'(op, s, fullTable) {
    const cols = existingColumnList(s, op.columns, 'a chave primária');

    const name = constraintName(op.constraintName, s.table, [], 'pkey');
    const statements = [];

    if (s.primaryKey) {
      statements.push(`ALTER TABLE ${fullTable} DROP CONSTRAINT ${quoteExistingIdent(s.primaryKey.name)}`);
    }

    statements.push(`ALTER TABLE ${fullTable} ADD CONSTRAINT ${quoteIdent(name)} PRIMARY KEY (${cols})`);
    return statements;
  },

  'pk.drop'(op, s, fullTable) {
    if (!s.primaryKey) throw badRequest('Esta tabela não possui chave primária.');

    return [`ALTER TABLE ${fullTable} DROP CONSTRAINT ${quoteExistingIdent(s.primaryKey.name)}`];
  },

  'fk.add'(op, s, fullTable) {
    const columns = (op.columns || []).map(String);
    const refColumns = (op.refColumns || []).map((c) => assertSafeIdentifier(c, 'Coluna referenciada'));
    const refSchema = assertSafeIdentifier(op.refSchema || s.schema, 'Schema referenciado');
    const refTable = assertSafeIdentifier(op.refTable, 'Tabela referenciada');

    const cols = existingColumnList(s, columns, 'a chave estrangeira');
    const refCols = identList(refColumns, 'a tabela referenciada');

    if (columns.length !== refColumns.length) {
      throw badRequest('A FK precisa ter a mesma quantidade de colunas locais e referenciadas.');
    }

    const name = constraintName(op.constraintName, s.table, columns, 'fkey');
    const onDelete = fkAction(op.onDelete, 'ON DELETE');
    const onUpdate = fkAction(op.onUpdate, 'ON UPDATE');

    return [
      `ALTER TABLE ${fullTable} ADD CONSTRAINT ${quoteIdent(name)} FOREIGN KEY (${cols}) `
      + `REFERENCES ${quoteIdent(refSchema)}.${quoteIdent(refTable)} (${refCols}) `
      + `ON UPDATE ${onUpdate} ON DELETE ${onDelete}`,
    ];
  },

  'unique.add'(op, s, fullTable) {
    const columns = (op.columns || []).map(String);
    const cols = existingColumnList(s, columns, 'a UNIQUE');

    const name = constraintName(op.constraintName, s.table, columns, 'key');

    return [`ALTER TABLE ${fullTable} ADD CONSTRAINT ${quoteIdent(name)} UNIQUE (${cols})`];
  },

  'constraint.drop'(op, s, fullTable) {
    const name = String(op.constraintName ?? '');
    assertConstraintExists(s, name);

    return [`ALTER TABLE ${fullTable} DROP CONSTRAINT ${quoteExistingIdent(name)}`];
  },

  'index.create'(op, s, fullTable) {
    const columns = (op.columns || []).map(String);
    const cols = existingColumnList(s, columns, 'o índice');

    const name = constraintName(op.indexName, s.table, columns, 'idx');

    if (s.indexes.some((i) => i.name === name)) {
      throw badRequest(`Já existe um índice chamado ${name}.`);
    }

    return [`CREATE ${op.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdent(name)} ON ${fullTable} (${cols})`];
  },

  'index.drop'(op, s) {
    const name = String(op.indexName ?? '');
    const index = s.indexes.find((i) => i.name === name);

    if (!index) throw badRequest(`Índice inexistente em ${s.table}: ${name}`);

    if (index.constraintName) {
      throw badRequest(
        `O índice ${name} pertence à constraint ${index.constraintName}. Remova a constraint.`
      );
    }

    return [`DROP INDEX ${quoteIdent(s.schema)}.${quoteExistingIdent(name)}`];
  },
};

export const STRUCTURE_OPERATIONS = Object.freeze(Object.keys(BUILDERS));

export function buildStructureSql(operation, structure) {
  const builder = BUILDERS[operation?.type];

  if (!builder) {
    throw badRequest(`Operação de estrutura inválida: ${operation?.type}`);
  }

  const fullTable = `${quoteIdent(structure.schema)}.${quoteIdent(structure.table)}`;
  const statements = builder(operation, structure, fullTable);

  if (!statements.length) {
    throw badRequest('Nenhuma alteração detectada.');
  }

  return statements;
}
