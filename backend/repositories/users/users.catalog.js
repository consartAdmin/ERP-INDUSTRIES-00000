// ╔════════════════════════════════════════════════════════╗
// ║ 🧩 catalog_schema.users.js                             ║
// ║ Tabela: public.users                                   ║
// ╚════════════════════════════════════════════════════════╝

/**
 * Catalog schema: public.users
 *
 * Mirrors the PostgreSQL definition of the "users" table,
 * including columns, indexes/constraints and the tables that reference it.
 *
 * Column defaults given as strings are raw SQL expressions.
 * readOnly columns are filled by the database and never written by the API.
 */

const users = {
    schema: 'public',
    table: 'users',
    primaryKey: 'user_id', // enforced by UNIQUE CONSTRAINT "users_id_unique" (no PRIMARY KEY declared)

    columns: {
        user_id: {
            type: 'integer',
            nullable: false,
            default: "nextval('cadastro_usuarios_id_seq'::regclass)",
            autoIncrement: true,
            readOnly: true,
            sequence: 'cadastro_usuarios_id_seq',
        },
        name: {
            type: 'character varying',
            length: 100,
            nullable: false,
            default: null,
        },
        email: {
            type: 'character varying',
            length: 100,
            nullable: true,
            default: null,
            unique: true,
        },
        password_hash: {
            type: 'character varying',
            length: 100,
            nullable: false,
            default: null,
            sensitive: true, // never expose in API responses
        },
        access_level: {
            type: 'character varying',
            length: 50,
            nullable: false,
            default: null,
        },
        created_at: {
            type: 'timestamp without time zone',
            nullable: true,
            default: 'CURRENT_TIMESTAMP',
            readOnly: true,
        },
        is_active: {
            type: 'boolean',
            nullable: true,
            default: true,
        },
    },

    indexes: [
        {
            name: 'users_email_unique',
            type: 'btree',
            unique: true,
            constraint: false,
            columns: ['email'],
        },
        {
            name: 'users_id_unique',
            type: 'btree',
            unique: true,
            constraint: true,
            columns: ['user_id'],
        },
    ],

    referencedBy: [
        {
            table: 'productsPrices',
            constraint: '.productsPrices_user_id_fkey',
            column: 'user_id',
            references: 'user_id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
        {
            table: 'emailSignatures',
            constraint: 'emailSignatures_owneruserid_fkey',
            column: 'owneruserid',
            references: 'user_id',
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
        {
            table: 'processesUsers',
            constraint: 'fk_processes_users_user',
            column: 'user_id',
            references: 'user_id',
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        {
            table: 'userEmailAccounts',
            constraint: 'fk_useremailaccounts_user',
            column: 'user_id',
            references: 'user_id',
            onUpdate: 'NO ACTION',
            onDelete: 'CASCADE',
        },
        {
            table: 'inventories',
            constraint: 'inventories_created_by_fkey',
            column: 'created_by',
            references: 'user_id',
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
        },
        {
            table: 'inventories',
            constraint: 'inventories_finalized_by_fkey',
            column: 'finalized_by',
            references: 'user_id',
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
        },
        {
            table: 'sellerByOrders',
            constraint: 'sellerByOrders_user_id_fkey',
            column: 'user_id',
            references: 'user_id',
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
    ],
};

export default users;
