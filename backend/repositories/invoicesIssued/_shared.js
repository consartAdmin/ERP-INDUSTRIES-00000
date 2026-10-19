// ╔══════════════════════════════════════════════════════════════════════╗
// ║ _shared.js — CONSART ERP | Notas Fiscais Emitidas (infra interna)    ║
// ║ Pool, tabelas, schema do catálogo, normalizadores e mapeador de linha ║
// ║                                                                      ║
// ║ ⚠️  Este é o ÚNICO arquivo do módulo com imports externos.            ║
// ║     Se algum caminho abaixo mudar, corrija apenas aqui.               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { createAuditLog } from '../auditLogs/auditLogs.index.js';

import {
  INVOICES_ISSUED_TABLE as TB_INVOICES,
  INVOICES_ISSUED_INSERT_COLUMNS,
  INVOICES_ISSUED_UPDATE_COLUMNS,
  INVOICES_ISSUED_PRIMARY_KEY,
} from './invoicesIssued.catalog.js';

export { pool, createAuditLog };

export {
  TB_INVOICES,
  INVOICES_ISSUED_INSERT_COLUMNS,
  INVOICES_ISSUED_UPDATE_COLUMNS,
  INVOICES_ISSUED_PRIMARY_KEY,
};

// ======================================================================
// Tabelas
// ======================================================================
export const TABLES = Object.freeze({
  invoicesIssued: TB_INVOICES,
  orders: 'public."orders"',
  ordersItems: 'public."ordersItems"',
  ordersNfeAttempts: 'public."ordersNfeAttempts"',
  ordersNfeAttemptItems: 'public."ordersNfeAttemptItems"',
  budgets: 'public."budgets"',
  budgetsNfeAttempts: 'public."budgetsNfeAttempts"',
  budgetsNfeAttemptItems: 'public."budgetsNfeAttemptItems"',
  nfeBonus: 'public."nfeBonus"',
  nfeStatusMap: 'public."nfeStatusMap"',
  auditLogs: 'public."auditLogs"',
});

export const TB_ORDERS = TABLES.orders;
export const TB_ORDER_ITEMS = TABLES.ordersItems;
export const TB_ORDER_NFE_ATTEMPTS = TABLES.ordersNfeAttempts;
export const TB_AUDIT_LOGS = TABLES.auditLogs;
export const TB_BUDGETS = TABLES.budgets;
export const TB_BONUS = TABLES.nfeBonus;
export const TB_NFE_STATUS_MAP = TABLES.nfeStatusMap;

// ======================================================================
// Status da NF-e
// ======================================================================
export function normalizeNfeStatusCode(value) {
  const status = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const aliases = {
    PENDENTE: 'PENDENTE',

    PROCESSANDO: 'PROCESSANDO',
    PROCESSAMENTO: 'PROCESSANDO',

    AUTORIZADA: 'AUTORIZADO',
    AUTORIZADO: 'AUTORIZADO',
    AUTHORIZED: 'AUTORIZADO',
    CONCLUIDO: 'AUTORIZADO',
    CONCLUIDA: 'AUTORIZADO',

    REJEITADA: 'REJEITADO',
    REJEITADO: 'REJEITADO',

    CANCELADA: 'CANCELADO',
    CANCELADO: 'CANCELADO',

    DENEGADA: 'DENEGADO',
    DENEGADO: 'DENEGADO',

    INUTILIZADA: 'INUTILIZADO',
    INUTILIZADO: 'INUTILIZADO',

    ERRO: 'ERRO',
  };

  return aliases[status] || status || null;
}

export async function resolveNfeStatus(code, db = pool) {
  const normalizedCode = normalizeNfeStatusCode(code);

  if (!normalizedCode) {
    return null;
  }

  const { rows } = await db.query(
    `
      SELECT
        nfe_status_id,
        code,
        name,
        description,
        is_final,
        is_authorized,
        is_active
      FROM ${TB_NFE_STATUS_MAP}
      WHERE code = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [normalizedCode]
  );

  return rows[0] || null;
}

// ======================================================================
// Normalizadores
// ======================================================================
export function normalizeMoney(value, def = 0) {
  const n = Number(value ?? def);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : Number(def);
}

export function normalizeText(value, def = null) {
  if (value === undefined || value === null) return def;
  const s = String(value).trim();
  return s || def;
}

export function normalizeUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeBrazilianDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(value);
  }
  const raw = String(value).trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function normalizeBrazilianDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const br = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (br) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = br;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ======================================================================
// Transação
// ======================================================================
export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ======================================================================
// Mapeador de resposta
// ======================================================================
export function rowToInvoice(row) {
  if (!row) return null;

  return {
    invoice_id: row.invoice_id,
    order_id: row.order_id,

    budget_id:
      row.budget_id ?? null,

    bonus_id:
      row.bonus_id ?? null,

    source_type:
      row.source_type ||
      (
        row.budget_id
          ? 'BUDGET'
          : row.bonus_id
            ? 'BONUS'
            : 'ORDER'
      ),

    // ID interno da PlugNotas / TecnoSpeed
    // Usado para operações como cancelamento e consulta do evento.
    nfe_provider_id:
      row.nfe_provider_id ?? null,

    nfe_number:
      row.nfe_number,

    nfe_key:
      row.nfe_key,

    nfe_status_id:
      row.nfe_status_id ?? null,

    nfe_status:
      row.nfe_status_code ||
      row.nfe_status ||
      null,

    nfe_status_name:
      row.nfe_status_name ||
      null,

    nfe_protocol:
      row.nfe_protocol,

    nfe_environment:
      row.nfe_environment,

    xml_url:
      row.xml_url,

    danfe_url:
      row.danfe_url,

    issued_at:
      row.issued_at,

    issued_date:
      row.issued_date,

    cancelled_at:
      row.cancelled_at,

    cancellation_reason:
      row.cancellation_reason,

    total_amount:
      Number(row.total_amount || 0),

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,

    order_number:
      row.order_number ?? null,

    customer_name:
      row.customer_name ?? null,

    customer_tax_id:
      row.customer_tax_id ?? null,

    order_email:
      row.order_email ?? null,

    customer_email:
      row.customer_email ?? null,

    final_email:
      row.final_email ?? null,
  };
}
