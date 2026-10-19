/**
 * Catalog schema: public."chartOfAccounts"
 *
 * Mirrors the PostgreSQL definition of the "chartOfAccounts" table,
 * including columns, indexes, check constraints, foreign keys, triggers
 * and the tables that reference it.
 *
 * The table name is case-sensitive: always quote it in SQL ("chartOfAccounts").
 * Column defaults given as strings are raw SQL expressions.
 * readOnly columns are filled by the database and never written by the API.
 */

const chartOfAccounts = {
    schema: 'public',
    table: 'chartOfAccounts',
    primaryKey: 'id',

    columns: {
        id: {
            type: 'integer',
            nullable: false,
            default: `nextval('"chartOfAccounts_id_seq"'::regclass)`,
            autoIncrement: true,
            readOnly: true,
            sequence: 'chartOfAccounts_id_seq',
        },
        code: {
            type: 'character varying',
            length: 30,
            nullable: false,
            default: null,
            unique: true,
        },
        description: {
            type: 'character varying',
            length: 200,
            nullable: false,
            default: null,
        },
        account_type: {
            type: 'character varying',
            length: 20,
            nullable: false,
            default: null,
            enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], // chk_chartofaccounts_type
        },
        nature: {
            type: 'character varying',
            length: 10,
            nullable: false,
            default: null,
            enum: ['DEBIT', 'CREDIT'], // chk_chartofaccounts_nature
        },
        level: {
            type: 'integer',
            nullable: false,
            default: 1,
            min: 1, // chk_chartofaccounts_level
        },
        parent_account_id: {
            type: 'integer',
            nullable: true,
            default: null,
            references: { table: 'chartOfAccounts', column: 'id' }, // fk_chartofaccounts_parent
        },
        allows_posting: {
            type: 'boolean',
            nullable: false,
            default: true,
        },
        is_active: {
            type: 'boolean',
            nullable: false,
            default: true,
        },
        notes: {
            type: 'text',
            nullable: true,
            default: null,
        },
        created_at: {
            type: 'timestamp without time zone',
            nullable: false,
            default: 'now()',
            readOnly: true,
        },
        updated_at: {
            type: 'timestamp without time zone',
            nullable: false,
            default: 'now()',
            readOnly: true, // maintained by trigger trg_chartofaccounts_updated_at
        },
    },

    indexes: [
        {
            name: 'chartOfAccounts_pkey',
            type: 'btree',
            primary: true,
            unique: true,
            constraint: true,
            columns: ['id'],
        },
        {
            name: 'chartOfAccounts_code_key',
            type: 'btree',
            unique: true,
            constraint: true,
            columns: ['code'],
        },
        {
            name: 'idx_chartofaccounts_active',
            type: 'btree',
            unique: false,
            constraint: false,
            columns: ['is_active'],
        },
        {
            name: 'idx_chartofaccounts_code',
            type: 'btree',
            unique: false,
            constraint: false,
            columns: ['code'],
        },
        {
            name: 'idx_chartofaccounts_description',
            type: 'btree',
            unique: false,
            constraint: false,
            columns: ['description'],
        },
        {
            name: 'idx_chartofaccounts_parent',
            type: 'btree',
            unique: false,
            constraint: false,
            columns: ['parent_account_id'],
        },
        {
            name: 'idx_chartofaccounts_type',
            type: 'btree',
            unique: false,
            constraint: false,
            columns: ['account_type'],
        },
    ],

    // Expressions are equivalent to PostgreSQL's "= ANY (ARRAY[...])" form
    checks: [
        {
            name: 'chk_chartofaccounts_level',
            column: 'level',
            expression: 'level >= 1',
        },
        {
            name: 'chk_chartofaccounts_nature',
            column: 'nature',
            expression: "nature IN ('DEBIT', 'CREDIT')",
            values: ['DEBIT', 'CREDIT'],
        },
        {
            name: 'chk_chartofaccounts_type',
            column: 'account_type',
            expression: "account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')",
            values: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
        },
    ],

    foreignKeys: [
        {
            constraint: 'fk_chartofaccounts_parent',
            column: 'parent_account_id',
            references: { table: 'chartOfAccounts', column: 'id' }, // self-reference (account hierarchy)
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
    ],

    triggers: [
        {
            name: 'trg_chartofaccounts_updated_at',
            timing: 'BEFORE',
            events: ['UPDATE'],
            forEach: 'ROW',
            function: 'set_chartofaccounts_updated_at',
        },
    ],

    referencedBy: [
        {
            table: 'accountsReceivable',
            constraint: 'accounts_receivable_chart_account_fk',
            column: 'chart_account_id',
            references: 'id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            table: 'cashMoviments',
            constraint: 'fk_cashmoviments_chart_account',
            column: 'chart_account_id',
            references: 'id',
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
        {
            table: 'chartOfAccounts',
            constraint: 'fk_chartofaccounts_parent',
            column: 'parent_account_id',
            references: 'id',
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
        {
            table: 'suppliers',
            constraint: 'fk_suppliers_chart_account',
            column: 'chart_account_id',
            references: 'id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    ],
};

export default chartOfAccounts;
