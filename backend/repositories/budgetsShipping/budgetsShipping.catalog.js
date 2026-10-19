// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: services/apis/budgetsShipping/catalog_schema.budgetsShipping.js ║
// ║ MODULE: Budgets Shipping - Catalog Schema                          ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Table:  public."budgetsShipping"
// API:    services/apis/budgetsShipping/budgetsShippingApi.js
//
// Per-column keys:
//   aliases   -> extra request body keys accepted by normalizePayload()
//   normalize -> helper applied in normalizePayload()
//                (toNumber | toInt | toBool | cleanText | onlyDigits)
//   fallback  -> value used when the body field is empty
//   select    -> returned by getByBudgetId()
//   write     -> sent by upsert() (INSERT + ON CONFLICT DO UPDATE)

const columns = {
    budget_shipping_id: {
        type: 'bigint',
        nullable: false,
        default: "nextval('\"budgetsShipping_budget_shipping_id_seq\"'::regclass)",
        primaryKey: true,
        select: true,
        write: false,
        description: 'Identificador do frete do orçamento.',
    },

    budget_id: {
        type: 'bigint',
        nullable: false,
        unique: true,
        source: 'param',
        select: true,
        write: true,
        description: 'Orçamento dono do frete (1:1, recebido como parâmetro budgetId).',
    },

    freight_value: {
        type: 'numeric(14,2)',
        nullable: false,
        default: 0,
        aliases: ['freightValue'],
        normalize: 'toNumber',
        fallback: 0,
        select: true,
        write: true,
        description: 'Valor do frete.',
    },

    freight_mode: {
        type: 'smallint',
        nullable: false,
        default: 9,
        aliases: ['freightMode'],
        normalize: 'toInt',
        fallback: 9,
        select: true,
        write: true,
        options: {
            0: 'Por conta do emitente (CIF)',
            1: 'Por conta do destinatário (FOB)',
            2: 'Por conta de terceiros',
            3: 'Transporte próprio do remetente',
            4: 'Transporte próprio do destinatário',
            9: 'Sem ocorrência de transporte',
        },
        description: 'Modalidade do frete (NF-e modFrete).',
    },

    // ── Transportadora ──────────────────────────────────────────────────
    carrier_name: {
        type: 'varchar(150)',
        nullable: true,
        aliases: ['carrierName'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Nome/razão social da transportadora.',
    },

    carrier_cnpj_cpf: {
        type: 'varchar(20)',
        nullable: true,
        aliases: [
            'carrierCnpjCpf',
            'carrier_document',
            'carrierDocument',
            'carrier_cnpj',
            'carrierCnpj',
            'carrier_cpf',
            'carrierCpf',
        ],
        normalize: 'onlyDigits',
        fallback: null,
        select: true,
        write: true,
        description: 'CNPJ ou CPF da transportadora (somente dígitos).',
    },

    carrier_ie: {
        type: 'varchar(30)',
        nullable: true,
        aliases: ['carrierIe'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Inscrição estadual da transportadora.',
    },

    carrier_address: {
        type: 'varchar(200)',
        nullable: true,
        aliases: ['carrierAddress'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Logradouro.',
    },

    carrier_number: {
        type: 'varchar(20)',
        nullable: true,
        aliases: ['carrierNumber'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Número.',
    },

    carrier_complement: {
        type: 'varchar(100)',
        nullable: true,
        aliases: ['carrierComplement'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Complemento.',
    },

    carrier_district: {
        type: 'varchar(100)',
        nullable: true,
        aliases: ['carrierDistrict'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Bairro.',
    },

    carrier_city: {
        type: 'varchar(100)',
        nullable: true,
        aliases: ['carrierCity'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Cidade.',
    },

    carrier_state: {
        type: 'char(2)',
        nullable: true,
        aliases: ['carrierState', 'carrier_uf', 'carrierUf'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'UF da transportadora.',
    },

    carrier_zipcode: {
        type: 'varchar(10)',
        nullable: true,
        aliases: ['carrierZipcode', 'carrier_cep', 'carrierCep'],
        normalize: 'onlyDigits',
        fallback: null,
        select: true,
        write: true,
        description: 'CEP (somente dígitos).',
    },

    // ── Veículo ─────────────────────────────────────────────────────────
    vehicle_plate: {
        type: 'varchar(10)',
        nullable: true,
        aliases: ['vehiclePlate'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Placa do veículo.',
    },

    vehicle_state: {
        type: 'char(2)',
        nullable: true,
        aliases: ['vehicleState', 'vehicle_uf', 'vehicleUf'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'UF do veículo.',
    },

    vehicle_rntc: {
        type: 'varchar(30)',
        nullable: true,
        aliases: ['vehicleRntc'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'RNTC (Registro Nacional de Transportador de Carga).',
    },

    // ── Volumes ─────────────────────────────────────────────────────────
    volumes: {
        type: 'integer',
        nullable: true,
        default: 0,
        aliases: ['volume_quantity', 'volumeQuantity'],
        normalize: 'toInt',
        fallback: 0,
        select: true,
        write: true,
        description: 'Quantidade de volumes.',
    },

    volume_species: {
        type: 'varchar(60)',
        nullable: true,
        aliases: ['volumeSpecies'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Espécie dos volumes.',
    },

    volume_brand: {
        type: 'varchar(60)',
        nullable: true,
        aliases: ['volumeBrand'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Marca dos volumes.',
    },

    volume_numbering: {
        type: 'varchar(60)',
        nullable: true,
        aliases: ['volumeNumbering'],
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Numeração dos volumes.',
    },

    gross_weight: {
        type: 'numeric(14,3)',
        nullable: true,
        default: 0,
        aliases: ['grossWeight'],
        normalize: 'toNumber',
        fallback: 0,
        select: true,
        write: true,
        description: 'Peso bruto (kg).',
    },

    net_weight: {
        type: 'numeric(14,3)',
        nullable: true,
        default: 0,
        aliases: ['netWeight'],
        normalize: 'toNumber',
        fallback: 0,
        select: true,
        write: true,
        description: 'Peso líquido (kg).',
    },

    // ── Vínculos / controle ─────────────────────────────────────────────
    transporter_id: {
        type: 'integer',
        nullable: true,
        references: 'transporters.transporter_id',
        aliases: ['transporterId'],
        normalize: 'toInt',
        fallback: null,
        select: true,
        write: true,
        description: 'Transportadora cadastrada (transporters).',
    },

    notes: {
        type: 'text',
        nullable: true,
        normalize: 'cleanText',
        fallback: null,
        select: true,
        write: true,
        description: 'Observações.',
    },

    is_active: {
        type: 'boolean',
        nullable: false,
        default: true,
        aliases: ['isActive'],
        normalize: 'toBool',
        fallback: true,
        select: true,
        write: true,
        description: 'Registro ativo.',
    },

    created_at: {
        type: 'timestamp',
        nullable: false,
        default: 'now()',
        select: true,
        write: false,
        description: 'Data de criação.',
    },

    updated_at: {
        type: 'timestamp',
        nullable: false,
        default: 'now()',
        onUpdate: 'NOW()',
        select: true,
        write: false,
        description: 'Data da última atualização (NOW() no upsert).',
    },
};

const budgetsShippingSchema = {
    schema: 'public',
    table: 'budgetsShipping',
    qualifiedName: 'public."budgetsShipping"',
    description: 'Dados de transporte/frete do orçamento (relação 1:1 com budgets).',

    primaryKey: 'budget_shipping_id',
    lookupKey: 'budget_id',

    columns,

    selectColumns: Object.keys(columns).filter((key) => columns[key].select),
    writeColumns: Object.keys(columns).filter((key) => columns[key].write),

    api: {
        file: 'services/apis/budgetsShipping/budgetsShippingApi.js',
        getByBudgetId: { where: 'budget_id = $1', limit: 1 },
        upsert: {
            conflictTarget: ['budget_id'],
            touch: { updated_at: 'NOW()' },
            returning: '*',
        },
        remove: { where: 'budget_id = $1', mode: 'hard' },
    },

    uniqueConstraints: [
        { name: 'uq_budget_shipping', columns: ['budget_id'] },
    ],

    indexes: [
        { name: 'budgetsShipping_pkey', columns: ['budget_shipping_id'], primary: true, unique: true },
        { name: 'uq_budget_shipping', columns: ['budget_id'], unique: true },
        { name: 'idx_budgets_shipping_transporter_id', columns: ['transporter_id'] },
        { name: 'idx_budgetshipping_active', columns: ['is_active'] },
        { name: 'idx_budgetshipping_document', columns: ['carrier_cnpj_cpf'] },
    ],

    foreignKeys: [
        {
            name: 'fk_budget_shipping_budget',
            column: 'budget_id',
            references: { table: 'budgets', column: 'budget_id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        {
            name: 'budgets_shipping_transporter_id_fkey',
            column: 'transporter_id',
            references: { table: 'transporters', column: 'transporter_id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    ],

    referencedBy: [
        {
            name: 'fk_budgets_shipping',
            table: 'budgets',
            column: 'budget_shipping_id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        },
    ],
};

export { budgetsShippingSchema };
export default budgetsShippingSchema;
