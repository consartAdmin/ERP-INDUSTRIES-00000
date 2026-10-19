// ╔════════════════════════════════════════════════════════════╗
// ║ roletaController.js — Controller Roleta (CONSART ERP)      ║
// ║ Path: backend/controllers/roletaController.js              ║
// ╚════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import * as api from '../repositories/roleta/roleta.index.js';

function nowUtc() {
  return new Date();
}

function parseIsoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinDates(now, starts_at, ends_at) {
  if (starts_at && now < starts_at) return false;
  if (ends_at && now > ends_at) return false;
  return true;
}

function weightedRandom(products) {
  // defensive: ensure weights >= 1
  const safe = products
    .map(p => ({ ...p, weight: Math.max(1, Number(p.weight || 1)) }))
    .filter(p => p && p.product_code);

  const total = safe.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return safe[0];

  let r = Math.random() * total;
  for (const p of safe) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return safe[safe.length - 1];
}

function httpError(res, status, message) {
  return res.status(status).json({ error: message });
}

/**
 * POST /api/roleta/token
 * body: { campaign_id, customer_id, expires_at? }
 */
export async function createToken(req, res) {
  try {
    const { campaign_id, customer_id, expires_at } = req.body || {};

    const token = await api.createToken({
      campaign_id,
      customer_id,
      expires_at
    });

    return res.json({
      success: true,
      token,
      url: `/roleta/roleta.html?t=${token}`
    });

  } catch (err) {
    console.error('[roleta.createToken] error:', err);
    return httpError(res, err.status || 500, err.message || 'Erro ao criar token');
  }
}

/**
 * GET /api/roleta/:token
 */
export async function getCampaign(req, res) {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return httpError(res, 400, 'Token ausente');

    const data = await api.getTokenData(token);
    if (!data) return httpError(res, 403, 'Token inválido');

    // token active?
    if (!data.token_is_active) return httpError(res, 403, 'Token inválido');

    // token expired?
    const exp = parseIsoOrNull(data.expires_at);
    if (exp && nowUtc() > exp) return httpError(res, 403, 'Token expirado');

    // campaign active?
    if (!data.campaign_is_active) return httpError(res, 403, 'Campanha inativa');

    // campaign window?
    const starts = parseIsoOrNull(data.starts_at);
    const ends = parseIsoOrNull(data.ends_at);
    if (!isWithinDates(nowUtc(), starts, ends)) {
      return httpError(res, 403, 'Campanha fora do período');
    }

    const products = await api.getCampaignProducts(data.campaign_id);

    return res.json({
      campaign: {
        id: data.campaign_id,
        name: data.campaign_name,
        max_spins_per_customer: data.max_spins_per_customer
      },
      customer: {
        customer_id: data.customer_id
      },
      products
    });

  } catch (err) {
    console.error('[roleta.getCampaign] error:', err);
    return httpError(res, 500, 'Erro ao carregar campanha');
  }
}

/**
 * POST /api/roleta/:token/spin
 * Secure server-side draw, with transaction + token lock.
 */
export async function spin(req, res) {
  const token = String(req.params.token || '').trim();
  if (!token) return httpError(res, 400, 'Token ausente');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // lock token row
    const tokenData = await api.getTokenDataForUpdate(client, token);

    if (!tokenData) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Token inválido');
    }

    if (!tokenData.token_is_active) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Token inválido');
    }

    const exp = parseIsoOrNull(tokenData.expires_at);
    if (exp && nowUtc() > exp) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Token expirado');
    }

    if (!tokenData.campaign_is_active) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Campanha inativa');
    }

    const starts = parseIsoOrNull(tokenData.starts_at);
    const ends = parseIsoOrNull(tokenData.ends_at);
    if (!isWithinDates(nowUtc(), starts, ends)) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Campanha fora do período');
    }

    const spinsCount = await api.countCustomerSpins(
      client,
      tokenData.campaign_id,
      tokenData.customer_id
    );

    if (spinsCount >= Number(tokenData.max_spins_per_customer || 1)) {
      await client.query('ROLLBACK');
      return httpError(res, 403, 'Limite de giros atingido');
    }

    // products list (outside tx is ok, but keep in tx for consistency)
    const products = await api.getCampaignProducts(tokenData.campaign_id);
    if (!products.length) {
      await client.query('ROLLBACK');
      return httpError(res, 400, 'Nenhum produto disponível');
    }

    const winner = weightedRandom(products);

    await api.saveSpin(client, {
      campaign_id: tokenData.campaign_id,
      customer_id: tokenData.customer_id,
      token,
      product_code: winner.product_code
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      prize: winner
    });

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[roleta.spin] error:', err);
    return httpError(res, 500, 'Erro ao girar roleta');
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────────
// ADMIN: Campaigns / Products / Tokens / Spins
// ──────────────────────────────────────────────────────────────

