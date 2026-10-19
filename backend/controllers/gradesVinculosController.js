// ╔══════════════════════════════════════════════════════════════════════════════╗
// 📄 backend/controllers/gradesVinculosController.js
// ║ Controlador de Vínculos Produto x Grade (gradesProdutos)                    ║
// ║ Tabela: public."gradesProdutos"                                             ║
// ║ PK: grade_produto_id                                                         ║
// ║ FKs: produto_id → public.produtos(produto_id) [varchar(20)]                 ║
// ║      grade_id   → public.grades(grade_id)   [integer]                       ║
// ║ Endpoints principais:                                                       ║
// ║  GET    /api/grades-vinculos                                                ║
// ║  GET    /api/grades-vinculos/:id                                            ║
// ║  GET    /api/produtos/:produto_id/grades-vinculos                           ║
// ║  POST   /api/grades-vinculos                                                ║
// ║  PUT    /api/grades-vinculos/:id                                            ║
// ║  DELETE /api/grades-vinculos/:id                                            ║
// ║  PUT    /api/produtos/:produto_id/grades-vinculos (sincronização em lote)   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import { handleError } from '../utils/handleError.js';

// ───────────────────────────────────────────────────────────────────────────────
// Tabelas
// ───────────────────────────────────────────────────────────────────────────────
const TB_VINCULOS = 'gradesProdutos';
const TB_PRODUTOS = 'produtos';
const TB_GRADES   = 'grades';

