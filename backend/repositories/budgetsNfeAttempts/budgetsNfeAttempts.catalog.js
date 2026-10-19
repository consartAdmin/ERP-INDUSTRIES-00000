// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.budgetsNfeAttempts.js — PostgreSQL schema catalog    ║
// ║ CONSART ERP | Table: public."budgetsNfeAttempts"                    ║
// ║                                                                      ║
// ║ Purpose                                                              ║
// ║ - Centralize the real database structure of budgetsNfeAttempts       ║
// ║ - Provide metadata for SELECT / INSERT / UPDATE                      ║
// ║ - Avoid duplicated column definitions across NF-e services           ║
// ║ - Keep NF-e attempt APIs synchronized with PostgreSQL                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ──────────────────────────────────────────────────────────────────────
// 1. TABLE IDENTIFICATION
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_SCHEMA_NAME = 'public';

export const BUDGETS_NFE_ATTEMPTS_TABLE_NAME = 'budgetsNfeAttempts';

export const BUDGETS_NFE_ATTEMPTS_TABLE =
  `${BUDGETS_NFE_ATTEMPTS_SCHEMA_NAME}."${BUDGETS_NFE_ATTEMPTS_TABLE_NAME}"`;

export const BUDGETS_NFE_ATTEMPTS_PRIMARY_KEY = 'attempt_id';


