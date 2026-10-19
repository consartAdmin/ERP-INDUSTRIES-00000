// ╔════════════════════════════════════════════════════════════════════╗
// ║ transporters.constants.js — Tabelas e listas de campos             ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public.transporters';
export const TB_ATTACHMENTS = 'public."transportersAttachments"';

// Campos canônicos + aliases usados pelo frontend existente.
export const SELECT_FIELDS = `
  transporter_id,
  transporter_id AS id,
  NULL::varchar AS code,
  trade_name,
  legal_name,
  legal_name AS corporate_name,
  tax_id,
  tax_id AS cnpj,
  cpf,
  postal_code,
  postal_code AS zip_code,
  street_type,
  street_name,
  street_name AS address,
  street_number,
  street_number AS address_number,
  address_complement,
  neighborhood,
  neighborhood AS district,
  city,
  state,
  ibge_location_id,
  ibge_location_id AS city_ibge_code,
  contact_name,
  phone_number,
  phone_number AS phone,
  mobile_number,
  state_registration,
  municipal_registration,
  rntrc,
  NULL::text AS email,
  notes,
  is_active,
  created_at,
  updated_at
`;

// Colunas gravadas no INSERT/UPDATE — a ordem define os parâmetros ($1..$n).
export const WRITE_FIELDS = Object.freeze([
  'trade_name',
  'legal_name',
  'tax_id',
  'cpf',
  'postal_code',
  'street_type',
  'street_name',
  'street_number',
  'address_complement',
  'neighborhood',
  'city',
  'state',
  'ibge_location_id',
  'contact_name',
  'phone_number',
  'mobile_number',
  'state_registration',
  'municipal_registration',
  'rntrc',
  'notes',
  'is_active',
]);

export const ATTACHMENT_COLUMNS = `
  attachment_id,
  transporter_id,
  file_name,
  file_path,
  file_url,
  mime_type,
  size_bytes,
  created_at,
  is_active
`;
