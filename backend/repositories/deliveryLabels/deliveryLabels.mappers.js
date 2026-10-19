// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.mappers.js — Linha do banco → campos de endereço    ║
// ╚════════════════════════════════════════════════════════════════════╝

export function addressFields(row) {
  return {
    phone: row.phone,
    address: row.address,
    number: row.number,
    complement: row.complement,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
  };
}
