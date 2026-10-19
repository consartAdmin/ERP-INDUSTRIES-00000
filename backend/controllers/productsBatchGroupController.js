// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchGroupController.js — Lote de Grupo em Produtos         ║
// ║ CONSART ERP | ESM + PostgreSQL                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

// -----------------------------------------------------
// POST /api/products-batch-group
// body: { targetGroupId, productIds: [1,2,3] }
// -----------------------------------------------------
export async function applyGroupBatch(req, res) {
  try {
    const { targetGroupId, productIds } = req.body;

    if (!targetGroupId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'targetGroupId e productIds são obrigatórios.',
      });
    }

    const params = [targetGroupId];
    const placeholders = productIds.map((id, idx) => {
      params.push(id);
      return `$${idx + 2}`;
    });

    const sql = `
      UPDATE public."products"
         SET group_id = $1
       WHERE id IN (${placeholders.join(', ')})
    `;

    await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Grupo aplicado em lote com sucesso.',
      updatedCount: productIds.length,
    });
  } catch (err) {
    console.error('Erro applyGroupBatch:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao aplicar grupo em lote.',
    });
  }
}
