// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsRoutes.js — Rotas HTTP de Segmentos de Cliente       ║
// ║ CONSART ERP | ESM + Express Router                                   ║
// ║                                                                      ║
// ║ Rotas expostas (compatibilidade total):                              ║
// ║                                                                      ║
// ║  ✅ GET    /api/customerSegments         (LEGACY - camelCase)       ║
// ║  ✅ GET    /api/customer-segments        (oficial - kebab-case)     ║
// ║                                                                      ║
// ║  GET    /api/customer-segments/:id                                 ║
// ║  POST   /api/customer-segments                                     ║
// ║  PUT    /api/customer-segments/:id                                  ║
// ║  DELETE /api/customer-segments/:id                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  listCustomerSegments,
  getCustomerSegmentById,
  createCustomerSegment,
  updateCustomerSegment,
  removeCustomerSegment
} from '../controllers/customerSegmentsController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

/* ============================================================================
   ✅ LEGACY ENDPOINT (compatível com customersSegmentsBatch.js)
   GET /api/customerSegments?limit=500&active=true
   Retorna no formato esperado pelo front:
   {
     rows: [...],
     total: X,
     limit: X,
     offset: X
   }
============================================================================ */

router.get('/customerSegments', async (req, res) => {
  try {
    const { q = '', active, limit = 20, offset = 0 } = req.query || {};

    const result = await listCustomerSegments(
      {
        query: { q, active, limit, offset }
      },
      {
        json: () => {}, // dummy (não será usado)
        status: () => ({ json: () => {} })
      }
    );

    // 🔥 Em vez de reutilizar response padrão do controller,
    // chamamos diretamente o service via controller interno
    const parsedLimit = Math.min(
      100,
      Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 20)
    );

    const parsedOffset = Math.max(
      0,
      Number.isFinite(Number(offset)) ? Number(offset) : 0
    );

    const data = await import('../repositories/customerSegments/customerSegments.index.js')
      .then(m => m.list({ q, active, limit: parsedLimit, offset: parsedOffset }));

    return res.json({
      rows: data.rows,
      total: data.total,
      limit: data.limit,
      offset: data.offset
    });

  } catch (err) {
    console.error('❌ Legacy route /customerSegments error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao listar segmentos (legacy route).'
    });
  }
});

/* ============================================================================
   ✅ ROTAS OFICIAIS (kebab-case padrão CONSART)
============================================================================ */

// Lista com filtro + paginação
router.get('/customer-segments', listCustomerSegments);

// Busca por ID
router.get('/customer-segments/:id', getCustomerSegmentById);

// Criação
router.post('/customer-segments', createCustomerSegment);

// Atualização
router.put('/customer-segments/:id', updateCustomerSegment);

// Remoção (soft ou hard via ?hard=true)
router.delete('/customer-segments/:id', removeCustomerSegment);

export default router;