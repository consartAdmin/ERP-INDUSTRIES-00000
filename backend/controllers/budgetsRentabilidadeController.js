// ╔══════════════════════════════════════════════════════╗
// ║ 📊 budgetsRentabilidadeController.js (ESM)          ║
// ╚══════════════════════════════════════════════════════╝

import pool from '../config/db.js';

export async function calcularRentabilidade(req, res) {
  const { id } = req.params;

  try {
    const query = `
      SELECT 
        i.quantidade,
        i.valor_unitario,
        i.preco_custo
      FROM orcamentos_itens i
      WHERE i.orcamento_id = $1
    `;
    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Orçamento não encontrado ou sem itens.' });
    }

    let totalVenda = 0;
    let totalCusto = 0;

    rows.forEach(item => {
      totalVenda += item.quantidade * item.valor_unitario;
      totalCusto += item.quantidade * item.preco_custo;
    });

    const rentabilidade = ((totalVenda - totalCusto) / totalVenda) * 100;

    res.json({
      totalVenda,
      totalCusto,
      rentabilidade: rentabilidade.toFixed(2)
    });

  } catch (err) {
    console.error('[ERRO-RENTABILIDADE]', err);
    res.status(500).json({ erro: 'Erro ao calcular rentabilidade.' });
  }
}