// ──────────────────────────────────────────────────────────────────────
// 2. COLUMN DEFINITIONS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_COLUMNS = Object.freeze({

  attempt_id: {
    name: 'attempt_id',
    type: 'bigint',
    nullable: false,
    primaryKey: true,
    sequence: 'budgetsNfeAttempts_attempt_id_seq',
    generated: true,
    default: `nextval('"budgetsNfeAttempts_attempt_id_seq"'::regclass)`,
  },

  budget_id: {
    name: 'budget_id',
    type: 'bigint',
    nullable: false,
    default: null,
  },

  invoice_id: {
    name: 'invoice_id',
    type: 'bigint',
    nullable: true,
    default: null,
  },

  attempt_number: {
    name: 'attempt_number',
    type: 'integer',
    nullable: false,
    default: 1,
  },

  nfe_status_id: {
    name: 'nfe_status_id',
    type: 'integer',
    nullable: false,
    default: null,
  },

  nfe_number: {
    name: 'nfe_number',
    type: 'bigint',
    nullable: true,
    default: null,
  },

  nfe_series: {
    name: 'nfe_series',
    type: 'integer',
    nullable: true,
    default: null,
  },

  nfe_environment: {
    name: 'nfe_environment',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: null,
  },

  operation_type_id: {
    name: 'operation_type_id',
    type: 'bigint',
    nullable: true,
    default: null,
  },

  customer_id: {
    name: 'customer_id',
    type: 'bigint',
    nullable: true,
    default: null,
  },

  customer_name: {
    name: 'customer_name',
    type: 'varchar',
    length: 240,
    nullable: true,
    default: null,
  },

  customer_tax_id: {
    name: 'customer_tax_id',
    type: 'varchar',
    length: 30,
    nullable: true,
    default: null,
  },

  customer_email: {
    name: 'customer_email',
    type: 'varchar',
    length: 180,
    nullable: true,
    default: null,
  },

  customer_phone: {
    name: 'customer_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
    default: null,
  },

  issue_date: {
    name: 'issue_date',
    type: 'date',
    nullable: true,
    default: null,
  },

  subtotal: {
    name: 'subtotal',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
    default: 0,
  },

  discount_total: {
    name: 'discount_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
    default: 0,
  },

  freight_value: {
    name: 'freight_value',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
    default: 0,
  },

  total_amount: {
    name: 'total_amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: false,
    default: 0,
  },

  provider_id: {
    name: 'provider_id',
    type: 'varchar',
    length: 120,
    nullable: true,
    default: null,
  },

  integration_id: {
    name: 'integration_id',
    type: 'varchar',
    length: 160,
    nullable: true,
    default: null,
  },

  access_key: {
    name: 'access_key',
    type: 'varchar',
    length: 44,
    nullable: true,
    default: null,
  },

  protocol: {
    name: 'protocol',
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  },

  request_payload: {
    name: 'request_payload',
    type: 'jsonb',
    nullable: true,
    default: null,
  },

  provider_response: {
    name: 'provider_response',
    type: 'jsonb',
    nullable: true,
    default: null,
  },

  generated_xml: {
    name: 'generated_xml',
    type: 'text',
    nullable: true,
    default: null,
  },

  error_code: {
    name: 'error_code',
    type: 'varchar',
    length: 80,
    nullable: true,
    default: null,
  },

  error_message: {
    name: 'error_message',
    type: 'text',
    nullable: true,
    default: null,
  },

  requested_by: {
    name: 'requested_by',
    type: 'bigint',
    nullable: true,
    default: null,
  },

  requested_at: {
    name: 'requested_at',
    type: 'timestamptz',
    nullable: false,
    generated: true,
    default: 'now()',
  },

  authorized_at: {
    name: 'authorized_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  },

  rejected_at: {
    name: 'rejected_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  },

  last_checked_at: {
    name: 'last_checked_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  },

  created_at: {
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    generated: true,
    default: 'now()',
  },

  updated_at: {
    name: 'updated_at',
    type: 'timestamptz',
    nullable: false,
    generated: true,
    default: 'now()',
  },
});


// ──────────────────────────────────────────────────────────────────────
// 3. COLUMN NAMES
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_COLUMN_NAMES = Object.freeze(
  Object.keys(BUDGETS_NFE_ATTEMPTS_COLUMNS)
);


// ──────────────────────────────────────────────────────────────────────
// 4. SELECT COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_SELECT_COLUMNS = Object.freeze([
  'attempt_id',
  'budget_id',
  'invoice_id',
  'attempt_number',
  'nfe_status_id',

  'nfe_number',
  'nfe_series',
  'nfe_environment',

  'operation_type_id',

  'customer_id',
  'customer_name',
  'customer_tax_id',
  'customer_email',
  'customer_phone',

  'issue_date',

  'subtotal',
  'discount_total',
  'freight_value',
  'total_amount',

  'provider_id',
  'integration_id',
  'access_key',
  'protocol',

  'request_payload',
  'provider_response',
  'generated_xml',

  'error_code',
  'error_message',

  'requested_by',
  'requested_at',

  'authorized_at',
  'rejected_at',
  'last_checked_at',

  'created_at',
  'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 5. INSERTABLE COLUMNS
//
// Excluded:
// - attempt_id   -> sequence-generated
// - requested_at -> now()
// - created_at   -> now()
// - updated_at   -> now()
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS = Object.freeze([
  'budget_id',
  'invoice_id',
  'attempt_number',
  'nfe_status_id',

  'nfe_number',
  'nfe_series',
  'nfe_environment',

  'operation_type_id',

  'customer_id',
  'customer_name',
  'customer_tax_id',
  'customer_email',
  'customer_phone',

  'issue_date',

  'subtotal',
  'discount_total',
  'freight_value',
  'total_amount',

  'provider_id',
  'integration_id',
  'access_key',
  'protocol',

  'request_payload',
  'provider_response',
  'generated_xml',

  'error_code',
  'error_message',

  'requested_by',

  'authorized_at',
  'rejected_at',
  'last_checked_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 6. UPDATABLE COLUMNS
//
// attempt_id and created_at must never be changed.
// requested_at is the original request timestamp.
// updated_at should preferably be handled automatically if a trigger
// exists; otherwise the API may update it explicitly.
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS = Object.freeze([
  'budget_id',
  'invoice_id',
  'attempt_number',
  'nfe_status_id',

  'nfe_number',
  'nfe_series',
  'nfe_environment',

  'operation_type_id',

  'customer_id',
  'customer_name',
  'customer_tax_id',
  'customer_email',
  'customer_phone',

  'issue_date',

  'subtotal',
  'discount_total',
  'freight_value',
  'total_amount',

  'provider_id',
  'integration_id',
  'access_key',
  'protocol',

  'request_payload',
  'provider_response',
  'generated_xml',

  'error_code',
  'error_message',

  'requested_by',

  'authorized_at',
  'rejected_at',
  'last_checked_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 7. NOT NULL DATABASE COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_NOT_NULL_COLUMNS = Object.freeze([
  'attempt_id',
  'budget_id',
  'attempt_number',
  'nfe_status_id',

  'subtotal',
  'discount_total',
  'freight_value',
  'total_amount',

  'requested_at',
  'created_at',
  'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 8. API REQUIRED COLUMNS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_API_REQUIRED_COLUMNS = Object.freeze([
  'budget_id',
  'nfe_status_id',
]);


// ──────────────────────────────────────────────────────────────────────
// 9. DATABASE DEFAULTS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_DEFAULTS = Object.freeze({
  attempt_number: 1,

  subtotal: 0,
  discount_total: 0,
  freight_value: 0,
  total_amount: 0,

  requested_at: 'now()',
  created_at: 'now()',
  updated_at: 'now()',
});


// ──────────────────────────────────────────────────────────────────────
// 10. FOREIGN KEYS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_FOREIGN_KEYS = Object.freeze({

  budget_id: {
    constraint: 'fk_budget_nfe_attempt_budget',

    column: 'budget_id',

    references: {
      schema: 'public',
      table: 'budgets',
      column: 'budget_id',
    },

    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  },


  invoice_id: {
    constraint: 'fk_budget_nfe_attempt_invoice',

    column: 'invoice_id',

    references: {
      schema: 'public',
      table: 'invoicesIssued',
      column: 'invoice_id',
    },

    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },


  operation_type_id: {
    constraint: 'fk_budget_nfe_attempt_operation',

    column: 'operation_type_id',

    references: {
      schema: 'public',
      table: 'nfeOperationTypes',
      column: 'operation_type_id',
    },

    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  },


  nfe_status_id: {
    constraint: 'fk_budget_nfe_attempt_status',

    column: 'nfe_status_id',

    references: {
      schema: 'public',
      table: 'nfeStatusMap',
      column: 'nfe_status_id',
    },

    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  },
});


