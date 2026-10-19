// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.invoicesIssued.js — PostgreSQL schema catalog        ║
// ║ CONSART ERP | Table: public."invoicesIssued"                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ======================================================================
// 1. TABLE
// ======================================================================

export const INVOICES_ISSUED_SCHEMA_NAME = 'public';

export const INVOICES_ISSUED_TABLE_NAME = 'invoicesIssued';

export const INVOICES_ISSUED_TABLE =
    `${INVOICES_ISSUED_SCHEMA_NAME}."${INVOICES_ISSUED_TABLE_NAME}"`;

export const INVOICES_ISSUED_PRIMARY_KEY = 'invoice_id';

export const INVOICES_ISSUED_SEQUENCE =
    '"invoicesIssued_invoice_id_seq"';


// ======================================================================
// 2. COLUMNS
// ======================================================================

export const INVOICES_ISSUED_COLUMNS = Object.freeze({

    invoice_id: {
        name: 'invoice_id',
        type: 'bigint',
        nullable: false,
        primaryKey: true,
        sequence: INVOICES_ISSUED_SEQUENCE,
        databaseManaged: true,
        default:
            `nextval('${INVOICES_ISSUED_SEQUENCE}'::regclass)`,
    },

    order_id: {
        name: 'order_id',
        type: 'bigint',
        nullable: true,
    },

    nfe_number: {
        name: 'nfe_number',
        type: 'bigint',
        nullable: true,
    },

    nfe_key: {
        name: 'nfe_key',
        type: 'varchar',
        length: 44,
        nullable: true,
    },

    nfe_status: {
        name: 'nfe_status',
        type: 'varchar',
        length: 20,
        nullable: true,
    },

    nfe_protocol: {
        name: 'nfe_protocol',
        type: 'varchar',
        length: 80,
        nullable: true,
    },

    nfe_environment: {
        name: 'nfe_environment',
        type: 'varchar',
        length: 20,
        nullable: true,
    },

    xml_url: {
        name: 'xml_url',
        type: 'text',
        nullable: true,
    },

    danfe_url: {
        name: 'danfe_url',
        type: 'text',
        nullable: true,
    },

    issued_at: {
        name: 'issued_at',
        type: 'timestamptz',
        nullable: true,
    },

    issued_date: {
        name: 'issued_date',
        type: 'date',
        nullable: true,
    },

    cancelled_at: {
        name: 'cancelled_at',
        type: 'timestamptz',
        nullable: true,
    },

    cancellation_reason: {
        name: 'cancellation_reason',
        type: 'text',
        nullable: true,
    },

    total_amount: {
        name: 'total_amount',
        type: 'numeric',
        precision: 14,
        scale: 2,
        nullable: true,
    },

    created_at: {
        name: 'created_at',
        type: 'timestamptz',
        nullable: true,
        databaseManaged: true,
        default: 'now()',
    },

    updated_at: {
        name: 'updated_at',
        type: 'timestamptz',
        nullable: true,
        databaseManaged: true,
        default: 'now()',
    },

    nfe_provider_id: {
        name: 'nfe_provider_id',
        type: 'varchar',
        length: 120,
        nullable: true,
    },

    nfe_retry_count: {
        name: 'nfe_retry_count',
        type: 'integer',
        nullable: false,
        default: 0,
    },

    budget_id: {
        name: 'budget_id',
        type: 'bigint',
        nullable: true,
    },

    source_type: {
        name: 'source_type',
        type: 'varchar',
        length: 20,
        nullable: false,
        default: 'ORDER',
    },

    customer_name: {
        name: 'customer_name',
        type: 'varchar',
        length: 240,
        nullable: true,
    },

    customer_tax_id: {
        name: 'customer_tax_id',
        type: 'varchar',
        length: 30,
        nullable: true,
    },

    customer_email: {
        name: 'customer_email',
        type: 'varchar',
        length: 180,
        nullable: true,
    },

    bonus_id: {
        name: 'bonus_id',
        type: 'bigint',
        nullable: true,
    },

    nfe_status_id: {
        name: 'nfe_status_id',
        type: 'integer',
        nullable: true,
    },
});


