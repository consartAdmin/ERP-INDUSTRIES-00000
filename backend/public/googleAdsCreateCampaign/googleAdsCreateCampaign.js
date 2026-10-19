// ╔══════════════════════════════════════════════════════════════╗
// ║ googleAdsCreateCampaign.js — Criar Campanha Google Ads       ║
// ║ Fluxo: campanha → ad group → keywords → anúncio              ║
// ║ PRODNEX ERP (ESM)                                            ║
// ╚══════════════════════════════════════════════════════════════╝

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

/* ------------------------------------------------------------------ */
/* Utilitários                                                        */
/* ------------------------------------------------------------------ */

function $(sel) {
  return document.querySelector(sel);
}

function showStatus(message, type = 'info') {
  const el = $('#gaCreateStatus');
  if (!el) return;
  el.textContent = message || '';

  el.classList.remove('ga-status-text--ok', 'ga-status-text--error');

  if (type === 'ok') el.classList.add('ga-status-text--ok');
  if (type === 'error') el.classList.add('ga-status-text--error');
}

// -------------------------------------------------------------------
// Helper genérico de POST JSON (sem .map, só devolve o payload)
// -------------------------------------------------------------------
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  // Se a API retornou erro HTTP OU ok:false
  if (!res.ok || (data && data.ok === false)) {
    const msg =
      (data && (data.error || data.message)) ||
      `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }

  // 🔹 NÃO faz .map aqui, só devolve tudo como veio
  // ex: { ok, campaign, adGroup, keywords, ads }
  return data;
}

/**
 * Normaliza data (input date → YYYY-MM-DD) ou retorna undefined.
 */
function normalizeDateInput(el) {
  if (!el) return undefined;
  const v = (el.value || '').trim();
  if (!v) return undefined;
  // value de input[type="date"] já vem em YYYY-MM-DD, só validamos
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return v;
}

/**
 * Converte número simples de R$ (ex: 50.5 ou "50,50") em float.
 */
function parseMoney(value) {
  if (value == null) return 0;
  let v = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lê o textarea de keywords e devolve [{ text, matchType }, ...].
 * Por padrão: matchType = "BROAD".
 */
function parseKeywords(rawText) {
  if (!rawText) return [];
  return rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({
      text,
      matchType: 'BROAD', // poderemos expor no futuro na UI
    }));
}

/* ------------------------------------------------------------------ */
/* Validação simples do formulário                                   */
/* ------------------------------------------------------------------ */

function readFormValues() {
  const campaignName = $('#gaCampaignName')?.value.trim() || '';
  const dailyBudgetStr = $('#gaDailyBudget')?.value || '';
  const adGroupName = $('#gaAdGroupName')?.value.trim() || '';
  const cpcBidStr = $('#gaCpcBid')?.value || '';
  const keywordsRaw = $('#gaKeywordsInput')?.value || '';
  const headline1 = $('#gaHeadline1')?.value.trim() || '';
  const headline2 = $('#gaHeadline2')?.value.trim() || '';
  const headline3 = $('#gaHeadline3')?.value.trim() || '';
  const description = $('#gaDescription')?.value.trim() || '';
  const finalUrl = $('#gaFinalUrl')?.value.trim() || '';

  const startDate = normalizeDateInput($('#gaStartDate'));
  const endDate = normalizeDateInput($('#gaEndDate'));

  const dailyBudget = parseMoney(dailyBudgetStr);
  const cpcBid = parseMoney(cpcBidStr);

  const keywords = parseKeywords(keywordsRaw);

  const errors = [];

  if (!campaignName) errors.push('Informe o nome da campanha.');
  if (!dailyBudget || dailyBudget <= 0)
    errors.push('Informe um orçamento diário válido.');
  if (!adGroupName) errors.push('Informe o nome do grupo de anúncios.');
  if (!cpcBid || cpcBid <= 0)
    errors.push('Informe um CPC máximo válido.');
  if (!keywords.length)
    errors.push('Informe pelo menos uma palavra-chave.');
  if (!headline1) errors.push('Informe o Título 1 do anúncio.');
  if (!headline2) errors.push('Informe o Título 2 do anúncio.');
  if (!description) errors.push('Informe a descrição do anúncio.');
  if (!finalUrl) errors.push('Informe a URL final do anúncio.');

  return {
    values: {
      campaignName,
      dailyBudget,
      startDate,
      endDate,
      adGroupName,
      cpcBid,
      keywords,
      headline1,
      headline2,
      headline3,
      description,
      finalUrl,
    },
    errors,
  };
}

/* ------------------------------------------------------------------ */
/* Fluxo principal: criar tudo em 1 clique                            */
/* ------------------------------------------------------------------ */

async function handleCreateCampaignClick() {
  const btn = $('#gaBtnCreateCampaign');
  if (!btn) return;

  const { values, errors } = readFormValues();

  if (errors.length) {
    showStatus(errors.join(' '), 'error');
    return;
  }

  showStatus('Iniciando criação da campanha no Google Ads...');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Criando...';

  try {
    // 1) Cria CAMPANHA
    showStatus('Criando campanha...', 'info');

    const campaignPayload = {
      name: values.campaignName,
      dailyBudget: values.dailyBudget, // em R$, backend converte para micros
      startDate: values.startDate,
      endDate: values.endDate,
    };

    const campaignResp = await postJson(
      '/api/googleads/campaigns/create',
      campaignPayload
    );

    const campaign = campaignResp.campaign || campaignResp.data || campaignResp;
    const campaignId =
      campaign.id ||
      campaign.campaignId ||
      campaign.campaign_id ||
      campaign.resourceName ||
      campaign.resource_name;

    if (!campaignId) {
      throw new Error(
        'Não foi possível determinar o ID da campanha retornado pela API.'
      );
    }

    // 2) Cria AD GROUP
    showStatus('Criando grupo de anúncios...', 'info');

    const adGroupPayload = {
      campaignId: campaignId,
      name: values.adGroupName,
      cpcBid: values.cpcBid, // em R$, backend converte para micros
    };

    const adGroupResp = await postJson(
      '/api/googleads/adgroups/create',
      adGroupPayload
    );

    const adGroup =
      adGroupResp.adGroup || adGroupResp.data || adGroupResp;
    const adGroupId =
      adGroup.id ||
      adGroup.adGroupId ||
      adGroup.ad_group_id ||
      adGroup.resourceName ||
      adGroup.resource_name;

    if (!adGroupId) {
      throw new Error(
        'Não foi possível determinar o ID do grupo de anúncios retornado pela API.'
      );
    }

    // 3) Cria KEYWORDS (se houve alguma)
    if (values.keywords.length) {
      showStatus('Criando palavras-chave...', 'info');

      const keywordsPayload = {
        adGroupId: adGroupId,
        keywords: values.keywords,
      };

      await postJson('/api/googleads/keywords/create', keywordsPayload);
    }

    // 4) Cria AD
    showStatus('Criando anúncio...', 'info');

    const adPayload = {
      adGroupId: adGroupId,
      headline1: values.headline1,
      headline2: values.headline2,
      headline3: values.headline3 || undefined,
      description: values.description,
      finalUrl: values.finalUrl,
    };

    await postJson('/api/googleads/ads/create', adPayload);

    // Sucesso!
    showStatus(
      '✅ Campanha, grupo, palavras-chave e anúncio criados com sucesso!',
      'ok'
    );
    alert('Campanha criada com sucesso no Google Ads!');

  } catch (err) {
    console.error('[googleAdsCreateCampaign] erro no fluxo:', err);
    showStatus(
      `❌ Erro ao criar a campanha: ${err.message || err}`,
      'error'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  const btn = $('#gaBtnCreateCampaign');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleCreateCampaignClick();
    });
  }
});