// ──────────────────────────────────────────────────────────────────────
// 11. INDEXES / UNIQUE CONSTRAINTS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_INDEXES = Object.freeze({

  budgetsNfeAttempts_pkey: {
    columns: ['attempt_id'],
    primaryKey: true,
    unique: true,
  },


  ix_budget_nfe_attempt_budget: {
    columns: ['budget_id'],
  },


  ix_budget_nfe_attempt_invoice: {
    columns: ['invoice_id'],
  },


  ix_budget_nfe_attempt_operation: {
    columns: ['operation_type_id'],
  },


  ix_budget_nfe_attempt_requested_at: {
    columns: ['requested_at'],
    order: 'DESC',
  },


  ix_budget_nfe_attempt_status: {
    columns: ['nfe_status_id'],
  },


  uq_budget_nfe_attempt_number: {
    columns: [
      'budget_id',
      'attempt_number',
    ],

    unique: true,
    constraint: true,
  },


  ux_budget_nfe_attempt_access_key: {
    columns: ['access_key'],

    unique: true,

    where:
      `access_key IS NOT NULL AND btrim(access_key::text) <> ''::text`,
  },


  ux_budget_nfe_attempt_provider: {
    columns: ['provider_id'],

    unique: true,

    where:
      `provider_id IS NOT NULL AND btrim(provider_id::text) <> ''::text`,
  },
});


// ──────────────────────────────────────────────────────────────────────
// 12. REFERENCED-BY TABLES
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_REFERENCED_BY = Object.freeze([

  {
    schema: 'public',

    table: 'budgetsNfeAttemptItems',

    foreignKey: 'attempt_id',

    references: 'attempt_id',

    constraint: 'fk_budgetsNfeAttemptItems_attempt',

    onUpdate: 'CASCADE',

    onDelete: 'CASCADE',
  },
]);


// ──────────────────────────────────────────────────────────────────────
// 13. COLUMN GROUPS
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_NFE_COLUMNS = Object.freeze([
  'nfe_status_id',
  'nfe_number',
  'nfe_series',
  'nfe_environment',
  'provider_id',
  'integration_id',
  'access_key',
  'protocol',
]);


export const BUDGETS_NFE_ATTEMPTS_CUSTOMER_COLUMNS = Object.freeze([
  'customer_id',
  'customer_name',
  'customer_tax_id',
  'customer_email',
  'customer_phone',
]);


export const BUDGETS_NFE_ATTEMPTS_TOTAL_COLUMNS = Object.freeze([
  'subtotal',
  'discount_total',
  'freight_value',
  'total_amount',
]);


export const BUDGETS_NFE_ATTEMPTS_PAYLOAD_COLUMNS = Object.freeze([
  'request_payload',
  'provider_response',
  'generated_xml',
]);


export const BUDGETS_NFE_ATTEMPTS_ERROR_COLUMNS = Object.freeze([
  'error_code',
  'error_message',
]);


export const BUDGETS_NFE_ATTEMPTS_AUDIT_COLUMNS = Object.freeze([
  'requested_by',
  'requested_at',
  'authorized_at',
  'rejected_at',
  'last_checked_at',
  'created_at',
  'updated_at',
]);


// ──────────────────────────────────────────────────────────────────────
// 14. SELECT SQL
// ──────────────────────────────────────────────────────────────────────

export const BUDGETS_NFE_ATTEMPTS_SELECT_SQL =
  BUDGETS_NFE_ATTEMPTS_SELECT_COLUMNS
    .map((column) => `a."${column}"`)
    .join(',\n');


