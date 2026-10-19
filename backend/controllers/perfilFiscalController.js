// ╔════════════════════════════════════════════════════════════╗
// ║ 📦 perfilFiscalController.js – Controller Perfil Fiscal    ║
// ╚════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

const TB_PERFIL_FISCAL = '"perfilFiscal"'; // atenção às aspas

export async function listarPerfis(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT perfil_fiscal_id, nome_perfil, descricao,
              cst_icms, aliq_icms, cfop_entrada, cfop_saida,
              origem, cst_pis, aliq_pis, cst_cofins, aliq_cofins, cbenef
         FROM ${TB_PERFIL_FISCAL}
        ORDER BY perfil_fiscal_id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('[ERR#PFISC-LIST]', err);
    res.status(500).json({ erro: 'Erro ao listar perfis fiscais.' });
  }
}

export async function obterPerfilPorId(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });

    const { rows } = await pool.query(
      `SELECT perfil_fiscal_id, nome_perfil, descricao,
              cst_icms, aliq_icms, cfop_entrada, cfop_saida,
              origem, cst_pis, aliq_pis, cst_cofins, aliq_cofins, cbenef
         FROM ${TB_PERFIL_FISCAL}
        WHERE perfil_fiscal_id = $1
        LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Perfil fiscal não encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[ERR#PFISC-GET]', err);
    res.status(500).json({ erro: 'Erro ao buscar perfil fiscal.' });
  }
}

export async function criarPerfil(req, res) {
  try {
    const {
      nome_perfil, descricao,
      cst_icms, aliq_icms, cfop_entrada, cfop_saida,
      origem, cst_pis, aliq_pis, cst_cofins, aliq_cofins, cbenef
    } = req.body || {};

    if (!nome_perfil) return res.status(400).json({ erro: 'nome_perfil é obrigatório.' });

    const { rows } = await pool.query(
      `INSERT INTO ${TB_PERFIL_FISCAL}
       (nome_perfil, descricao, cst_icms, aliq_icms, cfop_entrada, cfop_saida,
        origem, cst_pis, aliq_pis, cst_cofins, aliq_cofins, cbenef)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING perfil_fiscal_id`,
      [nome_perfil, descricao ?? null, cst_icms ?? null, aliq_icms ?? null,
       cfop_entrada ?? null, cfop_saida ?? null, origem ?? null,
       cst_pis ?? null, aliq_pis ?? null, cst_cofins ?? null, aliq_cofins ?? null, cbenef ?? null]
    );
    res.status(201).json({ ok: true, perfil_fiscal_id: rows[0].perfil_fiscal_id });
  } catch (err) {
    console.error('[ERR#PFISC-CREATE]', err);
    res.status(500).json({ erro: 'Erro ao criar perfil fiscal.' });
  }
}

export async function atualizarPerfil(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });

    // Campos permitidos
    const allow = ['nome_perfil','descricao','cst_icms','aliq_icms','cfop_entrada','cfop_saida',
                   'origem','cst_pis','aliq_pis','cst_cofins','aliq_cofins','cbenef'];
    const data = {};
    for (const k of allow) if (k in (req.body || {})) data[k] = req.body[k];

    if (!Object.keys(data).length) return res.status(400).json({ erro: 'Nada para atualizar.' });

    const cols = Object.keys(data);
    const sets = cols.map((k, i) => `${k} = $${i+1}`).join(', ');
    const vals = cols.map(k => data[k]);

    const r = await pool.query(
      `UPDATE ${TB_PERFIL_FISCAL}
          SET ${sets}
        WHERE perfil_fiscal_id = $${vals.length + 1}`,
      [...vals, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[ERR#PFISC-UPDATE]', err);
    res.status(500).json({ erro: 'Erro ao atualizar perfil fiscal.' });
  }
}

export async function removerPerfil(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido.' });

    await pool.query(
      `DELETE FROM ${TB_PERFIL_FISCAL} WHERE perfil_fiscal_id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[ERR#PFISC-DELETE]', err);
    res.status(500).json({ erro: 'Erro ao remover perfil fiscal.' });
  }
}
