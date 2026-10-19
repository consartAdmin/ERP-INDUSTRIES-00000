// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.sql.js — Colunas de endereço do cadastro do cliente ║
// ╚════════════════════════════════════════════════════════════════════╝

export const CUSTOMER_ADDRESS_COLUMNS = `
  COALESCE(c.mobile_number, c.phone_number) AS phone,
  CONCAT_WS(' ', NULLIF(c.street_type, ''), NULLIF(c.street_name, '')) AS address,
  c.street_number AS number,
  c.address_complement AS complement,
  c.neighborhood,
  c.city,
  c.state,
  c.postal_code AS zip_code
`;
