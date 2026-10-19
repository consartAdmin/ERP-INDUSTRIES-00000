/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ crmConclusionSummaryApi.js                                          ║
 * ║ CRM Deals — API + normalização do modal de conclusões               ║
 * ║ Path: /public/crmDeals/crmConclusionSummaryModal/                   ║
 * ║                                                                      ║
 * ║ ✅ Chama backend /api/crm/deals-outcomes/code/:code/operations       ║
 * ║ ✅ Normaliza operações                                               ║
 * ║ ✅ Humaniza código de conclusão                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const CONCLUSION_CODE_ALIASES = {
  lost_no_contact: [
    'lost_no_contact',
    'lost-no-contact',
    'sem_contato',
    'sem contato',
    'sem_contato_perdido',
    'sem contato / perdido',
    'sem_contato_/perdido',
    'lost no contact',
  ],
  sales_drop: [
    'sales_drop',
    'sales-drop',
    'queda_de_venda',
    'queda_venda',
    'queda de venda',
  ],
  won_sale: [
    'won_sale',
    'won-sale',
    'conversao_em_vendas',
    'conversão_em_vendas',
    'conversao em vendas',
    'conversão em vendas',
  ],
};

/* --------------------------------------------------------------------- */
/* HTTP                                                                  */
/* --------------------------------------------------------------------- */

