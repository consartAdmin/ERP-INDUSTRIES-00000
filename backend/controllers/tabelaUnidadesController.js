import db from '../config/db.js';
////
// GET /api/tabelaunidades
export const listarUnidades = async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, unidade, descricao, fator FROM "tabelaUnidades" ORDER BY unidade'
    );
    res.json(rows); // ✅ array
  } catch (error) {
    console.error('❌ Erro ao buscar unidades:', error);
    res.status(500).json({ erro: 'Erro ao buscar unidades.' });
  }
};

// POST /api/tabelaunidades
export const criarUnidade = async (req, res) => {
  try {
    const { unidade, descricao, fator } = req.body;

    if (!unidade || String(unidade).trim() === '') {
      return res.status(400).json({ erro: 'O campo "unidade" é obrigatório.' });
    }

    const fatorNum = fator == null ? 1 : Number(fator);
    if (!Number.isFinite(fatorNum) || fatorNum <= 0) {
      return res.status(400).json({ erro: 'O campo "fator" deve ser um número > 0.' });
    }

    const insert = `
      INSERT INTO "tabelaUnidades" (unidade, descricao, fator)
      VALUES ($1, $2, $3)
      RETURNING id, unidade, descricao, fator
    `;
    const { rows } = await db.query(insert, [unidade.trim(), descricao ?? null, fatorNum]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('❌ Erro ao criar unidade:', err);
    res.status(500).json({ erro: 'Erro ao criar unidade.' });
  }
};

// DELETE /api/tabelaunidades/:id
export const excluirUnidade = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }

    const { rowCount } = await db.query('DELETE FROM "tabelaUnidades" WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ erro: 'Unidade não encontrada.' });

    res.sendStatus(204);
  } catch (err) {
    console.error('❌ Erro ao excluir unidade:', err);
    res.status(500).json({ erro: 'Erro ao excluir unidade.' });
  }
};
