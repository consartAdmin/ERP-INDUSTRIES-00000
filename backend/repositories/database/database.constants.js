// ╔════════════════════════════════════════════════════════════════════╗
// ║ database.constants.js — Schema padrão e tabelas bloqueadas         ║
// ║ (Database Viewer / Editor)                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

export const DEFAULT_SCHEMA = 'public';

export const BLOCKED_TABLES = new Set([
  'cadastro_usuarios',
  'users',
  'sessions',
  'tokens',
  'passwords',
  'knex_migrations',
  'sequelize_meta',
]);

// pg_constraint.confupdtype / confdeltype → SQL
export const FK_ACTION_CODES = Object.freeze({
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
});

export const FK_ACTIONS = new Set(Object.values(FK_ACTION_CODES));

// Tipos aceitos em ADD COLUMN / ALTER TYPE (o tamanho "(n)" / "(p,s)" e "[]" são validados à parte)
export const ALLOWED_BASE_TYPES = new Set([
  'smallint', 'integer', 'int', 'int2', 'int4', 'int8', 'bigint',
  'numeric', 'decimal', 'real', 'double precision', 'float4', 'float8', 'money',
  'smallserial', 'serial', 'bigserial',
  'boolean', 'bool',
  'text', 'varchar', 'character varying', 'char', 'character', 'bpchar', 'citext',
  'date', 'time', 'time without time zone', 'time with time zone', 'timetz',
  'timestamp', 'timestamp without time zone', 'timestamp with time zone', 'timestamptz',
  'interval',
  'uuid', 'json', 'jsonb', 'bytea', 'inet', 'cidr',
]);

// DEFAULTs aceitos como expressão; qualquer outro valor vira literal entre aspas
export const SAFE_DEFAULT_EXPRESSIONS = [
  /^(now\(\)|current_timestamp|current_date|current_time|localtimestamp|localtime)$/i,
  /^(gen_random_uuid\(\)|uuid_generate_v4\(\))$/i,
  /^(true|false|null)$/i,
  /^-?\d+(\.\d+)?$/,
  /^nextval\('[a-zA-Z_][a-zA-Z0-9_."]*'(::regclass)?\)$/,
];

export const PG_IDENTIFIER_MAX = 63;