// ───────────────────────────────────────────────────────────────────────────────
// Schema mínimo
// ───────────────────────────────────────────────────────────────────────────────
const SCHEMA = Object.freeze({
  [TB_VINCULOS]: {
    pk: 'grade_produto_id',
    cols: {
      produto_id: 'produto_id', // varchar(20)
      grade_id:   'grade_id',   // integer
      estoque:    'estoque',    // integer (opcional)
    },
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
const PK   = SCHEMA[TB_VINCULOS].pk;
const COLS = SCHEMA[TB_VINCULOS].cols;

const normSKU = (v) => (v ?? '').toString().trim().slice(0, 20);
const toInt   = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

async function existsProduto(client, produtoId) {
  const { rows } = await client.query(
    `SELECT 1 FROM public.${TB_PRODUTOS} WHERE produto_id = $1 LIMIT 1`,
    [produtoId]
  );
  return rows.length > 0;
}

async function existsGrade(client, gradeId) {
  const { rows } = await client.query(
    `SELECT 1 FROM public.${TB_GRADES} WHERE grade_id = $1 LIMIT 1`,
    [gradeId]
  );
  return rows.length > 0;
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Listagem com filtros
// GET /api/grades-vinculos?produto_id=&grade_id=&limit=&offset=&order=
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function list(req, res) {
  try {
    const { produto_id, grade_id, limit = 50, offset = 0, order = 'gp.grade_produto_id ASC' } = req.query;

    const where = [];
    const params = [];
    let i = 1;

    if (produto_id) { where.push(`gp.${COLS.produto_id} = $${i++}`); params.push(normSKU(produto_id)); }
    if (grade_id)   { where.push(`gp.${COLS.grade_id} = $${i++}`);   params.push(toInt(grade_id));      }

    const sql = `
      SELECT
        gp.${PK}              AS grade_produto_id,
        gp.${COLS.produto_id} AS produto_id,
        gp.${COLS.grade_id}   AS grade_id,
        gp.${COLS.estoque}    AS estoque,
        g.grade,
        p.descricao AS produto_descricao
      FROM public."${TB_VINCULOS}" gp
      LEFT JOIN public.${TB_GRADES}   g ON g.grade_id   = gp.${COLS.grade_id}
      LEFT JOIN public.${TB_PRODUTOS} p ON p.produto_id = gp.${COLS.produto_id}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${order}
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, count: rows.length, data: rows });
  } catch (err) {
    handleError(res, err, 'Erro ao listar vínculos de grades.');
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Buscar por ID
// GET /api/grades-vinculos/:id
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function getById(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const sql = `
      SELECT
        gp.${PK}              AS grade_produto_id,
        gp.${COLS.produto_id} AS produto_id,
        gp.${COLS.grade_id}   AS grade_id,
        gp.${COLS.estoque}    AS estoque
      FROM public."${TB_VINCULOS}" gp
      WHERE gp.${PK} = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Vínculo não encontrado.' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    handleError(res, err, 'Erro ao buscar vínculo por ID.');
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Listar vínculos por produto
// GET /api/produtos/:produto_id/grades-vinculos
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function listByProduto(req, res) {
  try {
    const produtoId = normSKU(req.params.produto_id);
    if (!produtoId) return res.status(400).json({ ok: false, error: 'produto_id obrigatório.' });

    const sql = `
      SELECT
        gp.${PK}              AS grade_produto_id,
        gp.${COLS.produto_id} AS produto_id,
        gp.${COLS.grade_id}   AS grade_id,
        gp.${COLS.estoque}    AS estoque,
        g.grade
      FROM public."${TB_VINCULOS}" gp
      LEFT JOIN public.${TB_GRADES} g ON g.grade_id = gp.${COLS.grade_id}
      WHERE gp.${COLS.produto_id} = $1
      ORDER BY gp.${COLS.grade_id} ASC, gp.${PK} ASC
    `;
    const { rows } = await pool.query(sql, [produtoId]);
    res.json({ ok: true, count: rows.length, data: rows });
  } catch (err) {
    handleError(res, err, 'Erro ao listar vínculos por produto.');
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Criar vínculo
// POST /api/grades-vinculos  { produto_id, grade_id, estoque? }
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function create(req, res) {
  const client = await pool.connect();
  try {
    const produto_id = normSKU(req.body?.produto_id);
    const grade_id   = toInt(req.body?.grade_id);
    const estoque    = toInt(req.body?.estoque ?? 0) ?? 0;

    if (!produto_id)              return res.status(400).json({ ok: false, error: 'produto_id é obrigatório.' });
    if (!Number.isInteger(grade_id)) return res.status(400).json({ ok: false, error: 'grade_id inválido.' });

    await client.query('BEGIN');
    const [hasProduto, hasGrade] = await Promise.all([
      existsProduto(client, produto_id),
      existsGrade(client, grade_id),
    ]);
    if (!hasProduto) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: `Produto inexistente: ${produto_id}` }); }
    if (!hasGrade)   { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: `Grade inexistente: ${grade_id}` }); }

    const sql = `
      INSERT INTO public."${TB_VINCULOS}" (${COLS.produto_id}, ${COLS.grade_id}, ${COLS.estoque})
      VALUES ($1, $2, $3)
      RETURNING ${PK} AS grade_produto_id, ${COLS.produto_id} AS produto_id, ${COLS.grade_id} AS grade_id, ${COLS.estoque} AS estoque
    `;
    const { rows } = await client.query(sql, [produto_id, grade_id, estoque]);
    await client.query('COMMIT');
    res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    handleError(res, err, 'Erro ao criar vínculo.');
  } finally {
    client.release();
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Atualizar vínculo
// PUT /api/grades-vinculos/:id  { produto_id?, grade_id?, estoque? }
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function update(req, res) {
  const client = await pool.connect();
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    await client.query('BEGIN');

    const hasRow = await client.query(
      `SELECT 1 FROM public."${TB_VINCULOS}" WHERE ${PK} = $1`,
      [id]
    );
    if (!hasRow.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'Vínculo não encontrado.' }); }

    const set = [];
    const params = [];
    let i = 1;

    if (req.body?.produto_id !== undefined) {
      const pid = normSKU(req.body.produto_id);
      if (!pid) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'produto_id inválido.' }); }
      if (!(await existsProduto(client, pid))) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: `Produto inexistente: ${pid}` }); }
      set.push(`${COLS.produto_id} = $${i++}`); params.push(pid);
    }

    if (req.body?.grade_id !== undefined) {
      const gid = toInt(req.body.grade_id);
      if (!Number.isInteger(gid)) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'grade_id inválido.' }); }
      if (!(await existsGrade(client, gid))) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: `Grade inexistente: ${gid}` }); }
      set.push(`${COLS.grade_id} = $${i++}`); params.push(gid);
    }

    if (req.body?.estoque !== undefined) {
      const est = toInt(req.body.estoque);
      if (est === null) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'estoque inválido.' }); }
      set.push(`${COLS.estoque} = $${i++}`); params.push(est);
    }

    if (!set.length) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'Nada para atualizar.' }); }

    const sql = `
      UPDATE public."${TB_VINCULOS}"
      SET ${set.join(', ')}
      WHERE ${PK} = $${i}
      RETURNING ${PK} AS grade_produto_id, ${COLS.produto_id} AS produto_id, ${COLS.grade_id} AS grade_id, ${COLS.estoque} AS estoque
    `;
    params.push(id);

    const { rows } = await client.query(sql, params);
    await client.query('COMMIT');
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    handleError(res, err, 'Erro ao atualizar vínculo.');
  } finally {
    client.release();
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// Remover vínculo
// DELETE /api/grades-vinculos/:id
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function remove(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'ID inválido.' });

    const sql = `
      DELETE FROM public."${TB_VINCULOS}"
      WHERE ${PK} = $1
      RETURNING ${PK} AS grade_produto_id
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Vínculo não encontrado.' });
    res.json({ ok: true, deleted: rows[0].grade_produto_id });
  } catch (err) {
    handleError(res, err, 'Erro ao remover vínculo.');
  }
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
/*
  Sincronizar vínculos de um produto (modo "sync" padrão)
  PUT /api/produtos/:produto_id/grades-vinculos
  Body:
  {
    "mode": "sync" | "merge",    // default: "sync"
    "grades": [
      { "grade_id": 10, "estoque": 5 },
      { "grade_id": 11, "estoque": 2 }
    ]
  }

  - sync: cria/atualiza os enviados e remove os que não estiverem na lista
  - merge: cria/atualiza os enviados e mantém os demais
*/
// ╚══════════════════════════════════════════════════════════════════════════════╝
export async function syncByProduto(req, res) {
  const client = await pool.connect();
  try {
    const produtoId = normSKU(req.params.produto_id);
    const mode = (req.body?.mode || 'sync').toLowerCase();
    const items = Array.isArray(req.body?.grades) ? req.body.grades : [];

    if (!produtoId) return res.status(400).json({ ok: false, error: 'produto_id obrigatório.' });
    if (!['sync', 'merge'].includes(mode)) return res.status(400).json({ ok: false, error: 'mode inválido. Use "sync" ou "merge".' });

    await client.query('BEGIN');

    // valida produto
    if (!(await existsProduto(client, produtoId))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: `Produto inexistente: ${produtoId}` });
    }

    // carrega vínculos atuais
    const current = await client.query(
      `SELECT ${PK}, ${COLS.grade_id}, ${COLS.estoque}
       FROM public."${TB_VINCULOS}"
       WHERE ${COLS.produto_id} = $1`,
      [produtoId]
    );
    const currentMap = new Map(current.rows.map(r => [Number(r[COLS.grade_id]), r]));

    // normaliza e valida entrada
    const normalized = [];
    for (const raw of items) {
      const gid = toInt(raw?.grade_id);
      if (!Number.isInteger(gid)) { await client.query('ROLLBACK'); return res.status(400).json({ ok: false, error: `grade_id inválido em item: ${JSON.stringify(raw)}` }); }
      const est = toInt(raw?.estoque ?? 0) ?? 0;

      if (!(await existsGrade(client, gid))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: `Grade inexistente: ${gid}` });
      }

      normalized.push({ grade_id: gid, estoque: est });
    }

    // upsert simples (sem unique composto):
    // - se existe vínculo (produto_id + grade_id), atualiza estoque;
    // - senão, cria.
    const affected = [];
    for (const it of normalized) {
      const existing = currentMap.get(it.grade_id);
      if (existing) {
        const upd = await client.query(
          `UPDATE public."${TB_VINCULOS}"
             SET ${COLS.estoque} = $1
           WHERE ${COLS.produto_id} = $2 AND ${COLS.grade_id} = $3
           RETURNING ${PK} AS grade_produto_id, ${COLS.produto_id} AS produto_id, ${COLS.grade_id} AS grade_id, ${COLS.estoque} AS estoque`,
          [it.estoque, produtoId, it.grade_id]
        );
        affected.push(upd.rows[0]);
      } else {
        const ins = await client.query(
          `INSERT INTO public."${TB_VINCULOS}" (${COLS.produto_id}, ${COLS.grade_id}, ${COLS.estoque})
           VALUES ($1, $2, $3)
           RETURNING ${PK} AS grade_produto_id, ${COLS.produto_id} AS produto_id, ${COLS.grade_id} AS grade_id, ${COLS.estoque} AS estoque`,
          [produtoId, it.grade_id, it.estoque]
        );
        affected.push(ins.rows[0]);
      }
    }

    // se modo = sync, remover o que não veio
    if (mode === 'sync') {
      const keepSet = new Set(normalized.map(n => n.grade_id));
      const toDelete = current.rows.filter(r => !keepSet.has(Number(r[COLS.grade_id]))).map(r => r[COLS.grade_id]);

      if (toDelete.length) {
        await client.query(
          `DELETE FROM public."${TB_VINCULOS}"
           WHERE ${COLS.produto_id} = $1
             AND ${COLS.grade_id} = ANY($2::int[])`,
          [produtoId, toDelete]
        );
      }
    }

    await client.query('COMMIT');

    // retorno final: situação atual após operação
    const final = await pool.query(
      `SELECT ${PK} AS grade_produto_id, ${COLS.produto_id} AS produto_id, ${COLS.grade_id} AS grade_id, ${COLS.estoque} AS estoque
       FROM public."${TB_VINCULOS}"
       WHERE ${COLS.produto_id} = $1
       ORDER BY ${COLS.grade_id} ASC`,
      [produtoId]
    );

    res.json({
      ok: true,
      mode,
      count: final.rows.length,
      data: final.rows,
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    handleError(res, err, 'Erro ao sincronizar vínculos por produto.');
  } finally {
    client.release();
  }
}

// backend/controllers/gradesVinculosController.js
export async function listGradesCatalog(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT grade_id, COALESCE(descricao, nome, 'Grade '||grade_id) AS grade
      FROM public.grades
      ORDER BY grade_id ASC
    `);
    res.json({ ok: true, rows });
  } catch (err) {
    handleError(res, err, 'Erro ao listar catálogo de grades.');
  }
}

export default {
  list,
  getById,
  listByProduto,
  create,
  update,
  remove,
  syncByProduto,
  listGradesCatalog,
};
