// ╔══════════════════════════════════════════════════════════════════════════════════╗
// ║ 📦 produtosFiscalLoteController.js – Atualização Fiscal em Lote de Produtos     ║
// ╚══════════════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

// 🔁 Atualiza os dados fiscais de vários produtos conforme filtros aplicados
export const atualizarFiscalEmLote = async (req, res) => {
  const { grupo_id, subgrupo_id, classificacao_fiscal_id, perfil_fiscal_id } = req.body;

  if (!classificacao_fiscal_id || !perfil_fiscal_id) {
    return res.status(400).json({ erro: 'Classificação Fiscal e Perfil Fiscal são obrigatórios.' });
  }

  try {
    // 🔍 Monta a query dinâmica com filtros opcionais
    let query = `
      UPDATE "produtosFiscal"
      SET classificacao_fiscal_id = $1,
          perfil_fiscal_id = $2
      WHERE 1=1
    `;
    const values = [classificacao_fiscal_id, perfil_fiscal_id];
    let index = 3;

    if (grupo_id) {
      query += ` AND grupo_id = $${index++}`;
      values.push(grupo_id);
    }

    if (subgrupo_id) {
      query += ` AND subgrupo_id = $${index++}`;
      values.push(subgrupo_id);
    }

    // ✅ Atualiza os produtos conforme filtros
    const update = await pool.query(query, values);

    // 🔄 Recupera SKUs atualizados (apenas para feedback ao usuário)
    let skusQuery = `
      SELECT sku FROM "produtosFiscal"
      WHERE classificacao_fiscal_id = $1 AND perfil_fiscal_id = $2
    `;
    const skusParams = [classificacao_fiscal_id, perfil_fiscal_id];

    if (grupo_id) {
      skusQuery += ` AND grupo_id = $${skusParams.length + 1}`;
      skusParams.push(grupo_id);
    }

    if (subgrupo_id) {
      skusQuery += ` AND subgrupo_id = $${skusParams.length + 1}`;
      skusParams.push(subgrupo_id);
    }

    const skusResult = await pool.query(skusQuery, skusParams);
    const skusValidos = skusResult.rows.map(r => r.sku);

    return res.json({
      mensagem: `✅ ${update.rowCount} produto(s) fiscais atualizados com sucesso.`,
      filtros_aplicados: { grupo_id, subgrupo_id, classificacao_fiscal_id, perfil_fiscal_id },
      skus_atualizados: skusValidos
    });

  } catch (err) {
    console.error('❌ Erro ao atualizar produtos fiscais em lote:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar produto.', detalhe: err.message });
  }
};

// 🔍 Retorna o perfil fiscal vinculado à classificação fiscal
export const obterPerfilPorClassificacao = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT perfil_fiscal_id FROM "classificacaoFiscal"
      WHERE perfil_fiscal_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Classificação fiscal não encontrada.' });
    }

    const perfilId = result.rows[0].perfil_fiscal_id;

    if (!perfilId) {
      return res.status(200).json({ perfil_fiscal_id: null });
    }

    // Busca o nome do perfil fiscal
    const perfil = await pool.query(`
      SELECT id, nome_perfil FROM "perfilFiscal"
      WHERE id = $1
    `, [perfilId]);

    if (perfil.rows.length === 0) {
      return res.status(404).json({ erro: 'Perfil fiscal não encontrado.' });
    }

    return res.json(perfil.rows[0]);

  } catch (err) {
    console.error('❌ Erro ao obter perfil fiscal por classificação:', err);
    return res.status(500).json({ erro: 'Erro ao buscar perfil fiscal.', detalhe: err.message });
  }
};
