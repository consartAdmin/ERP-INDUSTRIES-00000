'use strict';

import { normalizeStatus } from './orders.utils.js';

export { normalizeStatus };

export function hasNfeLinked(order) {
  const candidates = [
    order?.nfe_id, order?.nfeId,
    order?.nfe_key, order?.nfeKey, order?.chave_nfe, order?.chave,
    order?.nfe_number, order?.nfeNumber, order?.numero_nfe,
    order?.nfe_protocol, order?.nfeProtocol, order?.protocolo,
    order?.nfe_plugnotas_id, order?.nfePlugnotasId,
    order?.nfe_xml_url, order?.nfeXmlUrl,
    order?.nfe_danfe_url, order?.nfeDanfeUrl,
  ];

  if (candidates.some((value) =>
    value !== undefined && value !== null && String(value).trim() !== '')) {
    return true;
  }

  const status = String(order?.nfe_status || order?.nfeStatus || '')
    .toUpperCase()
    .trim();

  return Boolean(status && !['SEM_NFE', 'SEM NF-E', 'SEM NFE'].includes(status));
}

