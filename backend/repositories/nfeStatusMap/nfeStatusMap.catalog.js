// ╔══════════════════════════════════════════════════════════════════════╗
// ║ catalog_schema.nfeStatusMap.js — Schema de Status NF-e — ESM       ║
// ║ CONSART ERP                                                        ║
// ║ Tabela: public."nfeStatusMap"                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const NFE_STATUS_MAP_TABLE = 'public."nfeStatusMap"';

export const NFE_STATUS_MAP_SCHEMA = {
    table: NFE_STATUS_MAP_TABLE,

    comment:
        'Mapa central de status da NF-e utilizado por emissões e tentativas de autorização.',

    /* ------------------------------------------------------------------
     * Columns
     * ------------------------------------------------------------------ */
    columns: [
        {
            name: 'nfe_status_id',
            type: 'INTEGER GENERATED ALWAYS AS IDENTITY',
            nullable: false,
        },

        {
            name: 'code',
            type: 'VARCHAR(30)',
            nullable: false,
        },

        {
            name: 'name',
            type: 'VARCHAR(100)',
            nullable: false,
        },

        {
            name: 'description',
            type: 'TEXT',
            nullable: true,
        },

        {
            name: 'is_final',
            type: 'BOOLEAN',
            nullable: false,
            default: 'FALSE',
        },

        {
            name: 'is_authorized',
            type: 'BOOLEAN',
            nullable: false,
            default: 'FALSE',
        },

        {
            name: 'is_active',
            type: 'BOOLEAN',
            nullable: false,
            default: 'TRUE',
        },

        {
            name: 'created_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            default: 'NOW()',
        },

        {
            name: 'updated_at',
            type: 'TIMESTAMPTZ',
            nullable: false,
            default: 'NOW()',
        },
    ],

    /* ------------------------------------------------------------------
     * Primary Key
     * ------------------------------------------------------------------ */
    primaryKey: {
        name: 'nfeStatusMap_pkey',
        columns: ['nfe_status_id'],
    },

    /* ------------------------------------------------------------------
     * Unique Constraints
     * ------------------------------------------------------------------ */
    uniques: [
        {
            name: 'uq_nfe_status_map_code',
            columns: ['code'],
        },
    ],

    /* ------------------------------------------------------------------
     * Indexes
     * ------------------------------------------------------------------ */
    indexes: [
        {
            name: 'idx_nfe_status_map_active',
            columns: ['is_active'],
        },

        {
            name: 'idx_nfe_status_map_name',
            columns: ['name'],
        },
    ],

    /* ------------------------------------------------------------------
     * Foreign Keys
     *
     * Esta tabela NÃO possui FKs de saída.
     *
     * É referenciada por:
     *
     * public."budgetsNfeAttempts".nfe_status_id
     * public."invoicesIssued".nfe_status_id
     * public."ordersNfeAttempts".nfe_status_id
     *
     * Todas:
     *   ON UPDATE CASCADE
     *   ON DELETE RESTRICT
     * ------------------------------------------------------------------ */
    foreignKeys: [],
};

export default NFE_STATUS_MAP_SCHEMA;