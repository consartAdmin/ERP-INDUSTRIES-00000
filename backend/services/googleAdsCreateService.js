// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCreateService.js — Criar Campanhas/Grupos/Keywords/Ads     ║
// ║ CONSART ERP · Google Ads API                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝


const MICROS_PER_UNIT = 1_000_000;

// ---------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------

/**
 * Converte um valor em R$ ou micros para micros.
 *
 * - Se value for null/undefined/<=0 → assume minUnits (se informado).
 * - Se value < 1e6 → assume que é R$ e multiplica por 1e6.
 * - Se value >= 1e6 → assume que já está em micros.
 * - Sempre aplica o mínimo em R$ (minUnits), se informado.
 */
function toMicros(value, { minUnits = 0 } = {}) {
  let n = Number(value);

  // Se vier vazio, NaN ou <= 0, usa minUnits (se tiver)
  if (!Number.isFinite(n) || n <= 0) {
    if (minUnits > 0) {
      n = minUnits;
    } else {
      // sem mínimo configurado → deixa 0 mesmo
      return 0;
    }
  }

  let micros;
  if (n < MICROS_PER_UNIT) {
    // Provavelmente em R$
    micros = Math.round(n * MICROS_PER_UNIT);
  } else {
    // Provavelmente já em micros
    micros = Math.round(n);
  }

  const minMicros = Math.round(minUnits * MICROS_PER_UNIT);
  if (minMicros > 0 && micros < minMicros) {
    micros = minMicros;
  }

  return micros;
}

/**
 * Tenta extrair o ID numérico de um resource_name
 * Ex: "customers/123/campaigns/456" → "456"
 */
function extractIdFromResourceName(resourceName) {
  if (!resourceName) return undefined;
  const str = String(resourceName);
  const match = str.match(/(\d+)$/);
  return match ? match[1] : undefined;
}

/**
 * Normaliza o retorno do create() da lib google-ads-api:
 * - às vezes volta array
 * - às vezes volta { results: [...] }
 * - às vezes objeto direto
 */
function unwrapCreateResponse(resp) {
  if (!resp) return {};
  if (Array.isArray(resp)) {
    return resp[0] || {};
  }
  if (Array.isArray(resp.results) && resp.results.length > 0) {
    return resp.results[0];
  }
  return resp;
}

// ---------------------------------------------------------------------
// 1. Criar CampaignBudget + Campaign
// ---------------------------------------------------------------------

export async function createCampaign({
  customerId,
  name,
  status = 'PAUSED',
  dailyBudgetMicros, // pode vir já em micros
  dailyBudget,       // ou em R$
  channelType = 'SEARCH',
  startDate,
  endDate,
}) {
  const customer = getCustomer(customerId);

  // 🔹 pega o que vier (micros ou R$)
  const rawBudget = dailyBudgetMicros ?? dailyBudget;

  // 🔹 Garante um budget diário mínimo em R$ (ex.: 5,00)
  const budgetAmountMicros = toMicros(rawBudget, { minUnits: 5 });

  if (!budgetAmountMicros || budgetAmountMicros <= 0) {
    throw new Error(
      'Orçamento diário inválido. Informe um valor maior que zero (ex.: 5,00).'
    );
  }

  // 1) Cria CampaignBudget
  const budgetPayload = {
    name: `Budget - ${name}`,
    amount_micros: budgetAmountMicros,
    delivery_method: 'STANDARD',
  };

  console.log('[createCampaign] budgetPayload:', budgetPayload);

  const budgetRespRaw = await customer.campaignBudgets.create([budgetPayload]);
  const budgetEntity = unwrapCreateResponse(budgetRespRaw);

  const budgetResourceName =
    budgetEntity.resource_name ||
    budgetEntity.resourceName ||
    budgetRespRaw.resource_name ||
    budgetRespRaw.resourceName;

  if (!budgetResourceName) {
    console.error('[createCampaign] budgetRespRaw:', budgetRespRaw);
    throw new Error(
      'Não foi possível obter o resource_name do CampaignBudget criado.'
    );
  }

  // 2) Cria Campaign referenciando o budget
  const campaignPayload = {
  name,
  status,
  advertising_channel_type: channelType,
  bidding_strategy_type: 'MANUAL_CPC',   // ← CORRETO!
  start_date: startDate || undefined,
  end_date: endDate || undefined,
  campaign_budget: budgetResourceName,
};

  console.log('[createCampaign] campaignPayload:', campaignPayload);

  const campaignRespRaw = await customer.campaigns.create([campaignPayload]);
  const campaignEntity = unwrapCreateResponse(campaignRespRaw);

  const campaignResourceName =
    campaignEntity.resource_name ||
    campaignEntity.resourceName ||
    campaignRespRaw.resource_name ||
    campaignRespRaw.resourceName;

  const campaignId =
    campaignEntity.id || extractIdFromResourceName(campaignResourceName);

  const result = {
    id: campaignId,
    resource_name: campaignResourceName,
    budget_resource_name: budgetResourceName,
    _rawBudget: budgetRespRaw,
    _rawCampaign: campaignRespRaw,
  };

  console.log('[createCampaign] result:', result);

  return result;
}

