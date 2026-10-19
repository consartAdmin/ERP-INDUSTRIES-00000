// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ 📄 backend/routes/sequenciaNfeRoutes.js — Rotas de controle de numeração NF-e ║
// ║ Integra com services/sequenciaNfeService.js                                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import express from 'express';
import {
  peekSequencia,
  alocarNumeroNfe,
  marcarAutorizado,
} from '../services/sequenciaNfeService.js';

const router = express.Router();

/**
 * 🧩 Helper para obter parâmetros-padrão da query ou sessão.
 */
function parseParams(req) {
  const empresa_id = Number(req.query.empresa_id ?? req.query.num_emp ?? req.user?.empresa_id ?? 13);
  const filial_id  = Number(req.query.filial_id  ?? req.user?.filial_id  ?? 1);
  const modelo     = String(req.query.modelo ?? 55);
  const serie      = Number(req.query.serie  ?? 1);
  return { empresa_id, filial_id, modelo, serie };
}

/**
 * 📘 GET /api/sequenciaNfe/preview
 * Retorna o próximo número NF-e, mas sem reservar.
 */
router.get('/preview', async (req, res) => {
  try {
    const params = parseParams(req);
    const proximo = await peekSequencia(null, params);
    return res.json({ ok: true, numero: proximo });
  } catch (err) {
    console.error('Erro em /sequenciaNfe/preview:', err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

/**
 * 📗 GET /api/sequenciaNfe/alocar
 * Gera (reserva) o próximo número NF-e e atualiza ultimo_utilizado.
 */
router.get('/alocar', async (req, res) => {
  try {
    const params = parseParams(req);
    const numero = await alocarNumeroNfe(null, params);
    res.json({ ok: true, numero });
  } catch (err) {
    console.error('Erro em /sequenciaNfe/alocar:', err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

/**
 * 📙 POST /api/sequenciaNfe/marcar
 * Marca o número informado como autorizado (atualiza ultimo_autorizado).
 */
router.post('/marcar', async (req, res) => {
  try {
    const params = parseParams(req);
    const numero = Number(req.body.numero);
    if (!numero) return res.status(400).json({ ok: false, msg: 'Número inválido.' });
    await marcarAutorizado(null, { ...params, numero });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em /sequenciaNfe/marcar:', err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

export default router;
