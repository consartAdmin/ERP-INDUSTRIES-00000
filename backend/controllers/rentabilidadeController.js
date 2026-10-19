// 📁 backend/public/rentabilidade/rentabilidadeController.js

const pool = require('../../config/db');

exports.calcularRentabilidadeOrcamento = async (req, res) => {
  const orcamentoId = req.params.id;

  try {
    const { rows: itens } = await pool.query(`
      SELECT 
        oi.sku,
        p.descricao,
        oi.quantidade,
        oi.unidade,
        p.preco_custo,
        oi.valor_unitario AS preco_tabela,
        oi.desconto,
        (oi.valor_unitario - oi.desconto) AS preco_final
      FROM orcamento_itens oi
      JOIN produtos p ON p.sku = oi.sku
      WHERE oi.orcamento_id = $1
    `, [orcamentoId]);

    if (itens.length === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado ou sem itens.' });
    }

    const itensConvertidos = itens.map(item => ({
      ...item,
      preco_custo: parseFloat(item.preco_custo) || 0,
      preco_tabela: parseFloat(item.preco_tabela) || 0,
      desconto: parseFloat(item.desconto) || 0,
      preco_final: parseFloat(item.preco_final) || 0,
      quantidade: parseFloat(item.quantidade) || 0
    }));

    return res.json(itensConvertidos);

  } catch (erro) {
    console.error('[RENTABILIDADE] Erro ao calcular:', erro);
    return res.status(500).json({ erro: 'Erro ao calcular rentabilidade.' });
  }
};
