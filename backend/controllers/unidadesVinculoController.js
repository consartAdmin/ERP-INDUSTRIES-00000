// unidadesVinculoController.js
import pool from '../config/db.js';

// Se sua tabela tem camelCase e foi criada com aspas, mantenha com aspas:
const TB_UNIDADES_PRODUTO = '"unidadesProdutos"';
const TB_UNIDADES         = 'unidades';
const TB_PRODUTOS         = 'produtos';

const ALIAS = Object.freeze({
  [TB_UNIDADES_PRODUTO]: 'unprod',
  [TB_UNIDADES]:         'un',
  [TB_PRODUTOS]:         'p',
});

const SCHEMA = Object.freeze({
  [TB_UNIDADES_PRODUTO]: {
    // 🔧 AJUSTE AQUI: se a coluna física é "id", declare "id"
    pk:      'id',
    fk_prod: 'produto_id',
    cols: {
      unidade_id: 'unidade_id',
      fator:      'fator',
      descricao:  'descricao',
      padrao:     'padrao',
    },
  },
  [TB_UNIDADES]: {
    pk:   'unidade_id',
    // Se sua tabela usa 'sigla' no lugar de 'unidade', troque:
    // cols: { unidade: 'sigla', descricao: 'descricao' },
    cols: { unidade: 'unidade', descricao: 'descricao' },
  },
  [TB_PRODUTOS]: { pk: 'produto_id' }
});

const A = (t) => ALIAS[t];
const T = (t) => (t.startsWith('"') ? t : `public.${t}`);

function isPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