// ---------------------------------------------------------------------
// 2. Criar Ad Group
// ---------------------------------------------------------------------

export async function createAdGroup({
  customerId,
  campaignId,
  name,
  cpcBidMicros = 1_000_000, // 1,00
}) {
  const customer = getCustomer(customerId);

  // 🔹 Garante lance mínimo (ex.: R$ 0,50)
  const bidMicros = toMicros(cpcBidMicros, { minUnits: 0.5 });

  const payload = {
    campaign_id: Number(campaignId),
    name,
    cpc_bid_micros: bidMicros,
    status: 'ENABLED',
  };

  console.log('[createAdGroup] payload:', payload);

  const respRaw = await customer.adGroups.create([payload]);
  const entity = unwrapCreateResponse(respRaw);

  const resourceName =
    entity.resource_name ||
    entity.resourceName ||
    respRaw.resource_name ||
    respRaw.resourceName;

  const id = entity.id || extractIdFromResourceName(resourceName);

  const result = {
    id,
    resource_name: resourceName,
    _raw: respRaw,
  };

  console.log('[createAdGroup] result:', result);

  return result;
}

// ---------------------------------------------------------------------
// 3. Criar Keyword
// ---------------------------------------------------------------------

export async function createKeyword({
  customerId,
  adGroupId,
  text,
  matchType = 'PHRASE',
  cpcBidMicros = 500_000, // 0,50
}) {
  const customer = getCustomer(customerId);

  const bidMicros = toMicros(cpcBidMicros, { minUnits: 0.5 });

  const payload = {
    ad_group_id: Number(adGroupId),
    status: 'ENABLED',
    cpc_bid_micros: bidMicros,
    keyword: {
      text,
      match_type: matchType,
    },
  };

  console.log('[createKeyword] payload:', payload);

  const respRaw = await customer.adGroupCriteria.create([payload]);
  const entity = unwrapCreateResponse(respRaw);

  const resourceName =
    entity.resource_name ||
    entity.resourceName ||
    respRaw.resource_name ||
    respRaw.resourceName;

  const id = entity.id || extractIdFromResourceName(resourceName);

  const result = {
    id,
    resource_name: resourceName,
    _raw: respRaw,
  };

  console.log('[createKeyword] result:', result);

  return result;
}

// ---------------------------------------------------------------------
// 4. Criar Anúncio (Responsive Search Ad)
// ---------------------------------------------------------------------

export async function createAd({
  customerId,
  adGroupId,
  headlines = [],
  descriptions = [],
  finalUrl,
}) {
  const customer = getCustomer(customerId);

  const payload = {
    ad_group_id: Number(adGroupId),
    ad: {
      responsive_search_ad: {
        headlines: (headlines || [])
          .filter((t) => t && String(t).trim().length > 0)
          .map((text) => ({ text: String(text).trim() })),
        descriptions: (descriptions || [])
          .filter((t) => t && String(t).trim().length > 0)
          .map((text) => ({ text: String(text).trim() })),
      },
      final_urls: [finalUrl],
    },
  };

  console.log('[createAd] payload:', payload);

  const respRaw = await customer.adGroupAds.create([payload]);
  const entity = unwrapCreateResponse(respRaw);

  const resourceName =
    entity.resource_name ||
    entity.resourceName ||
    respRaw.resource_name ||
    respRaw.resourceName;

  const id = entity.id || extractIdFromResourceName(resourceName);

  const result = {
    id,
    resource_name: resourceName,
    _raw: respRaw,
  };

  console.log('[createAd] result:', result);

  return result;
}

// ---------------------------------------------------------------------
// 5. Fluxo completo (1 clique) — se quiser usar depois
// ---------------------------------------------------------------------

export async function createFullCampaignFlow({
  customerId,
  campaign,
  adgroup,
  keywords = [],
  ads = [],
}) {
  const result = {};

  // 1) Campaign
  const c = await createCampaign({
    customerId,
    ...campaign,
  });
  result.campaign = c;

  const campaignId = c.id;
  if (!campaignId) {
    throw new Error('Não foi possível obter o ID da campanha criada.');
  }

  // 2) Ad Group
  const g = await createAdGroup({
    customerId,
    campaignId,
    ...adgroup,
  });
  result.adgroup = g;

  const adGroupId = g.id;
  if (!adGroupId) {
    throw new Error('Não foi possível obter o ID do grupo de anúncios criado.');
  }

  // 3) Keywords
  result.keywords = [];
  for (const kw of keywords) {
    const k = await createKeyword({
      customerId,
      adGroupId,
      ...kw,
    });
    result.keywords.push(k);
  }

  // 4) Ads
  result.ads = [];
  for (const ad of ads) {
    const a = await createAd({
      customerId,
      adGroupId,
      ...ad,
    });
    result.ads.push(a);
  }

  console.log('[createFullCampaignFlow] result:', {
    campaignId,
    adGroupId,
    keywordsCount: result.keywords.length,
    adsCount: result.ads.length,
  });

  return result;
}