// ======================================================================
// 3. COLUMN NAMES
// ======================================================================

export const INVOICES_ISSUED_COLUMN_NAMES =
    Object.freeze(
        Object.keys(INVOICES_ISSUED_COLUMNS)
    );


// ======================================================================
// 4. SELECT COLUMNS
// ======================================================================

export const INVOICES_ISSUED_SELECT_COLUMNS =
    Object.freeze([
        ...INVOICES_ISSUED_COLUMN_NAMES,
    ]);


// ======================================================================
// 5. INSERT COLUMNS
//
// DB-managed:
// - invoice_id
// - created_at
// - updated_at
// ======================================================================

export const INVOICES_ISSUED_INSERT_COLUMNS =
    Object.freeze(
        INVOICES_ISSUED_COLUMN_NAMES.filter(
            (column) =>
                ![
                    'invoice_id',
                    'created_at',
                    'updated_at',
                ].includes(column)
        )
    );


// ======================================================================
// 6. UPDATE COLUMNS
//
// invoice_id and created_at are immutable.
//
// updated_at is deliberately excluded because the DAL should control
// it with updated_at = NOW() when modifying invoicesIssued.
// ======================================================================

export const INVOICES_ISSUED_UPDATE_COLUMNS =
    Object.freeze(
        INVOICES_ISSUED_COLUMN_NAMES.filter(
            (column) =>
                ![
                    'invoice_id',
                    'created_at',
                    'updated_at',
                ].includes(column)
        )
    );


// ======================================================================
// 7. NOT NULL
// ======================================================================

export const INVOICES_ISSUED_NOT_NULL_COLUMNS =
    Object.freeze([
        'invoice_id',
        'nfe_retry_count',
        'source_type',
    ]);


// ======================================================================
// 8. DEFAULTS
// ======================================================================

export const INVOICES_ISSUED_DEFAULTS =
    Object.freeze({

        nfe_retry_count: 0,

        source_type: 'ORDER',

        created_at: 'now()',

        updated_at: 'now()',
    });


// ======================================================================
// 9. NUMERIC COLUMNS
// ======================================================================

export const INVOICES_ISSUED_NUMERIC_COLUMNS =
    Object.freeze([
        'invoice_id',
        'order_id',
        'nfe_number',
        'total_amount',
        'nfe_retry_count',
        'budget_id',
        'bonus_id',
        'nfe_status_id',
    ]);


// ======================================================================
// 10. SOURCE COLUMNS
// ======================================================================

export const INVOICES_ISSUED_SOURCE_COLUMNS =
    Object.freeze([
        'source_type',
        'order_id',
        'budget_id',
        'bonus_id',
    ]);


// ======================================================================
// 11. NF-e COLUMNS
// ======================================================================

export const INVOICES_ISSUED_NFE_COLUMNS =
    Object.freeze([
        'nfe_number',
        'nfe_key',
        'nfe_status',
        'nfe_status_id',
        'nfe_protocol',
        'nfe_environment',
        'nfe_provider_id',
        'nfe_retry_count',
    ]);


// ======================================================================
// 12. CUSTOMER SNAPSHOT
// ======================================================================

export const INVOICES_ISSUED_CUSTOMER_COLUMNS =
    Object.freeze([
        'customer_name',
        'customer_tax_id',
        'customer_email',
    ]);


// ======================================================================
// 13. DOCUMENT COLUMNS
// ======================================================================

export const INVOICES_ISSUED_DOCUMENT_COLUMNS =
    Object.freeze([
        'xml_url',
        'danfe_url',
    ]);


// ======================================================================
// 14. DATE / AUDIT COLUMNS
// ======================================================================

export const INVOICES_ISSUED_DATE_COLUMNS =
    Object.freeze([
        'issued_at',
        'issued_date',
        'cancelled_at',
        'created_at',
        'updated_at',
    ]);


