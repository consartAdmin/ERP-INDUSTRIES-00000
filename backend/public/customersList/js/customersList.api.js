// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.api.js                                          ║
// ║ MODULE: Customers List — API                                        ║
// ║ PRODNEX ERP                                                         ║
// ║ Customers, lookups and seller-customer relation requests            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ROUTES } from './customersList.config.js';
import { lookups, state } from './customersList.state.js';
import {
  fetchJson,
  fetchJsonTry,
  normalizeArrayPayload,
  normalizeRowsPayload,
  onlyDigits,
  pick,
} from './customersList.utils.js';

export async function preloadLookups() {
  const results = await Promise.allSettled([
    loadSellersLookup(),
    loadSegmentsLookup(),
    loadStatusTypesLookup(),
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[customersList.preloadLookups]', result.reason);
    }
  }
}

async function loadSellersLookup() {
  lookups.sellersById.clear();

  for (const url of [ROUTES.sellers, ROUTES.vendedores]) {
    try {
      const { response, json } = await fetchJson(url);
      if (!response.ok) continue;

      for (const seller of normalizeArrayPayload(json)) {
        const id = pick(seller.id, seller.seller_id, seller.codigo, seller.code);
        if (id == null) continue;
        const name =
          pick(
            seller.nickname,
            seller.apelido,
            seller.name,
            seller.nome,
            seller.description
          ) || `Vendedor #${id}`;
        lookups.sellersById.set(String(id), String(name));
      }
      return;
    } catch {
      // Tenta a próxima rota compatível.
    }
  }
}

async function loadSegmentsLookup() {
  lookups.segmentsByKey.clear();
  lookups.segmentOptions.clear();
  const { response, json } = await fetchJson(ROUTES.segmentos);
  if (!response.ok) return;

  for (const segment of normalizeArrayPayload(json)) {
    const code = pick(segment.segment_code, segment.codigo, segment.code);
    const name = pick(
      segment.segment_name,
      segment.nome,
      segment.name,
      segment.description
    );
    const display = name && code ? `${name} (${code})` : name || code || '';
    if (!display) continue;

    const id = pick(segment.segment_id, segment.id, segment.segmentId);
    if (/^\d+$/.test(String(id ?? ''))) lookups.segmentOptions.set(String(id), String(display));

    [
      code,
      segment.id,
      segment.segment_id,
      segment.segmentCode,
      segment.segmentId,
    ]
      .filter((key) => key != null && key !== '')
      .forEach((key) => lookups.segmentsByKey.set(String(key), String(display)));
  }
}

async function loadStatusTypesLookup() {
  lookups.statusById.clear();
  const { response, json } = await fetchJson(ROUTES.statusTypes);
  if (!response.ok) return;

  for (const status of normalizeArrayPayload(json)) {
    const id = pick(status.id, status.status_type_id, status.codigo, status.code);
    if (id == null) continue;
    const name =
      pick(status.name_pt, status.nome, status.description, status.name) ||
      `Status #${id}`;

    lookups.statusById.set(String(id), String(name));
    if (status.internal_code) {
      lookups.statusById.set(String(status.internal_code), String(name));
    }
    if (status.status_code) {
      lookups.statusById.set(String(status.status_code), String(name));
    }
  }
}

function setRequestFilters(query) {
  const isDigits = (value) => /^\d+$/.test(String(value ?? '').trim());
  const q = String(state.q ?? '').trim();

  if (q) query.set('q', q);
  if (state.is_active !== '') {
    query.set('is_active', state.is_active === 'true' ? 'true' : 'false');
  }
  if (isDigits(state.status_type_id)) {
    query.set('status_type_id', String(state.status_type_id));
  }
  if (isDigits(state.segment_id)) {
    query.set('segment_id', String(state.segment_id));
  }
  if (isDigits(state.seller_id)) {
    query.set('seller_id', String(state.seller_id));
  }
  if (String(state.business_segment ?? '').trim()) {
    query.set('business_segment', String(state.business_segment).trim());
  }
  if (String(state.orderBy ?? '').trim()) {
    query.set('orderBy', String(state.orderBy).trim());
    query.set(
      'orderDirection',
      String(state.orderDirection).toLowerCase() === 'desc' ? 'desc' : 'asc'
    );
  }
}

function normalizedCustomers(json) {
  const normalized = normalizeRowsPayload(json);
  const rows = Array.isArray(normalized.rows) ? normalized.rows : [];
  const total = Number.isFinite(Number(normalized.total))
    ? Number(normalized.total)
    : rows.length;
  return { rows, total };
}