async function resolveProdutoId(raw) {
  if (isPositiveInt(raw)) return Number(raw);
  const sql = `
    SELECT ${SCHEMA[TB_PRODUTOS].pk} AS produto_id
    FROM ${T(TB_PRODUTOS)} ${A(TB_PRODUTOS)}
    WHERE CAST(${A(TB_PRODUTOS)}.${SCHEMA[TB_PRODUTOS].pk} AS TEXT) = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [String(raw)]);
  return rows[0]?.produto_id ?? null;
}

const vincCtrl = {
  async listarVinculosEDisponiveis(req, res, next) {
    try {
      const pid = await resolveProdutoId(req.params.produto_id);
      if (!pid) return res.status(404).json({ ok:false, error:'Produto não encontrado.' });

      const tUP = T(TB_UNIDADES_PRODUTO);
      const tU  = T(TB_UNIDADES);
      const aUP = A(TB_UNIDADES_PRODUTO);
      const aU  = A(TB_UNIDADES);

      const up = SCHEMA[TB_UNIDADES_PRODUTO];
      const u  = SCHEMA[TB_UNIDADES];

      const sqlVinc = `
        SELECT
          ${aUP}.${up.pk}                 AS unidade_produto_id,
          ${aUP}.${up.fk_prod}            AS produto_id,
          ${aUP}.${up.cols.unidade_id}    AS unidade_id,
          ${aU}.${u.cols.unidade}         AS unidade,
          ${aUP}.${up.cols.fator}         AS fator,
          ${aUP}.${up.cols.descricao}     AS descricao,
          ${aUP}.${up.cols.padrao}        AS padrao
        FROM ${tUP} ${aUP}
        JOIN ${tU}  ${aU}
          ON ${aU}.${u.pk} = ${aUP}.${up.cols.unidade_id}
        WHERE ${aUP}.${up.fk_prod} = $1
        ORDER BY ${aUP}.${up.cols.padrao} DESC, ${aU}.${u.cols.unidade} ASC;
      `;

      const sqlDisp = `
        SELECT
          ${aU}.${u.pk}             AS unidade_id,
          ${aU}.${u.cols.unidade}   AS unidade,
          ${aU}.${u.cols.descricao} AS descricao
        FROM ${tU} ${aU}
        WHERE ${aU}.${u.pk} NOT IN (
          SELECT ${aUP}.${up.cols.unidade_id}
          FROM ${tUP} ${aUP}
          WHERE ${aUP}.${up.fk_prod} = $1
        )
        ORDER BY ${aU}.${u.cols.unidade} ASC;
      `;

      const [vincRes, dispRes] = await Promise.all([
        pool.query(sqlVinc, [pid]),
        pool.query(sqlDisp, [pid]),
      ]);

      return res.json({ ok:true, data:{ vinculadas: vincRes.rows, disponiveis: dispRes.rows } });
    } catch (err) { next(err); }
  },

  async criarVinculo(req, res, next) {
    try {
      const pid = await resolveProdutoId(req.params.produto_id);
      if (!pid) return res.status(404).json({ ok:false, error:'Produto não encontrado.' });

      const { unidade_id, fator = 1, descricao = '', padrao = false } = req.body || {};
      if (!unidade_id) return res.status(400).json({ ok:false, error:'unidade_id obrigatório.' });

      const tUP = T(TB_UNIDADES_PRODUTO);
      const up  = SCHEMA[TB_UNIDADES_PRODUTO];

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        if (padrao === true) {
          await client.query(
            `UPDATE ${tUP} SET ${up.cols.padrao} = FALSE WHERE ${up.fk_prod} = $1`,
            [pid]
          );
        }

        const { rows } = await client.query(
          `INSERT INTO ${tUP} (${up.fk_prod}, ${up.cols.unidade_id}, ${up.cols.fator}, ${up.cols.descricao}, ${up.cols.padrao})
           VALUES ($1,$2,$3,$4,$5)
           RETURNING ${up.pk} AS unidade_produto_id`,
          [pid, unidade_id, fator, descricao, padrao === true]
        );

        await client.query('COMMIT');
        return res.status(201).json({ ok:true, data:{ unidade_produto_id: rows[0].unidade_produto_id } });
      } catch (e) {
        await client.query('ROLLBACK'); throw e;
      } finally {
        client.release();
      }
    } catch (err) { next(err); }
  },

  async atualizarVinculo(req, res, next) {
    try {
      const { unidade_produto_id } = req.params;
      const tUP = T(TB_UNIDADES_PRODUTO);
      const up  = SCHEMA[TB_UNIDADES_PRODUTO];

      const fields = [];
      const vals = [];
      let i = 1;

      const { unidade_id, fator, descricao } = req.body || {};

      if (unidade_id != null) { fields.push(`${up.cols.unidade_id} = $${i++}`); vals.push(unidade_id); }
      if (fator != null)      { fields.push(`${up.cols.fator} = $${i++}`);      vals.push(fator); }
      if (descricao != null)  { fields.push(`${up.cols.descricao} = $${i++}`);  vals.push(descricao); }

      if (!fields.length) return res.status(400).json({ ok:false, error:'Nada para atualizar.' });

      const sql = `UPDATE ${tUP} SET ${fields.join(', ')} WHERE ${up.pk} = $${i} RETURNING ${up.pk} AS unidade_produto_id`;
      const r = await pool.query(sql, [...vals, unidade_produto_id]);
      if (!r.rows.length) return res.status(404).json({ ok:false, error:'Vínculo não encontrado.' });

      return res.json({ ok:true, data:{ unidade_produto_id: r.rows[0].unidade_produto_id } });
    } catch (err) { next(err); }
  },

  async removerVinculo(req, res, next) {
    try {
      const { unidade_produto_id } = req.params;
      const tUP = T(TB_UNIDADES_PRODUTO);
      const up  = SCHEMA[TB_UNIDADES_PRODUTO];

      const r = await pool.query(
        `DELETE FROM ${tUP} WHERE ${up.pk} = $1 RETURNING ${up.pk} AS unidade_produto_id`,
        [unidade_produto_id]
      );
      if (!r.rows.length) return res.status(404).json({ ok:false, error:'Vínculo não encontrado.' });

      return res.json({ ok:true });
    } catch (err) { next(err); }
  },

  async definirUnidadePadrao(req, res, next) {
    try {
      const pid = await resolveProdutoId(req.params.produto_id);
      const { unidade_produto_id } = req.params;
      if (!pid) return res.status(404).json({ ok:false, error:'Produto não encontrado.' });

      const tUP = T(TB_UNIDADES_PRODUTO);
      const up  = SCHEMA[TB_UNIDADES_PRODUTO];

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE ${tUP} SET ${up.cols.padrao} = FALSE WHERE ${up.fk_prod} = $1`,
          [pid]
        );
        const r = await client.query(
          `UPDATE ${tUP} SET ${up.cols.padrao} = TRUE WHERE ${up.pk} = $1`,
          [unidade_produto_id]
        );
        if (!r.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ ok:false, error:'Vínculo não encontrado.' });
        }
        await client.query('COMMIT');
        return res.json({ ok:true, unidade_produto_id: Number(unidade_produto_id), padrao: true });
      } catch (e) {
        await client.query('ROLLBACK'); throw e;
      } finally {
        client.release();
      }
    } catch (err) { next(err); }
  },
};

export default vincCtrl;

// Se quiser MESMO manter a função isolada abaixo, tudo bem, mas NÃO a use nas rotas.
// Prefira vincCtrl.criarVinculo para evitar duplicidade de lógica.
