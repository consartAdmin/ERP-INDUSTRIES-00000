// ╔════════════════════════════════════════════════════════════════════╗
// ║ vehicles.constants.js — Tabela e colunas da frota (Entregas)       ║
// ║ Tabela: public."vehicles"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."vehicles"';

export const COLS = [
  'vehicle_id', 'plate', 'description', 'brand', 'vehicle_type', 'model_year', 'renavam',
  'capacity_kg', 'capacity_m3', 'is_active', 'notes', 'created_at', 'updated_at',
].join(', ');