export async function fetchConclusionOperations(conclusionCode, options = {}) {
  const code = normalizeConclusionCode(conclusionCode);

  if (!code) {
    throw new Error('Código de conclusão não informado.');
  }

  const {
    signal = undefined,
    credentials = 'include',
    headers = {},
  } = options;

  const url = `/api/crm/deals-outcomes/code/${encodeURIComponent(code)}/operations`;

  console.log('[CRM Conclusion Modal] Fetch URL:', url);

  const response = await fetch(url, {
    method: 'GET',
    credentials,
    signal,
    headers: {
      Accept: 'application/json',
      ...(window.CRM_COMPANY ? { 'X-CRM-Company': window.CRM_COMPANY } : {}),
      ...headers,
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.message ||
        `Erro ao carregar operações da conclusão (${response.status}).`
    );
  }

  return normalizeConclusionOperationsResponse(data, code);
}

/* --------------------------------------------------------------------- */
/* Normalização de resposta                                              */
/* --------------------------------------------------------------------- */

export function normalizeConclusionOperationsResponse(payload = {}, forcedConclusionCode = '') {
  const conclusionCode = normalizeConclusionCode(
    forcedConclusionCode ||
      payload.conclusionCode ||
      payload.code ||
      payload.outcome?.code ||
      payload.conclusion?.code ||
      ''
  );

  const rawItems =
    payload.items ||
    payload.rows ||
    payload.data ||
    payload.operations ||
    [];

  const items = (Array.isArray(rawItems) ? rawItems : []).map((item) =>
    normalizeOperation(item, conclusionCode)
  );

  const totalCount = Number(
    payload.totalCount ??
      payload.total ??
      payload.count ??
      items.length
  ) || 0;

  const totalValue = toNumber(
    payload.totalValue ??
      payload.total_value ??
      payload.sum ??
      sumOperationsValue(items)
  );

  return {
    ok: true,
    source: 'api',
    conclusionCode,
    conclusionName:
      payload.outcome?.name ||
      payload.conclusion?.name ||
      humanizeConclusionCode(conclusionCode),
    items,
    totalCount,
    totalValue,
    raw: payload,
  };
}

/* --------------------------------------------------------------------- */
/* Normalização de item                                                  */
/* --------------------------------------------------------------------- */

export function normalizeOperation(item = {}, forcedConclusionCode = '') {
  const conclusionCode = normalizeConclusionCode(
    forcedConclusionCode ||
      item.outcome_code ||
      item.conclusion_code ||
      item.closed_reason_code ||
      item.status_code ||
      item.code ||
      item.outcome?.code ||
      item.conclusion?.code ||
      ''
  );

  const rawValue =
    item.total_value ??
    item.value ??
    item.amount ??
    item.budget_value ??
    item.orcamento_total ??
    item.total ??
    0;

  return {
    id: item.id ?? item.deal_id ?? item.crm_deal_id ?? '',
    dealId: item.deal_id ?? item.crm_deal_id ?? item.id ?? '',
    customerId: item.customer_id ?? item.client_id ?? item.cliente_id ?? null,
    sellerId: item.seller_id ?? item.vendor_id ?? item.vendedor_id ?? null,

    title:
      item.title ||
      item.deal_title ||
      item.subject ||
      item.nome ||
      item.operation_title ||
      `Operação ${item.id ?? item.deal_id ?? ''}`.trim(),

    customerName:
      item.customer_name ||
      item.client_name ||
      item.cliente_nome ||
      item.nome_fantasia ||
      item.razao_social ||
      item.customer ||
      '-',

    sellerName:
      item.seller_name ||
      item.vendor_name ||
      item.vendedor ||
      item.seller ||
      '-',

    value: toNumber(rawValue),

    stageName:
      item.stage_name ||
      item.pipeline_stage ||
      item.etapa ||
      item.status_name ||
      '-',

    conclusionCode,

    conclusionName:
      item.outcome_name ||
      item.conclusion_name ||
      item.closed_reason_name ||
      item.status_label ||
      humanizeConclusionCode(conclusionCode),

    lossReasonId:
      item.loss_reason_id ??
      item.reason_id ??
      item.sales_drop_reason_id ??
      null,

    lossReasonName:
      item.loss_reason_name ||
      item.reason_name ||
      item.motivo_queda ||
      '',

    note:
      item.note ||
      item.observation ||
      item.observacao ||
      item.description ||
      '',

    phone:
      item.phone ||
      item.telefone ||
      item.customer_phone ||
      '',

    email:
      item.email ||
      item.customer_email ||
      item.cliente_email ||
      '',

    createdAt:
      item.created_at ||
      item.createdAt ||
      item.data_criacao ||
      null,

    updatedAt:
      item.updated_at ||
      item.updatedAt ||
      item.data_atualizacao ||
      null,

    closedAt:
      item.closed_at ||
      item.finished_at ||
      item.finalized_at ||
      item.completed_at ||
      item.encerrado_em ||
      item.updated_at ||
      null,

    isClosed: toBoolean(
      item.is_closed ??
        item.closed ??
        item.finalized ??
        item.encerrado ??
        false
    ),

    raw: item,
  };
}

/* --------------------------------------------------------------------- */
/* Helpers públicos                                                      */
/* --------------------------------------------------------------------- */

export function normalizeConclusionCode(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[\/]+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!raw) return '';

  for (const [canonical, aliases] of Object.entries(CONCLUSION_CODE_ALIASES)) {
    if (canonical === raw || aliases.includes(raw)) {
      return canonical;
    }
  }

  return raw;
}

export function humanizeConclusionCode(code) {
  const normalized = normalizeConclusionCode(code);

  switch (normalized) {
    case 'lost_no_contact':
      return 'Sem Contato / Perdido';
    case 'sales_drop':
      return 'Queda de Venda';
    case 'won_sale':
      return 'Conversão em Vendas';
    default:
      return normalized
        ? normalized
            .split('_')
            .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
            .join(' ')
        : 'Conclusão';
  }
}

export function sumOperationsValue(items = []) {
  return items.reduce((sum, item) => sum + toNumber(item?.value || 0), 0);
}

/* --------------------------------------------------------------------- */
/* Helpers privados                                                      */
/* --------------------------------------------------------------------- */

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const str = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'sim', 's'].includes(str)) return true;
  if (['0', 'false', 'no', 'n', 'nao', 'não'].includes(str)) return false;

  return Boolean(value);
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}