// ╔══════════════════════════════════════════════════════════════════════╗
// ║ gestaoVendasController.js – CRUD + filtros + relatório (ESM)        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import pool from '../config/db.js';

const TBL = 'public."gestaoVendas"'; // tabela camelCase com aspas

// Util
const toNumber = v => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(/\./g,'').replace(',', '.')));

// GET /api/gestao-vendas?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=&forma=&q=&page=1&pageSize=20
export async function listar(req, res) {
  try {
    const {
      de, ate, status, forma, q,
      page = 1, pageSize = 20
    } = req.query;

    const where = [];
    const params = [];
    const add = (sql, val) => { params.push(val); where.push(sql.replace('$X', `$${params.length}`)); };

    if (de)   add(`data >= $X`, de);
    if (ate)  add(`data <= $X`, ate);
    if (status) add(`status = $X`, status);
    if (forma)  add(`forma_pagamento = $X`, forma);
    if (q) {
      // busca por cliente/documento
      params.push(`%${q}%`);
      where.push(`(cliente_nome ILIKE $${params.length} OR documento ILIKE $${params.length})`);
    }

    const pageN = Math.max(1, parseInt(page, 10));
    const sizeN = Math.max(1, Math.min(200, parseInt(pageSize, 10)));
    const off   = (pageN - 1) * sizeN;

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const base = `FROM ${TBL} ${whereSQL}`;

    const sqlData = `
      SELECT id, data, cliente_nome, documento,
             itens_total, desconto, total, forma_pagamento, status, observacao,
             created_at, updated_at
      ${base}
      ORDER BY data DESC, id DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `;
    const sqlCount = `SELECT COUNT(*) AS total ${base};`;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(sqlData, [...params, sizeN, off]),
      pool.query(sqlCount, params)
    ]);

    res.json({
      page: pageN,
      pageSize: sizeN,
      total: Number(countRes.rows[0].total || 0),
      data: rowsRes.rows
    });
  } catch (err) {
    console.error('[gestaoVendas][listar]', err);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
}

// GET /api/gestao-vendas/:id
export async function obterPorId(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM ${TBL} WHERE id = $1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[gestaoVendas][obterPorId]', err);
    res.status(500).json({ error: 'Erro ao obter venda' });
  }
}

// POST /api/gestao-vendas
export async function criar(req, res) {
  try {
    const b = req.body || {};
    const itens_total = toNumber(b.itens_total) ?? 0;
    const desconto    = toNumber(b.desconto) ?? 0;
    const total       = toNumber(b.total);

    const params = [
      b.data, b.cliente_nome, b.documento || null,
      itens_total, desconto, total,
      b.forma_pagamento, b.status || 'CONCLUIDA',
      b.observacao || null, b.origem || 'MANUAL',
      b.usuario_id ?? null
    ];

    const { rows } = await pool.query(
      `INSERT INTO ${TBL}
       (data, cliente_nome, documento, itens_total, desconto, total,
        forma_pagamento, status, observacao, origem, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *;`, params
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[gestaoVendas][criar]', err);
    res.status(500).json({ error: 'Erro ao criar venda' });
  }
}

// PUT /api/gestao-vendas/:id
export async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const itens_total = toNumber(b.itens_total);
    const desconto    = toNumber(b.desconto);
    const total       = toNumber(b.total);

    const params = [
      b.data, b.cliente_nome, b.documento ?? null,
      itens_total, desconto, total,
      b.forma_pagamento, b.status,
      b.observacao ?? null, b.origem ?? 'MANUAL',
      b.usuario_id ?? null,
      id
    ];
    const { rowCount, rows } = await pool.query(
      `UPDATE ${TBL}
         SET data=$1, cliente_nome=$2, documento=$3,
             itens_total=$4, desconto=$5, total=$6,
             forma_pagamento=$7, status=$8, observacao=$9,
             origem=$10, usuario_id=$11, updated_at=NOW()
       WHERE id=$12
       RETURNING *;`, params
    );
    if (!rowCount) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[gestaoVendas][atualizar]', err);
    res.status(500).json({ error: 'Erro ao atualizar venda' });
  }
}

// DELETE /api/gestao-vendas/:id
export async function excluir(req, res) {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `DELETE FROM ${TBL} WHERE id=$1`, [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[gestaoVendas][excluir]', err);
    res.status(500).json({ error: 'Erro ao excluir venda' });
  }
}

// GET /api/gestao-vendas/relatorio/diario?de=&ate=&status=
export async function relatorioDiario(req, res) {
  try {
    const { de, ate, status } = req.query;
    const where = [];
    const params = [];
    const add = (sql, val) => { params.push(val); where.push(sql.replace('$X', `$${params.length}`)); };

    if (de) add('data >= $X', de);
    if (ate) add('data <= $X', ate);
    if (status) add('status = $X', status);

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT data, status,
             COUNT(*) AS qtde_vendas,
             SUM(itens_total)::numeric(14,2) AS soma_itens,
             SUM(desconto)::numeric(14,2)    AS soma_descontos,
             SUM(total)::numeric(14,2)       AS soma_total
      FROM ${TBL}
      ${whereSQL}
      GROUP BY data, status
      ORDER BY data DESC, status;
    `;
    const { rows } = await pool.query(sql, params);

    // totais gerais
    const { rows: tot } = await pool.query(`
      SELECT
        COALESCE(SUM(itens_total),0)::numeric(14,2) AS soma_itens,
        COALESCE(SUM(desconto),0)::numeric(14,2)    AS soma_descontos,
        COALESCE(SUM(total),0)::numeric(14,2)       AS soma_total
      FROM ${TBL} ${whereSQL};`, params);

    res.json({ grupos: rows, totais: tot[0] });
  } catch (err) {
    console.error('[gestaoVendas][relatorioDiario]', err);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
}
