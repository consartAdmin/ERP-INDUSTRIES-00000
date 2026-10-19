// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmLossReasons.constants.js — Esquema do catálogo de motivos       ║
// ║ (não utilizado diretamente; mantido do arquivo original)          ║
// ╚════════════════════════════════════════════════════════════════════╝

/*================================================
 * CATALOG_SCHEMA
 *================================================*/
export const catalog_schema = {
  table: 'crmLossReasons',

  idField: 'id',

  fields: [
    'reason_name',
    'is_active',
    'created_at'
  ],

  searchFields: [
    'reason_name'
  ],

  defaultOrder: 'reason_name ASC'
};
