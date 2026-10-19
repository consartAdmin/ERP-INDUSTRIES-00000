// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBatchManufacturerController.js — Lote Fabricante Produtos   ║
// ║ CONSART ERP | ESM + PostgreSQL                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

// -----------------------------------------------------
// POST /api/products-batch-manufacturer
// body: { targetManufacturerId, productIds: [1,2,3] }
// -----------------------------------------------------
export async function applyManufacturerBatch(req, res) {
  try {
    const { targetManufacturerId, productIds } = req.body;

    if (!targetManufacturerId || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'targetManufacturerId e productIds são obrigatórios.',
      });
    }

    const params = [targetManufacturerId];
    const placeholders = productIds.map((id, idx) => {
      params.push(id);
      return `$${idx + 2}`;
    });

    const sql = `
      UPDATE public."products"
         SET manufacturer_id = $1
       WHERE id IN (${placeholders.join(', ')})
    `;

    await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      message: 'Fabricante aplicado em lote com sucesso.',
      updatedCount: productIds.length,
    });
  } catch (err) {
    console.error('Erro applyManufacturerBatch:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao aplicar fabricante em lote.',
    });
  }
}