// ======================================================================
// 15. FOREIGN KEYS
// ======================================================================

export const INVOICES_ISSUED_FOREIGN_KEYS =
    Object.freeze({

        nfe_status_id: {
            constraint:
                'fk_invoices_issued_nfe_status',

            column:
                'nfe_status_id',

            references: {
                schema: 'public',
                table: 'nfeStatusMap',
                column: 'nfe_status_id',
            },

            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
        },


        bonus_id: {
            constraint:
                'invoicesIssued_bonus_id_fkey',

            column:
                'bonus_id',

            references: {
                schema: 'public',
                table: 'nfeBonus',
                column: 'bonus_id',
            },

            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },


        order_id: {
            constraint:
                'invoicesIssued_order_id_fkey',

            column:
                'order_id',

            references: {
                schema: 'public',
                table: 'orders',
                column: 'order_id',
            },

            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
        },
    });


// ======================================================================
// 16. REFERENCED BY
// ======================================================================

export const INVOICES_ISSUED_REFERENCED_BY =
    Object.freeze({

        budgetsNfeAttempts: {
            constraint:
                'fk_budget_nfe_attempt_invoice',

            table:
                'budgetsNfeAttempts',

            column:
                'invoice_id',

            referencesColumn:
                'invoice_id',

            onUpdate:
                'CASCADE',

            onDelete:
                'SET NULL',
        },


        salesCommissionsFromInvoices: {
            constraint:
                'fk_sci_invoice',

            table:
                'salesCommissionsFromInvoices',

            column:
                'invoice_id',

            referencesColumn:
                'invoice_id',

            onUpdate:
                'NO ACTION',

            onDelete:
                'CASCADE',
        },


        nfeReceipts: {
            constraint:
                'nfeReceipts_nfe_id_fkey',

            table:
                'nfeReceipts',

            column:
                'nfe_id',

            referencesColumn:
                'invoice_id',

            onUpdate:
                'NO ACTION',

            onDelete:
                'CASCADE',
        },


        usoConsumo: {
            constraint:
                'usoConsumo_invoice_id_fkey',

            table:
                'usoConsumo',

            column:
                'invoice_id',

            referencesColumn:
                'invoice_id',

            onUpdate:
                'CASCADE',

            onDelete:
                'SET NULL',
        },
    });


// ======================================================================
// 17. INDEXES
// ======================================================================

export const INVOICES_ISSUED_INDEXES =
    Object.freeze({

        invoicesIssued_pkey: {
            columns: ['invoice_id'],
            primaryKey: true,
            unique: true,
        },


        idx_invoices_issued_customer_email: {
            columns: ['customer_email'],
        },


        idx_invoices_issued_date: {
            columns: ['issued_date'],
        },


        idx_invoices_issued_nfe_key: {
            columns: ['nfe_key'],
        },


        idx_invoices_issued_nfe_number: {
            columns: ['nfe_number'],
        },


        idx_invoices_issued_nfe_status_id: {
            columns: ['nfe_status_id'],
        },


        idx_invoices_issued_order_id: {
            columns: ['order_id'],
        },


        idx_invoices_issued_status: {
            columns: ['nfe_status'],
        },


        ux_invoicesIssued_provider_id: {
            columns: ['nfe_provider_id'],
            unique: true,

            where:
                `nfe_provider_id IS NOT NULL AND nfe_provider_id::text <> ''::text`,
        },


        ux_invoices_issued_bonus_id: {
            columns: ['bonus_id'],
            unique: true,

            where:
                'bonus_id IS NOT NULL',
        },


        ux_invoices_issued_budget_id: {
            columns: ['budget_id'],
            unique: true,

            where:
                'budget_id IS NOT NULL',
        },


        ux_invoices_issued_nfe_key: {
            columns: ['nfe_key'],
            unique: true,

            where:
                `nfe_key IS NOT NULL AND nfe_key::text <> ''::text`,
        },


        ux_invoices_issued_order_id: {
            columns: ['order_id'],
            unique: true,
        },


        ux_invoices_issued_order_nfe_number: {
            columns: [
                'order_id',
                'nfe_number',
            ],

            unique: true,

            where:
                'order_id IS NOT NULL AND nfe_number IS NOT NULL',
        },
    });