export async function fetchCustomers() {
  const limit = Math.max(1, Number(state.limit || 10));
  const offset = Math.max(0, Number(state.offset || 0));
  const offsetQuery = new URLSearchParams();
  setRequestFilters(offsetQuery);
  offsetQuery.set('limit', String(limit));
  offsetQuery.set('offset', String(offset));

  try {
    const { response, json } = await fetchJson(
      `${ROUTES.customers}?${offsetQuery}`
    );
    if (response.ok) {
      return { ...normalizedCustomers(json), limit, offset };
    }
  } catch {
    // Compatibilidade com APIs que usam page/pageSize.
  }

  const page = Math.max(1, Number(state.page || 1));
  const pageQuery = new URLSearchParams();
  setRequestFilters(pageQuery);
  pageQuery.set('page', String(page));
  pageQuery.set('pageSize', String(limit));

  const { response, json } = await fetchJson(
    `${ROUTES.customers}?${pageQuery}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao carregar clientes.`);
  }

  return {
    ...normalizedCustomers(json),
    limit,
    offset: (page - 1) * limit,
  };
}

function linkIsActive(link) {
  const value = pick(
    link?.link_active,
    link?.active,
    link?.ativo,
    link?.is_active,
    link?.isActive
  );
  if (value == null) return true;
  if (typeof value === 'string') {
    return value !== '0' && value.toLowerCase() !== 'false';
  }
  return value !== false && value !== 0;
}

function getSellerIdFromLink(link) {
  return pick(
    link?.seller_id,
    link?.sellerId,
    link?.id_seller,
    link?.vendedor_id,
    link?.vendedorId,
    link?.salesperson_id,
    link?.salespersonId,
    link?.seller?.id,
    link?.seller?.seller_id,
    link?.vendedor?.id,
    link?.vendedor?.seller_id,
    link?.salesperson?.id,
    link?.seller_name,
    link?.vendedor_nome,
    link?.salesperson_name,
    link?.name
  );
}

function getCustomerIdFromLink(link) {
  return pick(
    link?.customer_id,
    link?.customerId,
    link?.id_customer,
    link?.cliente_id,
    link?.clienteId,
    link?.customer?.id,
    link?.customer?.customer_id,
    link?.cliente?.id,
    link?.cliente?.customer_id
  );
}

function saveSellerLink(customerId, sellerId) {
  if (customerId == null || sellerId == null) return;
  const seller = String(sellerId);
  const value = Number.isNaN(Number(onlyDigits(seller))) && seller
    ? `__NAME__:${seller}`
    : seller;

  if (!lookups.sellerByCustomerId.has(String(customerId))) {
    lookups.sellerByCustomerId.set(String(customerId), value);
  }
}

export async function loadSellerLinksForRows(rows) {
  lookups.sellerByCustomerId.clear();
  const customerIds = rows
    .map((row) => pick(row.customer_id, row.id, row.customerId))
    .filter((id) => id != null && id !== '')
    .map(String);

  if (!customerIds.length) return;

  const ids = encodeURIComponent(customerIds.join(','));
  const bulkUrls = [
    `${ROUTES.sellerForCustomer}?customer_ids=${ids}`,
    `${ROUTES.sellerForCustomer}?customerIds=${ids}`,
    `${ROUTES.sellerForCustomer}/bulk?customer_ids=${ids}`,
    `${ROUTES.sellerForCustomer}/by-customers?ids=${ids}`,
  ];

  try {
    const json = await fetchJsonTry(bulkUrls);
    const links = normalizeArrayPayload(json);
    if (links.length) {
      for (const link of links) {
        if (linkIsActive(link)) {
          saveSellerLink(getCustomerIdFromLink(link), getSellerIdFromLink(link));
        }
      }
      return;
    }
  } catch {
    // Faz fallback individual abaixo.
  }

  let index = 0;
  const worker = async () => {
    while (index < customerIds.length) {
      const customerId = customerIds[index++];
      try {
        const { response, json } = await fetchJson(
          ROUTES.sellerForCustomerByCustomer(customerId)
        );
        if (!response.ok) continue;
        const links = normalizeArrayPayload(json);
        const link = links.find(linkIsActive) || links[0];
        if (link) saveSellerLink(customerId, getSellerIdFromLink(link));
      } catch {
        // Um vínculo indisponível não impede a listagem.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(8, customerIds.length) }, worker)
  );
}
