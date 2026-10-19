// catalog_schema.budgetsPaymentInstallments.js
// Catalog schema for table "public.budgetsPaymentInstallments"

export const INSTALLMENT_STATUSES = Object.freeze([
    'PENDENTE',
    'PAGO',
    'PARCIAL',
    'CANCELADO',
]);

const budgetsPaymentInstallments = {
    schema: 'public',
    table: 'budgetsPaymentInstallments',
    primaryKey: 'budget_payment_installment_id',
    sequence: 'budgetsPaymentInstallments_budget_payment_installment_id_seq',

    columns: {
        budget_payment_installment_id: {
            type: 'bigint',
            nullable: false,
            default: "nextval('\"budgetsPaymentInstallments_budget_payment_installment_id_seq\"'::regclass)",
            autoIncrement: true,
            primaryKey: true,
            readOnly: true,
        },
        budget_payment_id: {
            type: 'bigint',
            nullable: false,
            required: true,
            references: { table: 'budgetsPayments', column: 'budget_payment_id' },
        },
        budget_id: {
            type: 'bigint',
            nullable: false,
            required: true,
        },
        installment_number: {
            type: 'integer',
            nullable: false,
            required: true,
        },
        due_date: {
            type: 'date',
            nullable: true,
        },
        amount: {
            type: 'numeric',
            precision: 14,
            scale: 2,
            nullable: false,
            default: 0,
            min: 0,
        },
        status: {
            type: 'varchar',
            maxLength: 30,
            nullable: false,
            default: 'PENDENTE',
            enum: INSTALLMENT_STATUSES,
        },
        paid_amount: {
            type: 'numeric',
            precision: 14,
            scale: 2,
            nullable: false,
            default: 0,
            min: 0,
        },
        paid_at: {
            type: 'timestamptz',
            nullable: true,
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
            readOnly: true, // maintained by trg_budgetspaymentinstallments_updated_at
        },
    },

    indexes: [
        { name: 'budgetsPaymentInstallments_pkey', columns: ['budget_payment_installment_id'], unique: true, primary: true, method: 'btree' },
        { name: 'idx_bpi_budget_id', columns: ['budget_id'], method: 'btree' },
        { name: 'idx_bpi_budget_payment_id', columns: ['budget_payment_id'], method: 'btree' },
        { name: 'idx_bpi_due_date', columns: ['due_date'], method: 'btree' },
        { name: 'idx_bpi_status', columns: ['status'], method: 'btree' },
        { name: 'uq_bpi_payment_installment_number', columns: ['budget_payment_id', 'installment_number'], unique: true, method: 'btree' },
    ],

    uniques: [
        { name: 'uq_bpi_payment_installment_number', columns: ['budget_payment_id', 'installment_number'] },
    ],

    checks: [
        { name: 'ck_budgetspaymentinstallments_amount', column: 'amount', min: 0 },
        { name: 'ck_budgetspaymentinstallments_paid_amount', column: 'paid_amount', min: 0 },
        { name: 'ck_budgetspaymentinstallments_status', column: 'status', in: INSTALLMENT_STATUSES },
    ],

    foreignKeys: [
        {
            name: 'fk_budgetspaymentinstallments_payment',
            column: 'budget_payment_id',
            references: { table: 'budgetsPayments', column: 'budget_payment_id' },
            onUpdate: 'NO ACTION',
            onDelete: 'CASCADE',
        },
    ],

    referencedBy: [],

    triggers: [
        {
            name: 'trg_budgetspaymentinstallments_updated_at',
            timing: 'BEFORE',
            event: 'UPDATE',
            forEach: 'ROW',
            function: 'set_updated_at_budgets_payment_installments',
        },
    ],

    // Convenience lists for the API layer
    insertable: [
        'budget_payment_id',
        'budget_id',
        'installment_number',
        'due_date',
        'amount',
        'status',
        'paid_amount',
        'paid_at',
        'notes',
    ],
    updatable: [
        'due_date',
        'amount',
        'status',
        'paid_amount',
        'paid_at',
        'notes',
    ],
    required: ['budget_payment_id', 'budget_id', 'installment_number'],
    defaultOrderBy: [
        { column: 'budget_payment_id', direction: 'ASC' },
        { column: 'installment_number', direction: 'ASC' },
    ],
};

export default budgetsPaymentInstallments;
