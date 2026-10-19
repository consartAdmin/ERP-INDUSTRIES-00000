// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.utils.js — Helpers (query, paths GCS, ordenação,     ║
// ║ leitura de payload com aliases antigos)                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import pool from '../../config/db.js';
import { CAIXA_PREFIX } from './cashMoviments.constants.js';

// "Dedutível no PIS/COFINS" (crédito na apuração do Lucro Real).
// NULL = sem escolha: a apuração usa a subcategoria C.M.V como padrão.
let taxColumnsReady = null;

export function ensureCashTaxColumns() {
  taxColumnsReady ??= pool.query(`
    ALTER TABLE "cashMoviments"
      ADD COLUMN IF NOT EXISTS is_pis_cofins_creditable BOOLEAN NULL,
      ADD COLUMN IF NOT EXISTS deduct_charges_only BOOLEAN NULL
  `).catch((error) => {
    taxColumnsReady = null;
    throw error;
  });

  return taxColumnsReady;
}

export async function q(text, params = []) {
  await ensureCashTaxColumns();
  return pool.query(text, params);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function slugifyFileName(name) {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildCaixaObjectPath({ movimentacao_id, filename, date = new Date() }) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const safe = slugifyFileName(filename);
  const ts = Math.floor(Date.now() / 1000);

  return `${CAIXA_PREFIX}/${y}/${m}/${d}/mov-${movimentacao_id}/${ts}-${safe}`;
}

export function resolvePublicFile(fileUrl) {
  const raw = String(fileUrl || '').trim();

  if (raw.startsWith('/public/')) {
    const relative = raw.replace(/^\/public\//, '');

    const candidates = [
      path.resolve(process.cwd(), 'public', relative),
      path.resolve(process.cwd(), 'backend', 'public', relative),
    ];

    return candidates.find((p) => fs.existsSync(p)) || null;
  }

  if (raw.startsWith('https://storage.googleapis.com/')) {
    return raw;
  }

  return null;
}

export function normalizeOrderColumn(col) {
  const map = {
    data_hora: 'movement_date',
    tipo_movimentacao: 'movement_type',
    conta_caixa: 'cash_account',
    valor: 'amount',

    movement_date: 'movement_date',
    movement_type: 'movement_type',
    cash_account: 'cash_account',
    amount: 'amount',
  };

  return map[col] || col;
}

export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return '';

  const [rawCol, dirRaw] = String(orderBy).trim().split(/\s+/);
  const col = normalizeOrderColumn(rawCol);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';

  return colSafe ? ` ORDER BY m.${colSafe} ${dir} ` : '';
}

export function getPayloadValue(payload, keys = []) {
  for (const key of keys) {
    if (payload?.[key] !== undefined) return payload[key];
  }

  return undefined;
}

export function getMovementPayloadValue(payload, column) {
  const map = {
    movement_date: ['movement_date', 'data_hora'],
    movement_type: ['movement_type', 'tipo_movimentacao'],
    cash_account: ['cash_account', 'conta_caixa'],
    amount: ['amount', 'valor'],
    document_type: ['document_type', 'tipo_documento'],
    document_number: ['document_number', 'numero_documento'],
    supplier_name: ['supplier_name', 'fornecedor'],
    notes: ['notes', 'observacao'],
    penalty_amount: ['penalty_amount', 'multa'],
    interest_amount: ['interest_amount', 'juros'],
    fee_amount: ['fee_amount', 'encargos'],
    category: ['category', 'categoria'],
    subcategory: ['subcategory', 'subcategoria'],
    is_deductible: ['is_deductible'],
    is_pis_cofins_creditable: ['is_pis_cofins_creditable'],
    deduct_charges_only: ['deduct_charges_only'],
    is_active: ['is_active'],
  };

  return getPayloadValue(payload, map[column] || [column]);
}
