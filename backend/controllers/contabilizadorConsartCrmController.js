// controllers/contabilizadorConsartCrmController.js (ESM)
import pool from '../config/db.js';

/**
 * GET /api/contabilizador-crm/contagem?tipo_crm=reativacao&from=YYYY-MM-DD&to=YYYY-MM-DD&vendedor_nome=FULANO
 * Retorna:
 *  { ok:true, total_geral: 123, por_resultado: [{resultado:"Conversão em Venda", total: 87}, ...] }
 */
export async function obterContagem(req, res) {
  try {
    const { tipo_crm = 'reativacao', from, to, vendedor_nome } = req.query;

    const conds = ['e.tipo_crm = $1'];
    const vals  = [tipo_crm];
    let p = 2;

    if (from) { conds.push(`e.created_at >= $${p}`); vals.push(from); p++; }
    if (to)   { conds.push(`e.created_at <= $${p}`); vals.push(to + 'T23:59:59.999'); p++; }
    if (vendedor_nome) {
      conds.push(`COALESCE(NULLIF(TRIM(c.responsavel),''),'') ILIKE $${p}`);
      vals.push(`%${vendedor_nome}%`);
      p++;
    }

    const where = `WHERE ${conds.join(' AND ')}`;

    const { rows } = await pool.query(
      `SELECT e.resultado, COUNT(*)::int AS total
         FROM public."contabilizadorConsartCrm" e
         LEFT JOIN "crmConsart" c ON c.id = e.card_id
        ${where}
        GROUP BY e.resultado
        ORDER BY e.resultado`,
      vals
    );

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM public."contabilizadorConsartCrm" e
         LEFT JOIN "crmConsart" c ON c.id = e.card_id
        ${where}`,
      vals
    );

    res.json({ ok: true, total_geral: totalRows[0]?.total || 0, por_resultado: rows });
  } catch (err) {
    console.error('[contabilizadorConsartCrm] obterContagem', err);
    res.status(500).json({ ok:false, error:'Falha ao obter contagem' });
  }
}

export async function registrarEvento(req, res) {
  try {
    const {
      card_id,
      cliente_id = null,
      vendedor_id = null,
      resultado,               // 'Conversão em Venda' | 'Sem Conversão' | ...
      observacao = null,
      tipo_crm = 'atendimento' // default para esse fluxo
    } = req.body || {};

    if (!card_id || !resultado) {
      return res.status(400).json({ ok:false, error:'card_id e resultado são obrigatórios' });
    }

    const { rows } = await pool.query(
      `INSERT INTO public."contabilizadorConsartCrm"
         (tipo_crm, card_id, cliente_id, vendedor_id, resultado, observacao)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, created_at`,
      [tipo_crm, card_id, cliente_id, vendedor_id, resultado, observacao]
    );

    res.json({ ok:true, id: rows[0].id, created_at: rows[0].created_at });
  } catch (err) {
    console.error('[contabilizadorConsartCrm] registrarEvento', err);
    res.status(500).json({ ok:false, error:'Falha ao registrar evento' });
  }
}