export async function adminListCampaigns(req, res) {
  try {
    const q = (req.query.q || '').toString().trim();
    const items = await api.listCampaigns({ q });
    return res.json({ items });
  } catch (err) {
    console.error('[roleta.adminListCampaigns] error:', err);
    return res.status(500).json({ error: 'Erro ao listar campanhas' });
  }
}

export async function adminCreateCampaign(req, res) {
  try {
    const {
      name,
      description,
      starts_at,
      ends_at,
      max_spins_per_customer,
      is_active
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const created = await api.createCampaign({
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      max_spins_per_customer: Math.max(1, Number(max_spins_per_customer || 1)),
      is_active: !!is_active
    });

    return res.json({ id: created.id, name: created.name });
  } catch (err) {
    console.error('[roleta.adminCreateCampaign] error:', err);
    return res.status(500).json({ error: 'Erro ao criar campanha' });
  }
}

export async function adminListCampaignProducts(req, res) {
  try {
    const campaign_id = Number(req.params.id);
    if (!campaign_id) return res.status(400).json({ error: 'campaign_id inválido' });

    const items = await api.listCampaignProductsAdmin(campaign_id);
    return res.json({ items });
  } catch (err) {
    console.error('[roleta.adminListCampaignProducts] error:', err);
    return res.status(500).json({ error: 'Erro ao listar produtos da campanha' });
  }
}

export async function adminAddCampaignProduct(req, res) {
  try {
    const campaign_id = Number(req.params.id);
    if (!campaign_id) return res.status(400).json({ error: 'campaign_id inválido' });

    const { product_code, weight, is_active } = req.body || {};
    if (!product_code) return res.status(400).json({ error: 'product_code é obrigatório' });

    await api.addCampaignProduct({
      campaign_id,
      product_code: String(product_code).trim(),
      weight: Math.max(1, Number(weight || 1)),
      is_active: !!is_active
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[roleta.adminAddCampaignProduct] error:', err);
    return res.status(500).json({ error: 'Erro ao adicionar produto na campanha' });
  }
}

export async function adminRemoveCampaignProduct(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    await api.removeCampaignProductById(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('[roleta.adminRemoveCampaignProduct] error:', err);
    return res.status(500).json({ error: 'Erro ao remover produto da campanha' });
  }
}

export async function adminListTokens(req, res) {
  try {
    const campaign_id = Number(req.query.campaign_id);
    const q = (req.query.q || '').toString().trim();

    if (!campaign_id) return res.status(400).json({ error: 'campaign_id é obrigatório' });

    const items = await api.listTokensAdmin({ campaign_id, q });
    return res.json({ items });
  } catch (err) {
    console.error('[roleta.adminListTokens] error:', err);
    return res.status(500).json({ error: 'Erro ao listar tokens' });
  }
}

export async function adminListSpins(req, res) {
  try {
    const campaign_id = Number(req.query.campaign_id);
    const customer_id = (req.query.customer_id || '').toString().trim() || null;

    if (!campaign_id) return res.status(400).json({ error: 'campaign_id é obrigatório' });

    const items = await api.listSpinsAdmin({ campaign_id, customer_id });
    return res.json({ items });
  } catch (err) {
    console.error('[roleta.adminListSpins] error:', err);
    return res.status(500).json({ error: 'Erro ao listar giros' });
  }
}