// ======================================================================
// 18. SELECT SQL
// ======================================================================

export const INVOICES_ISSUED_SELECT_SQL =
    INVOICES_ISSUED_SELECT_COLUMNS
        .map((column) => `ii."${column}"`)
        .join(',\n');


// ======================================================================
// 19. HELPERS
// ======================================================================

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


export function isInvoicesIssuedColumn(column) {

    return Object.prototype.hasOwnProperty.call(
        INVOICES_ISSUED_COLUMNS,
        String(column || '')
    );
}


export function isInvoicesIssuedInsertColumn(column) {

    return INVOICES_ISSUED_INSERT_COLUMNS.includes(
        String(column || '')
    );
}


export function isInvoicesIssuedUpdateColumn(column) {

    return INVOICES_ISSUED_UPDATE_COLUMNS.includes(
        String(column || '')
    );
}


export function getInvoicesIssuedColumnDefinition(column) {

    return (
        INVOICES_ISSUED_COLUMNS[
        String(column || '')
        ] ||
        null
    );
}


// ======================================================================
// 20. PAYLOAD PICKERS
// ======================================================================

export function pickInvoicesIssuedInsertPayload(
    payload = {}
) {

    if (!isPlainObject(payload)) {
        return {};
    }


    const output = {};


    for (
        const column
        of INVOICES_ISSUED_INSERT_COLUMNS
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        output[column] =
            payload[column];
    }


    return output;
}


export function pickInvoicesIssuedUpdatePayload(
    payload = {}
) {

    if (!isPlainObject(payload)) {
        return {};
    }


    const output = {};


    for (
        const column
        of INVOICES_ISSUED_UPDATE_COLUMNS
    ) {

        if (!hasOwn(payload, column)) {
            continue;
        }


        output[column] =
            payload[column];
    }


    return output;
}


// ======================================================================
// 21. VALIDATION
// ======================================================================

export function validateInvoicesIssuedPayload(
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
                        'Payload de NF-e emitida inválido.',
                },
            ],
        };
    }


    if (
        hasOwn(payload, 'invoice_id')
    ) {

        const value =
            Number(payload.invoice_id);


        if (
            !Number.isSafeInteger(value) ||
            value <= 0
        ) {

            errors.push({
                field: 'invoice_id',
                message:
                    'invoice_id deve ser um inteiro positivo.',
            });
        }
    }


    for (
        const column
        of [
            'order_id',
            'budget_id',
            'bonus_id',
            'nfe_number',
            'nfe_status_id',
        ]
    ) {

        if (
            !hasOwn(payload, column) ||
            payload[column] === null ||
            payload[column] === undefined ||
            payload[column] === ''
        ) {
            continue;
        }


        const value =
            Number(payload[column]);


        if (
            !Number.isSafeInteger(value) ||
            value <= 0
        ) {

            errors.push({
                field: column,
                message:
                    `${column} deve ser um inteiro positivo ou nulo.`,
            });
        }
    }


    if (
        hasOwn(payload, 'nfe_retry_count')
    ) {

        const value =
            Number(payload.nfe_retry_count);


        if (
            !Number.isSafeInteger(value) ||
            value < 0
        ) {

            errors.push({
                field:
                    'nfe_retry_count',

                message:
                    'nfe_retry_count deve ser um inteiro maior ou igual a zero.',
            });
        }
    }


    if (
        hasOwn(payload, 'total_amount') &&
        payload.total_amount !== null &&
        payload.total_amount !== undefined &&
        payload.total_amount !== ''
    ) {

        const value =
            Number(payload.total_amount);


        if (!Number.isFinite(value)) {

            errors.push({
                field:
                    'total_amount',

                message:
                    'total_amount deve ser um número válido.',
            });
        }
    }


    if (
        hasOwn(payload, 'nfe_key') &&
        payload.nfe_key !== null &&
        payload.nfe_key !== undefined &&
        String(payload.nfe_key).length > 44
    ) {

        errors.push({
            field:
                'nfe_key',

            message:
                'nfe_key não pode possuir mais de 44 caracteres.',
        });
    }


    if (
        hasOwn(payload, 'source_type') &&
        (
            payload.source_type === null ||
            payload.source_type === undefined ||
            String(payload.source_type).trim() === ''
        )
    ) {

        errors.push({
            field:
                'source_type',

            message:
                'source_type não pode ser vazio.',
        });
    }


    return {
        valid:
            errors.length === 0,

        errors,
    };
}


