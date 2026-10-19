// ╔══════════════════════════════════════════════════════════════════════════╗
/* ║ parametrosFiscaisController.js – Sequência & Ambiente da NF-e (ESM)    ║
   ║ Tabelas:
   ║   • "sequenciaNf-e"  (id PK, empresa_id, filial_id, modelo, serie,
   ║                       proximo_numero, ultimo_autorizado, ultimo_atualizado)
   ║   • "nfeAmbiente"    (id PK, empresa_id, tp_amb, updated_at, updated_by, motivo)
   ║ Observação: "sequenciaNf-e" possui hífen → sempre usar aspas duplas no SQL.
*/
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* =========================
   Sequência – GET / PUT
   ========================= */
export const getSequencia = ah(async (_req, res) => {
  const sql = `select id, empresa_id, filial_id, modelo, serie,
                      proximo_numero, ultimo_autorizado, ultimo_atualizado
                 from "sequenciaNf-e"
                where id = 1`;
  const { rows } = await pool.query(sql);
  res.json({ ok: true, data: rows[0] || null });
});

export const putSequencia = ah(async (req, res) => {
  const {
    empresa_id = 1,
    filial_id = 1,
    modelo = '55',
    serie = 1,
    proximo_numero = 1,
    ultimo_autorizado = null,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const upsertSequencia = `
      INSERT INTO "sequenciaNf-e" AS t
        (empresa_id, filial_id, modelo, serie, proximo_numero, ultimo_autorizado, ultimo_atualizado)
      VALUES
        ($1, $2, $3::varchar(2), $4, $5, $6, NOW())
      ON CONFLICT (empresa_id, filial_id, modelo, serie)
      DO UPDATE SET
        proximo_numero    = EXCLUDED.proximo_numero,
        ultimo_autorizado = EXCLUDED.ultimo_autorizado,
        ultimo_atualizado = NOW()
      RETURNING t.*;
    `;

    const { rows } = await client.query(upsertSequencia, [
      Number(empresa_id) || 1,
      Number(filial_id)  || 1,
      String(modelo || '55'),
      Number(serie) || 1,
      Number(proximo_numero) || 1,
      (ultimo_autorizado === null || ultimo_autorizado === undefined || ultimo_autorizado === '')
        ? null
        : Number(ultimo_autorizado),
    ]);

    await client.query('COMMIT');
    res.json({ ok: true, data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, message: e.message });
  } finally {
    client.release();
  }
});

/* =========================
   Ambiente – GET / PUT
   ========================= */
export const getAmbiente = ah(async (_req, res) => {
  const sql = `select id, empresa_id, tp_amb, updated_at, updated_by, motivo
                 from "nfeAmbiente"
                where id = 1`;
  const { rows } = await pool.query(sql);
  res.json({ ok: true, data: rows[0] || null });
});

export const putAmbiente = ah(async (req, res) => {
  const {
    empresa_id = 1,
    tp_amb = 2, // padrão: homologação
    motivo = '',
    updated_by = 'renato',
  } = req.body || {};

  const val = Number(tp_amb);
  if (![1, 2].includes(val)) {
    return res.status(400).json({ ok:false, message:'tp_amb inválido (use 1=Produção, 2=Homologação)' });
  }

  const upsert = `
    insert into "nfeAmbiente"
      (id, empresa_id, tp_amb, updated_at, updated_by, motivo)
    values
      (1, $1, $2, now(), $3, $4)
    on conflict (id) do update
      set empresa_id = excluded.empresa_id,
          tp_amb     = excluded.tp_amb,
          updated_at = now(),
          updated_by = excluded.updated_by,
          motivo     = excluded.motivo
    returning *;
  `;
  const { rows } = await pool.query(upsert, [
    Number(empresa_id) || 1,
    val,
    String(updated_by || 'sistema'),
    String(motivo || ''),
  ]);

  res.json({ ok: true, data: rows[0] });
});
