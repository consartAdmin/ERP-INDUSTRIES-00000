// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employees.constants.js — Tabelas, PKs, aliases e colunas             ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────
// Tabelas
// ─────────────────────────────────────────────────────────────
export const TB = 'public.employees';
export const PK = 'employee_id';
export const ALIAS = 'e';

export const TB_DOCS = 'public."employeesDocuments"';
export const PK_DOCS = 'employee_document_id';
export const DOC_ALIAS = 'ed';

// Colunas permitidas (normalização)
export const COLS = Object.freeze({
  full_name: 'full_name',
  cpf: 'cpf',
  rg: 'rg',
  birth_date: 'birth_date',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  address: 'address',
  city: 'city',
  state: 'state',
  postal_code: 'postal_code',
  position: 'position',
  department: 'department',
  employment_type: 'employment_type',
  salary_base: 'salary_base',
  admission_date: 'admission_date',
  termination_date: 'termination_date',
  active: 'active',
  trial_start_date: 'trial_start_date',
  trial_end_date: 'trial_end_date',
  trial_extended: 'trial_extended',
  trial_extension_end_date: 'trial_extension_end_date',
  trial_notes: 'trial_notes',
  transport_benefit: 'transport_benefit',
  food_benefit: 'food_benefit',
  meal_benefit: 'meal_benefit',
  health_benefit: 'health_benefit',
  notes: 'notes',
});
