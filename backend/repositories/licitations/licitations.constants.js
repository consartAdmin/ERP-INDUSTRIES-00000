// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitations.constants.js — Tabela e colunas ordenáveis             ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TABLE_NAME = 'public.licitationitems';

export const ALLOWED_SORT_COLUMNS = new Set([
    'id',
    'process_number',
    'licitation_number',
    'agency_name',
    'modality',
    'state',
    'city',
    'session_date',
    'proposal_deadline',
    'lot_number',
    'item_number',
    'product_description',
    'quantity',
    'estimated_unit_price',
    'estimated_total_price',
    'cost_price',
    'minimum_sale_price',
    'proposed_price',
    'estimated_margin',
    'status',
    'created_at',
    'updated_at',
]);
