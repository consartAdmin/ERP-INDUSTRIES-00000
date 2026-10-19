// ╔════════════════════════════════════════════════════════════════════╗
// ║ googleAdsDashboard.repository.js — Resumos / séries do dashboard   ║
// ║ Tabelas: "googleAdsMetricsAdGroupDaily", "googleAdsCampaigns"      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/* ============================================================================
 * DASHBOARD / RESUMOS
 * ========================================================================== */

export async function getDashboardSummary(filters = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;

  if (filters.campaign_id) {
    values.push(filters.campaign_id);
    conditions.push(`campaign_id = $${idx++}`);
  }

  if (filters.ad_group_id) {
    values.push(filters.ad_group_id);
    conditions.push(`ad_group_id = $${idx++}`);
  }

  if (filters.date_from) {
    values.push(filters.date_from);
    conditions.push(`report_date >= $${idx++}`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    conditions.push(`report_date <= $${idx++}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      COALESCE(SUM(impressions), 0)::BIGINT      AS impressions,
      COALESCE(SUM(clicks), 0)::BIGINT           AS clicks,
      COALESCE(SUM(cost_micros), 0)::BIGINT      AS cost_micros,
      COALESCE(SUM(conversions), 0)::NUMERIC     AS conversions,
      COALESCE(SUM(conversions_value), 0)::NUMERIC AS conversions_value
    FROM "googleAdsMetricsAdGroupDaily"
    ${where}
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || {
    impressions: 0,
    clicks: 0,
    cost_micros: 0,
    conversions: 0,
    conversions_value: 0,
  };
}

export async function getCampaignPerformance(filters = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;

  if (filters.date_from) {
    values.push(filters.date_from);
    conditions.push(`m.report_date >= $${idx++}`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    conditions.push(`m.report_date <= $${idx++}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      c.id,
      c.campaign_name,
      c.campaign_google_id,
      c.status,
      COALESCE(SUM(m.impressions), 0)::BIGINT AS impressions,
      COALESCE(SUM(m.clicks), 0)::BIGINT AS clicks,
      COALESCE(SUM(m.cost_micros), 0)::BIGINT AS cost_micros,
      COALESCE(SUM(m.conversions), 0)::NUMERIC AS conversions,
      COALESCE(SUM(m.conversions_value), 0)::NUMERIC AS conversions_value
    FROM "googleAdsCampaigns" c
    LEFT JOIN "googleAdsMetricsAdGroupDaily" m
      ON m.campaign_id = c.id
    ${where}
    GROUP BY c.id, c.campaign_name, c.campaign_google_id, c.status
    ORDER BY c.campaign_name ASC
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function getDailySeries(filters = {}) {
  const values = [];
  const conditions = [];
  let idx = 1;

  if (filters.campaign_id) {
    values.push(filters.campaign_id);
    conditions.push(`campaign_id = $${idx++}`);
  }

  if (filters.ad_group_id) {
    values.push(filters.ad_group_id);
    conditions.push(`ad_group_id = $${idx++}`);
  }

  if (filters.date_from) {
    values.push(filters.date_from);
    conditions.push(`report_date >= $${idx++}`);
  }

  if (filters.date_to) {
    values.push(filters.date_to);
    conditions.push(`report_date <= $${idx++}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      report_date,
      COALESCE(SUM(impressions), 0)::BIGINT AS impressions,
      COALESCE(SUM(clicks), 0)::BIGINT AS clicks,
      COALESCE(SUM(cost_micros), 0)::BIGINT AS cost_micros,
      COALESCE(SUM(conversions), 0)::NUMERIC AS conversions,
      COALESCE(SUM(conversions_value), 0)::NUMERIC AS conversions_value
    FROM "googleAdsMetricsAdGroupDaily"
    ${where}
    GROUP BY report_date
    ORDER BY report_date ASC
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}