// ======================================================================
// 22. PREPARE INSERT
// ======================================================================

export function prepareInvoicesIssuedInsert(
    payload = {}
) {

    const data =
        pickInvoicesIssuedInsertPayload(
            payload
        );


    const validation =
        validateInvoicesIssuedPayload(
            data
        );


    return {
        data,
        ...validation,
    };
}


// ======================================================================
// 23. PREPARE UPDATE
// ======================================================================

export function prepareInvoicesIssuedUpdate(
    payload = {}
) {

    const data =
        pickInvoicesIssuedUpdatePayload(
            payload
        );


    const validation =
        validateInvoicesIssuedPayload(
            data
        );


    return {
        data,
        ...validation,
    };
}


// ======================================================================
// 24. DEFAULT EXPORT
// ======================================================================

const invoicesIssuedSchema =
    Object.freeze({

        schema:
            INVOICES_ISSUED_SCHEMA_NAME,

        table:
            INVOICES_ISSUED_TABLE_NAME,

        qualifiedTable:
            INVOICES_ISSUED_TABLE,

        primaryKey:
            INVOICES_ISSUED_PRIMARY_KEY,

        sequence:
            INVOICES_ISSUED_SEQUENCE,


        columns:
            INVOICES_ISSUED_COLUMNS,

        columnNames:
            INVOICES_ISSUED_COLUMN_NAMES,

        selectColumns:
            INVOICES_ISSUED_SELECT_COLUMNS,

        selectSql:
            INVOICES_ISSUED_SELECT_SQL,

        insertColumns:
            INVOICES_ISSUED_INSERT_COLUMNS,

        updateColumns:
            INVOICES_ISSUED_UPDATE_COLUMNS,

        notNullColumns:
            INVOICES_ISSUED_NOT_NULL_COLUMNS,

        defaults:
            INVOICES_ISSUED_DEFAULTS,


        numericColumns:
            INVOICES_ISSUED_NUMERIC_COLUMNS,

        sourceColumns:
            INVOICES_ISSUED_SOURCE_COLUMNS,

        nfeColumns:
            INVOICES_ISSUED_NFE_COLUMNS,

        customerColumns:
            INVOICES_ISSUED_CUSTOMER_COLUMNS,

        documentColumns:
            INVOICES_ISSUED_DOCUMENT_COLUMNS,

        dateColumns:
            INVOICES_ISSUED_DATE_COLUMNS,


        foreignKeys:
            INVOICES_ISSUED_FOREIGN_KEYS,

        referencedBy:
            INVOICES_ISSUED_REFERENCED_BY,

        indexes:
            INVOICES_ISSUED_INDEXES,


        helpers: {

            isColumn:
                isInvoicesIssuedColumn,

            isInsertColumn:
                isInvoicesIssuedInsertColumn,

            isUpdateColumn:
                isInvoicesIssuedUpdateColumn,

            getColumnDefinition:
                getInvoicesIssuedColumnDefinition,

            pickInsertPayload:
                pickInvoicesIssuedInsertPayload,

            pickUpdatePayload:
                pickInvoicesIssuedUpdatePayload,

            validatePayload:
                validateInvoicesIssuedPayload,

            prepareInsert:
                prepareInvoicesIssuedInsert,

            prepareUpdate:
                prepareInvoicesIssuedUpdate,
        },
    });


export default invoicesIssuedSchema;