// ╔════════════════════════════════════════════════════════════════════╗
// ║ deliveryLabelsCrud.repository.js — create / list / get / update /  ║
// ║ delete de etiquetas de entrega                                     ║
// ║ Tabela: public."deliveryLabels"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { normalizeText, normalizeNumber } from './deliveryLabels.sanitizers.js';

export async function createDeliveryLabel(data = {}) {
  const volumes = Math.max(1, Number(data.volumes || 1));

  const sql = `
    INSERT INTO public."deliveryLabels" (
      order_id,
      invoice_id,
      nfe_key,
      nfe_number,
      order_number,
      customer_name,
      customer_tax_id,
      phone,
      address,
      number,
      complement,
      neighborhood,
      city,
      state,
      zip_code,
      volumes,
      weight,
      delivery_status,
      driver_name,
      route_name,
      notes
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )
    RETURNING *
  `;

  const params = [
    normalizeNumber(data.order_id),
    normalizeNumber(data.invoice_id),
    normalizeText(data.nfe_key),
    normalizeText(data.nfe_number),
    normalizeText(data.order_number),
    normalizeText(data.customer_name),
    normalizeText(data.customer_tax_id),
    normalizeText(data.phone),
    normalizeText(data.address),
    normalizeText(data.number),
    normalizeText(data.complement),
    normalizeText(data.neighborhood),
    normalizeText(data.city),
    normalizeText(data.state),
    normalizeText(data.zip_code),
    volumes,
    normalizeNumber(data.weight),
    normalizeText(data.delivery_status) || 'AGUARDANDO_SEPARACAO',
    normalizeText(data.driver_name),
    normalizeText(data.route_name),
    normalizeText(data.notes),
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

export async function listDeliveryLabels(filters = {}) {
  const where = [];
  const params = [];

  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    where.push(`(
      customer_name ILIKE $${params.length}
      OR customer_tax_id ILIKE $${params.length}
      OR order_number ILIKE $${params.length}
      OR nfe_number ILIKE $${params.length}
      OR city ILIKE $${params.length}
    )`);
  }

  if (filters.status) {
    params.push(String(filters.status).trim());
    where.push(`delivery_status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(1, Number(filters.limit) || 100), 500);
  const page = Math.max(1, Number(filters.page) || 1);

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public."deliveryLabels" ${whereSql}`,
    params
  );

  const sql = `
    SELECT *
    FROM public."deliveryLabels"
    ${whereSql}
    ORDER BY created_at DESC, delivery_label_id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const { rows } = await pool.query(sql, [...params, limit, (page - 1) * limit]);

  return { rows, total: countRows[0]?.total ?? rows.length, page, limit };
}

export async function getDeliveryLabelById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM public."deliveryLabels" WHERE delivery_label_id = $1`,
    [id]
  );

  return rows[0] || null;
}

export async function updateDeliveryLabel(id, data = {}) {
  const sql = `
    UPDATE public."deliveryLabels"
    SET
      nfe_key = COALESCE($2, nfe_key),
      nfe_number = COALESCE($3, nfe_number),
      order_number = COALESCE($4, order_number),
      customer_name = COALESCE($5, customer_name),
      customer_tax_id = COALESCE($6, customer_tax_id),
      phone = COALESCE($7, phone),
      address = COALESCE($8, address),
      number = COALESCE($9, number),
      complement = COALESCE($10, complement),
      neighborhood = COALESCE($11, neighborhood),
      city = COALESCE($12, city),
      state = COALESCE($13, state),
      zip_code = COALESCE($14, zip_code),
      volumes = COALESCE($15, volumes),
      weight = COALESCE($16, weight),
      delivery_status = COALESCE($17, delivery_status),
      driver_name = COALESCE($18, driver_name),
      route_name = COALESCE($19, route_name),
      notes = COALESCE($20, notes),
      updated_at = NOW()
    WHERE delivery_label_id = $1
    RETURNING *
  `;

  const params = [
    id,
    normalizeText(data.nfe_key),
    normalizeText(data.nfe_number),
    normalizeText(data.order_number),
    normalizeText(data.customer_name),
    normalizeText(data.customer_tax_id),
    normalizeText(data.phone),
    normalizeText(data.address),
    normalizeText(data.number),
    normalizeText(data.complement),
    normalizeText(data.neighborhood),
    normalizeText(data.city),
    normalizeText(data.state),
    normalizeText(data.zip_code),
    data.volumes ? Number(data.volumes) : null,
    normalizeNumber(data.weight),
    normalizeText(data.delivery_status),
    normalizeText(data.driver_name),
    normalizeText(data.route_name),
    normalizeText(data.notes),
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function deleteDeliveryLabel(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM public."deliveryLabels" WHERE delivery_label_id = $1`,
    [id]
  );

  return rowCount > 0;
}
