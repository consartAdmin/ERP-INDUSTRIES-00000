// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersLogisticsHeader.repository.js — cabeçalho da logística       ║
// ║ get / create / getOrCreate / updateStatus / list                   ║
// ║ Tabela: "ordersLogistics"                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { BASE_SELECT_LOGISTICS } from './ordersLogistics.sql.js';

/**
 * Retorna o registro de logística por ID.
 */
export async function getLogisticsById(logistics_id) {
  const sql = `
    ${BASE_SELECT_LOGISTICS}
    WHERE logistics_id = $1;
  `;
  const { rows } = await pool.query(sql, [logistics_id]);
  return rows[0] || null;
}

/**
 * Retorna a logística vinculada a um pedido.
 * Se houver mais de uma (não deveria), devolve a mais recente.
 */
export async function getLogisticsByOrderId(order_id) {
  const sql = `
    ${BASE_SELECT_LOGISTICS}
    WHERE order_id = $1
    ORDER BY created_at DESC, logistics_id DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [order_id]);
  return rows[0] || null;
}

/**
 * Cria um registro de logística vinculado ao pedido.
 */
export async function createLogisticsForOrder({
  order_id,
  status = 'AGUARDANDO_SEPARACAO',
  nfe_key = null,
  nf_number = null,
  nf_series = null
}) {
  const sql = `
    INSERT INTO "ordersLogistics" (
      order_id,
      status,
      nfe_key,
      nf_number,
      nf_series,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
    RETURNING
      logistics_id,
      order_id,
      status,
      picker_user_id,
      checker_user_id,
      packer_user_id,
      shipper_user_id,
      picking_started_at,
      picking_finished_at,
      checking_started_at,
      checking_finished_at,
      packing_started_at,
      packing_finished_at,
      shipping_method,
      shipping_code,
      shipping_date,
      shipping_obs,
      nfe_key,
      nf_number,
      nf_series,
      blind_check_enabled,
      blind_check_status,
      has_discrepancy,
      discrepancy_note,
      created_at,
      updated_at;
  `;
  const params = [order_id, status, nfe_key, nf_number, nf_series];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

/**
 * Busca ou cria a logística para um pedido.
 */
export async function getOrCreateLogisticsForOrder(order_id, { nfe_key = null, nf_number = null, nf_series = null } = {}) {
  const existing = await getLogisticsByOrderId(order_id);
  if (existing) return existing;

  return createLogisticsForOrder({
    order_id,
    status: 'AGUARDANDO_SEPARACAO',
    nfe_key,
    nf_number,
    nf_series
  });
}

/**
 * Atualiza status e data/hora de uma etapa simples.
 */
export async function updateLogisticsStatus(logistics_id, status, extraFields = {}) {
  const allowedFields = [
    'picker_user_id',
    'checker_user_id',
    'packer_user_id',
    'shipper_user_id',
    'picking_started_at',
    'picking_finished_at',
    'checking_started_at',
    'checking_finished_at',
    'packing_started_at',
    'packing_finished_at',
    'shipping_method',
    'shipping_code',
    'shipping_date',
    'shipping_obs',
    'blind_check_enabled',
    'blind_check_status',
    'has_discrepancy',
    'discrepancy_note',
    'nfe_key',
    'nf_number',
    'nf_series'
  ];

  const sets = ['status = $1', 'updated_at = NOW()'];
  const values = [status];
  let idx = 2;

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(extraFields, field)) {
      sets.push(`"${field}" = $${idx++}`);
      values.push(extraFields[field]);
    }
  }

  values.push(logistics_id);

  const sql = `
    UPDATE "ordersLogistics"
       SET ${sets.join(', ')}
     WHERE logistics_id = $${idx}
    RETURNING
      logistics_id,
      order_id,
      status,
      picker_user_id,
      checker_user_id,
      packer_user_id,
      shipper_user_id,
      picking_started_at,
      picking_finished_at,
      checking_started_at,
      checking_finished_at,
      packing_started_at,
      packing_finished_at,
      shipping_method,
      shipping_code,
      shipping_date,
      shipping_obs,
      nfe_key,
      nf_number,
      nf_series,
      blind_check_enabled,
      blind_check_status,
      has_discrepancy,
      discrepancy_note,
      created_at,
      updated_at;
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

/**
 * Lista processos logísticos por status (ex.: AGUARDANDO_SEPARACAO).
 */
export async function listLogisticsByStatus(status) {
  const sql = `
    ${BASE_SELECT_LOGISTICS}
    WHERE status = $1
    ORDER BY created_at DESC, logistics_id DESC;
  `;
  const { rows } = await pool.query(sql, [status]);
  return rows;
}

/**
 * Lista todos (opcionalmente apenas "abertos").
 */
export async function listAllLogistics({ onlyOpen = false } = {}) {
  let where = 'WHERE 1=1';

  if (onlyOpen) {
    where += ` AND status NOT IN ('ENTREGUE', 'CANCELADO')`;
  }

  const sql = `
    ${BASE_SELECT_LOGISTICS}
    ${where}
    ORDER BY created_at DESC, logistics_id DESC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}
