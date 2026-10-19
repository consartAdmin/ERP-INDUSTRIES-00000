// catalog_schema.budgetsPayments.js
// Catalog schema for table "public.budgetsPayments"

export const BOLETO_MODES = Object.freeze(['AUTOMATIC', 'MANUAL', 'NONE']);

export const COLLECTION_PROVIDERS = Object.freeze([
    'ASAAS',
    'MANUAL',
    'OTHER_API',
    'NO_INTEGRATION',
]);

const budgetsPayments = {
    schema: 'public',
    table: 'budgetsPayments',
    primaryKey: 'budget_payment_id',
    sequence: 'budgetsPayments_budget_payment_id_seq',

    columns: {
        budget_payment_id: {
            type: 'bigint',
            nullable: false,
            default: "nextval('\"budgetsPayments_budget_payment_id_seq\"'::regclass)",
            autoIncrement: true,
            primaryKey: true,
            readOnly: true,
        },
        budget_id: {
            type: 'bigint',
            nullable: false,
            required: true,
        },
        payment_method_id: {
            type: 'integer',
            nullable: false,
            required: true,
            references: { table: 'paymentMethods', column: 'paymentMethods_id' },
        },
        amount: {
            type: 'numeric',
            precision: 14,
            scale: 2,
            nullable: false,
            default: 0,
        },
        notes: {
            type: 'varchar',
            maxLength: 255,
            nullable: true,
        },
        created_at: {
            type: 'timestamptz',
            nullable: false,
            default: 'now()',
            readOnly: true,
        },
        updated_at: {
            type: 'timestamptz',
            nullable: false,
            default: 'now()',
            readOnly: true, // maintained by trg_budgetspayments_updated_at
        },
        manual_due_date: {
            type: 'date',
            nullable: true,
        },
        bank_account_id: {
            type: 'bigint',
            nullable: true,
            references: { table: 'bankAccounts', column: 'id' },
        },
        collection_provider: {
            type: 'varchar',
            maxLength: 30,
            nullable: false,
            default: 'NO_INTEGRATION',
            enum: COLLECTION_PROVIDERS,
        },
        boleto_mode: {
            type: 'varchar',
            maxLength: 20,
            nullable: false,
            default: 'NONE',
            enum: BOLETO_MODES,
        },
    },

    indexes: [
        { name: 'budgetsPayments_pkey', columns: ['budget_payment_id'], unique: true, primary: true, method: 'btree' },
        { name: 'idx_budgets_payments_bank_account_id', columns: ['bank_account_id'], method: 'btree' },
        { name: 'idx_budgetspayments_budget_id', columns: ['budget_id'], method: 'btree' },
        { name: 'idx_budgetspayments_payment_method_id', columns: ['payment_method_id'], method: 'btree' },
    ],

    checks: [
        { name: 'chk_budgets_payments_boleto_mode', column: 'boleto_mode', in: BOLETO_MODES },
        { name: 'chk_budgets_payments_collection_provider', column: 'collection_provider', in: COLLECTION_PROVIDERS },
    ],

    foreignKeys: [
        {
            name: 'fk_budgets_payments_bank_account',
            column: 'bank_account_id',
            references: { table: 'bankAccounts', column: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            name: 'fk_budgetspayments_method',
            column: 'payment_method_id',
            references: { table: 'paymentMethods', column: 'paymentMethods_id' },
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
        },
    ],

    referencedBy: [
        {
            table: 'budgetsPaymentInstallments',
            constraint: 'fk_budgetspaymentinstallments_payment',
            column: 'budget_payment_id',
            onDelete: 'CASCADE',
        },
    ],

    triggers: [
        {
            name: 'trg_budgetspayments_updated_at',
            timing: 'BEFORE',
            event: 'UPDATE',
            forEach: 'ROW',
            function: 'set_updated_at_budgets_payments',
        },
    ],

    // Convenience lists for the API layer
    insertable: [
        'budget_id',
        'payment_method_id',
        'amount',
        'notes',
        'manual_due_date',
        'bank_account_id',
        'collection_provider',
        'boleto_mode',
    ],
    updatable: [
        'payment_method_id',
        'amount',
        'notes',
        'manual_due_date',
        'bank_account_id',
        'collection_provider',
        'boleto_mode',
    ],
    required: ['budget_id', 'payment_method_id'],
    defaultOrderBy: [{ column: 'budget_payment_id', direction: 'ASC' }],
};

export default budgetsPayments;
