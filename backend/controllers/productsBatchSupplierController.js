// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchSupplierController.js — Lote de Fornecedor em Produtos ║
// ║ CONSART ERP | ESM + PostgreSQL                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

// -----------------------------------------------------
// POST /api/products-batch-supplier
// body: { targetSupplierId, productIds: [1,2,3] }
// -----------------------------------------------------
export async function applySupplierBatch(req, res) {
  try {
    const { targetSupplierId, productIds } = req.body;

    if (!targetSupplierId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'targetSupplierId e productIds são obrigatórios.',
      });
    }

    const params = [targetSupplierId];
    const placeholders = productIds.map((id, idx) => {
      params.push(id);
      return `$${idx + 2}`;
    });

    const sql = `
      UPDATE public."products"
         SET supplier_id = $1
       WHERE id IN (${placeholders.join(', ')})
    `;

    await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Fornecedor aplicado em lote com sucesso.',
      updatedCount: productIds.length,
    });
  } catch (err) {
    console.error('Erro applySupplierBatch:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao aplicar fornecedor em lote.',
    });
  }
}