// ──────────────────────────────────────────────────────────────────────
// 15. HELPERS
// ──────────────────────────────────────────────────────────────────────

export function isBudgetsNfeAttemptsColumn(column) {
  return Object.prototype.hasOwnProperty.call(
    BUDGETS_NFE_ATTEMPTS_COLUMNS,
    String(column || '')
  );
}


export function isBudgetsNfeAttemptsInsertColumn(column) {
  return BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS.includes(
    String(column || '')
  );
}


export function isBudgetsNfeAttemptsUpdateColumn(column) {
  return BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS.includes(
    String(column || '')
  );
}


export function getBudgetsNfeAttemptsColumnDefinition(column) {
  return (
    BUDGETS_NFE_ATTEMPTS_COLUMNS[
      String(column || '')
    ] || null
  );
}


// ──────────────────────────────────────────────────────────────────────
// 16. OBJECT HELPERS
// ──────────────────────────────────────────────────────────────────────

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}


function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}


// ──────────────────────────────────────────────────────────────────────
// 17. INSERT PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickBudgetsNfeAttemptsInsertPayload(payload = {}) {

  if (!isPlainObject(payload)) {
    return {};
  }

  const output = {};

  for (const column of BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS) {
    if (!hasOwn(payload, column)) {
      continue;
    }

    output[column] = payload[column];
  }

  return output;
}


// ──────────────────────────────────────────────────────────────────────
// 18. UPDATE PAYLOAD SANITIZER
// ──────────────────────────────────────────────────────────────────────

export function pickBudgetsNfeAttemptsUpdatePayload(payload = {}) {

  if (!isPlainObject(payload)) {
    return {};
  }

  const output = {};

  for (const column of BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS) {
    if (!hasOwn(payload, column)) {
      continue;
    }

    output[column] = payload[column];
  }

  return output;
}


