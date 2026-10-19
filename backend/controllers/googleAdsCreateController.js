// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCreateController.js — CONSART ERP                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  createCampaign,
  createAdGroup,
  createKeyword,
  createAd,
  createFullCampaignFlow
} from '../services/googleAdsCreateService.js';

// ----------------------------------------------------------------------
// Criar campanha simples
// ----------------------------------------------------------------------
export async function postCreateCampaign(req, res) {
  try {
    const result = await createCampaign(req.body);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[postCreateCampaign]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ----------------------------------------------------------------------
// Criar conjunto completo (1 clique)
// ----------------------------------------------------------------------
export async function postCreateFullFlow(req, res) {
  try {
    const result = await createFullCampaignFlow(req.body);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[postCreateFullFlow]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
