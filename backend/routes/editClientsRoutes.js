// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 📡 backend/routes/editClientsRoutes.js – Rotas de Edição de Clientes 📡  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import express from 'express';
import axios from 'axios';
import * as controller from '../controllers/editClientsController.js';

const router = express.Router();

/* Middleware local: garante x-request-id nas respostas do sub-router */
router.use((req, res, next) => {
  if (!req.requestId) {
    // se o app principal não setou, cria um simples
    req.requestId = Math.random().toString(36).slice(2);
  }
  res.setHeader('x-request-id', req.requestId);
  next();
});

/* ===== Rotas internas (base) ===== */
router.get('/clientes/cnpj/:cnpj', controller.buscarPorCNPJ);
router.get('/clientes/cep/:cep', controller.buscarPorCEP);
router.put('/clientes/:id', controller.atualizarCliente);

/* ===== Consulta externa CNPJ (ReceitaWS) =====
   Observações:
   - Valida CNPJ numérico (14 dígitos).
   - Timeout curto para não travar a UI.
   - Respostas padronizadas com requestId. */
router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  const { cnpj } = req.params;
  const reqId = req.requestId || null;

  const onlyDigits = String(cnpj || '').replace(/\D/g, '');
  if (onlyDigits.length !== 14) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'CNPJ inválido. Informe 14 dígitos.',
      requestId: reqId
    });
  }

  try {
    const response = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${onlyDigits}`, {
      timeout: 8000, // 8s
      headers: { 'Accept': 'application/json' },
      validateStatus: () => true, // vamos tratar manualmente
    });

    // ReceitaWS costuma devolver 200 com { status: "ERROR", message: "..." }
    const data = response.data || {};
    if (response.status >= 400 || data.status === 'ERROR') {
      return res.status(502).json({
        status: 'ERROR',
        message: data?.message || `Falha na consulta de CNPJ (ReceitaWS).`,
        detail: `HTTP ${response.status}`,
        requestId: reqId
      });
    }

    return res.json({ status: 'OK', data, requestId: reqId });
  } catch (error) {
    const isTimeout = error?.code === 'ECONNABORTED';
    console.error('❌ Erro na consulta CNPJ (ReceitaWS):', JSON.stringify({
      requestId: reqId,
      code: error?.code,
      message: error?.message
    }));

    return res.status(504).json({
      status: 'ERROR',
      message: isTimeout ? 'Timeout consultando a ReceitaWS.' : 'Erro ao consultar CNPJ na ReceitaWS.',
      code: error?.code || null,
      requestId: reqId
    });
  }
});

router.get('/clientes/unique-asaas', controller.verificarAsaasUnico);


export default router;