// ──────────────────────────────────────────────────────────────────────
// 19. REQUIRED FIELDS VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetsNfeAttemptsRequiredFields(
  payload = {}
) {

  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      valid: false,

      errors: [
        {
          field: null,
          message:
            'Payload de tentativa de NF-e inválido.',
        },
      ],
    };
  }

  for (
    const column
    of BUDGETS_NFE_ATTEMPTS_API_REQUIRED_COLUMNS
  ) {
    const value = payload[column];

    if (
      value === undefined ||
      value === null ||
      (
        typeof value === 'string' &&
        value.trim() === ''
      )
    ) {
      errors.push({
        field: column,

        message:
          `Campo obrigatório: ${column}.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


// ──────────────────────────────────────────────────────────────────────
// 20. NUMERIC VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetsNfeAttemptsNumericValues(
  payload = {}
) {

  const errors = [];

  const nonNegativeColumns = [
    'subtotal',
    'discount_total',
    'freight_value',
    'total_amount',
  ];

  for (const column of nonNegativeColumns) {

    if (!hasOwn(payload, column)) {
      continue;
    }

    const raw = payload[column];

    if (
      raw === null ||
      raw === undefined ||
      raw === ''
    ) {
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      errors.push({
        field: column,

        message:
          `O campo ${column} precisa ser um número válido.`,
      });

      continue;
    }

    if (value < 0) {
      errors.push({
        field: column,

        message:
          `O campo ${column} não pode ser negativo.`,
      });
    }
  }

  if (
    hasOwn(payload, 'attempt_number') &&
    payload.attempt_number !== null &&
    payload.attempt_number !== undefined &&
    payload.attempt_number !== ''
  ) {
    const attemptNumber =
      Number(payload.attempt_number);

    if (
      !Number.isSafeInteger(attemptNumber) ||
      attemptNumber <= 0
    ) {
      errors.push({
        field: 'attempt_number',

        message:
          'attempt_number deve ser um inteiro positivo.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


// ──────────────────────────────────────────────────────────────────────
// 21. PAYLOAD VALIDATION
// ──────────────────────────────────────────────────────────────────────

export function validateBudgetsNfeAttemptsPayload(
  payload = {},
  options = {}
) {

  const {
    requireRequiredFields = true,
  } = options;

  const errors = [];

  if (!isPlainObject(payload)) {
    return {
      valid: false,

      errors: [
        {
          field: null,
          message:
            'Payload de tentativa de NF-e inválido.',
        },
      ],
    };
  }

  if (requireRequiredFields) {
    const required =
      validateBudgetsNfeAttemptsRequiredFields(
        payload
      );

    errors.push(...required.errors);
  }

  const numeric =
    validateBudgetsNfeAttemptsNumericValues(
      payload
    );

  errors.push(...numeric.errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}


// ──────────────────────────────────────────────────────────────────────
// 22. PREPARE INSERT
// ──────────────────────────────────────────────────────────────────────

export function prepareBudgetsNfeAttemptsInsert(
  payload = {}
) {

  const data =
    pickBudgetsNfeAttemptsInsertPayload(
      payload
    );

  const validation =
    validateBudgetsNfeAttemptsPayload(
      data,
      {
        requireRequiredFields: true,
      }
    );

  return {
    data,
    ...validation,
  };
}


// ──────────────────────────────────────────────────────────────────────
// 23. PREPARE UPDATE
// ──────────────────────────────────────────────────────────────────────

export function prepareBudgetsNfeAttemptsUpdate(
  payload = {}
) {

  const data =
    pickBudgetsNfeAttemptsUpdatePayload(
      payload
    );

  const validation =
    validateBudgetsNfeAttemptsPayload(
      data,
      {
        requireRequiredFields: false,
      }
    );

  return {
    data,
    ...validation,
  };
}


// ──────────────────────────────────────────────────────────────────────
// 24. DEFAULT EXPORT
// ──────────────────────────────────────────────────────────────────────

const budgetsNfeAttemptsSchema = Object.freeze({

  schema:
    BUDGETS_NFE_ATTEMPTS_SCHEMA_NAME,

  table:
    BUDGETS_NFE_ATTEMPTS_TABLE_NAME,

  qualifiedTable:
    BUDGETS_NFE_ATTEMPTS_TABLE,

  primaryKey:
    BUDGETS_NFE_ATTEMPTS_PRIMARY_KEY,


  columns:
    BUDGETS_NFE_ATTEMPTS_COLUMNS,

  columnNames:
    BUDGETS_NFE_ATTEMPTS_COLUMN_NAMES,

  selectColumns:
    BUDGETS_NFE_ATTEMPTS_SELECT_COLUMNS,

  selectSql:
    BUDGETS_NFE_ATTEMPTS_SELECT_SQL,

  insertColumns:
    BUDGETS_NFE_ATTEMPTS_INSERT_COLUMNS,

  updateColumns:
    BUDGETS_NFE_ATTEMPTS_UPDATE_COLUMNS,

  notNullColumns:
    BUDGETS_NFE_ATTEMPTS_NOT_NULL_COLUMNS,

  apiRequiredColumns:
    BUDGETS_NFE_ATTEMPTS_API_REQUIRED_COLUMNS,


  defaults:
    BUDGETS_NFE_ATTEMPTS_DEFAULTS,


  foreignKeys:
    BUDGETS_NFE_ATTEMPTS_FOREIGN_KEYS,

  indexes:
    BUDGETS_NFE_ATTEMPTS_INDEXES,

  referencedBy:
    BUDGETS_NFE_ATTEMPTS_REFERENCED_BY,


  groups: {

    nfe:
      BUDGETS_NFE_ATTEMPTS_NFE_COLUMNS,

    customer:
      BUDGETS_NFE_ATTEMPTS_CUSTOMER_COLUMNS,

    totals:
      BUDGETS_NFE_ATTEMPTS_TOTAL_COLUMNS,

    payload:
      BUDGETS_NFE_ATTEMPTS_PAYLOAD_COLUMNS,

    errors:
      BUDGETS_NFE_ATTEMPTS_ERROR_COLUMNS,

    audit:
      BUDGETS_NFE_ATTEMPTS_AUDIT_COLUMNS,
  },


  helpers: {

    isColumn:
      isBudgetsNfeAttemptsColumn,

    isInsertColumn:
      isBudgetsNfeAttemptsInsertColumn,

    isUpdateColumn:
      isBudgetsNfeAttemptsUpdateColumn,

    getColumnDefinition:
      getBudgetsNfeAttemptsColumnDefinition,

    pickInsertPayload:
      pickBudgetsNfeAttemptsInsertPayload,

    pickUpdatePayload:
      pickBudgetsNfeAttemptsUpdatePayload,

    validateRequiredFields:
      validateBudgetsNfeAttemptsRequiredFields,

    validateNumericValues:
      validateBudgetsNfeAttemptsNumericValues,

    validatePayload:
      validateBudgetsNfeAttemptsPayload,

    prepareInsert:
      prepareBudgetsNfeAttemptsInsert,

    prepareUpdate:
      prepareBudgetsNfeAttemptsUpdate,
  },
});


export default budgetsNfeAttemptsSchema;