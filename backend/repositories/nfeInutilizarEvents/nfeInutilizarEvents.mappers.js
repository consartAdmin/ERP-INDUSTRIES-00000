// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.mappers.js — Linha do banco → objeto da API      ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    companyCnpj: row.companyCnpj,
    model: row.model,
    serie: row.serie,
    numberStart: row.numberStart,
    numberEnd: row.numberEnd,
    year: row.year,
    justification: row.justification,
    status: row.status,
    protocol: row.protocol,
    xmlRequest: row.xmlRequest,
    xmlResponse: row.xmlResponse,
    message: row.message,
    requestPayload: row.requestPayload,
    responsePayload: row.responsePayload,
    locked: row.locked,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
