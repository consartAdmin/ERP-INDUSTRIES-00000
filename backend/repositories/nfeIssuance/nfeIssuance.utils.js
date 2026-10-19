// ╔════════════════════════════════════════════════════════════╗
// ║ nfeIssuance.utils.js — helpers puros                       ║
// ║ números, dígitos, CST, XML (xml2js), concorrência limitada ║
// ╚════════════════════════════════════════════════════════════╝

export function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function digits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

/**
 * Normaliza CST/CSOSN vindos de fontes diferentes (colunas do banco, XML de
 * entrada, payloads de terceiros) para a forma canônica usada nas comparações.
 * CST de ICMS tem 2 dígitos ('60') e CSOSN tem 3 ('500'); zeros à esquerda
 * excedentes são removidos para que '060' e 60 sejam tratados como '60'.
 */
export function normalizeCst(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const onlyDigits = raw.replace(/\D+/g, '');
  if (!onlyDigits) return raw.toUpperCase();

  const withoutLeadingZeros = onlyDigits.replace(/^0+(?=\d{2,})/, '');

  return withoutLeadingZeros.length >= 2
    ? withoutLeadingZeros
    : onlyDigits.padStart(2, '0');
}

/**
 * Primeiro valor não vazio de uma lista (aceita 0 e false como vazios apenas
 * quando a representação em texto for vazia).
 */
export function firstNonEmpty(...values) {
  for (const value of values) {
    if (String(value ?? '').trim() !== '') return value;
  }
  return null;
}

/**
 * Executa um mapeamento assíncrono com concorrência limitada.
 * O pool de conexões tem no máximo PGPOOL_MAX conexões (10 por padrão) e um
 * timeout de aquisição (PG_CONNECT_TIMEOUT_MS, 8s), portanto um Promise.all
 * sobre todos os itens de um orçamento grande poderia estourar o pool.
 */
export async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(limit, values.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(values[index], index);
      }
    }),
  );

  return results;
}

export function unwrapCustomer(value) {
  return value?.data?.customer || value?.data || value?.customer || value || {};
}

function firstNode(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function xmlText(node, key) {
  const raw = firstNode(node?.[key]);
  if (raw === undefined || raw === null) return null;

  if (typeof raw === 'object') {
    const inner = raw._ ?? raw['#text'] ?? null;
    if (inner === null || inner === undefined) return null;
    const innerText = String(inner).trim();
    return innerText || null;
  }

  const text = String(raw).trim();
  return text || null;
}

export function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function firstNumber(...values) {
  for (const value of values) {
    const parsed = toNumberOrNull(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function roundTo(value, decimals) {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return null;
  const factor = 10 ** decimals;
  return Math.round((parsed + Number.EPSILON) * factor) / factor;
}

export function parseJsonPayload(payload) {
  if (!payload) return null;
  if (typeof payload === 'object') return payload;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Extrai o grupo ICMS (ICMS00, ICMS10, ICMS60, ICMSSN500...) do
 * raw_tax_payload no formato xml2js.
 */
export function extractIcmsGroup(rawTaxPayload) {
  const payload = parseJsonPayload(rawTaxPayload);
  const icmsRoot = firstNode(payload?.ICMS);

  if (!icmsRoot || typeof icmsRoot !== 'object') return null;

  for (const [groupName, groupValue] of Object.entries(icmsRoot)) {
    const group = firstNode(groupValue);
    if (group && typeof group === 'object') {
      return { groupName, group };
    }
  }

  return null;
}

/**
 * Quantidade da entrada na unidade base de estoque.
 * Premissa: inboundInvoiceItems.quantity × conversion_factor.
 */
export function inboundBaseQuantity(row) {
  const quantity = toNumberOrNull(row?.quantity);
  const factor = toNumberOrNull(row?.conversion_factor);

  if (quantity === null || quantity <= 0) return null;
  return quantity * (factor !== null && factor > 0 ? factor : 1);
}

/**
 * Quantidade vendida na unidade base de estoque.
 * Premissa: budgetsItems.quantity × conversion_factor.
 */
export function budgetItemBaseQuantity(item) {
  const quantity = toNumberOrNull(item?.quantity);
  const factor = toNumberOrNull(item?.conversion_factor);

  if (quantity === null || quantity <= 0) return null;
  return quantity * (factor !== null && factor > 0 ? factor : 1);
}
