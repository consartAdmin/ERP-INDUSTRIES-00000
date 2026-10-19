// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.utils.js — Helpers básicos e de information_schema           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PSL } from './budgets.constants.js';

// ----------------------------------------------------------------------
// Helpers básicos
// ----------------------------------------------------------------------
export async function normalizeExistingLotId(client, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const lotId = Number(value);

  if (!Number.isSafeInteger(lotId) || lotId <= 0) {
    return null;
  }

  const result = await client.query(
    `
      SELECT lot_id
      FROM ${TB_PSL}
      WHERE lot_id = $1
      LIMIT 1
    `,
    [lotId],
  );

  return result.rowCount
    ? Number(result.rows[0].lot_id)
    : null;
}

export const isFiniteNum = (v) => Number.isFinite(Number(v));

export function boolFromAny(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(s);
}

export function safeString(v, max = 2000) {
  return String(v ?? '').trim().slice(0, max);
}

export function pickFrom(obj, keys = []) {
  for (const k of keys) {
    if (obj?.[k] !== undefined) return obj[k];
  }
  return undefined;
}

export function coalesceName(row) {
  return row.customer_name ?? null;
}

export function coalesceTaxId(row) {
  return row.customer_tax_id ?? null;
}

export function normalizeMoney(v, def = 0) {
  if (v === null || v === undefined || v === '') return Number(def);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v) : Number(def);

  let s = String(v).trim();
  if (!s) return Number(def);

  s = s.replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');

  const n = Number(s);
  return Number.isFinite(n) ? Number(n) : Number(def);
}

// ----------------------------------------------------------------------
// Information schema helpers
// ----------------------------------------------------------------------
export async function getTableColumns(client, schema, table) {
  const sql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
    `;
  const r = await client.query(sql, [schema, table]);
  return new Set((r.rows || []).map((x) => String(x.column_name)));
}

export async function tableExists(client, schema, table) {
  const sql = `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
      LIMIT 1
    `;
  const r = await client.query(sql, [schema, table]);
  return r.rowCount > 0;
}

export function pickFirstExisting(setCols, candidates = []) {
  for (const c of candidates) {
    if (setCols.has(c)) return c;
  }
  return null;
}
