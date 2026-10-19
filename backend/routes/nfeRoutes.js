// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeRoutes.js — Operações fiscais gerais de NF-e                     ║
// ║ CONSART ERP | Express Router | ESM                                  ║
// ║ Emissão/consulta de pedidos pertence a ordersNfeAttemptsRoutes.js    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';
import tecnospeedNfeInutilizacaoApi
  from '../repositories/tecnoSpeedNfeInutilizacao/tecnoSpeedNfeInutilizacao.index.js';

const router = express.Router();

function getNfeAmbiente() {
  const raw = String(process.env.NFE_AMBIENTE || 'producao')
    .toLowerCase()
    .trim();

  if (raw.startsWith('sandbox') || raw === 'teste') {
    return 'sandbox';
  }

  if (raw.startsWith('homolog')) {
    return 'homologacao';
  }

  return 'producao';
}

function hasNfeCreds() {
  const baseUrl = process.env.PLUGNOTAS_BASE_URL || null;
  const mockEnabled = String(process.env.PLUGNOTAS_MOCK || '0') === '1';

  if (mockEnabled) {
    return Boolean(baseUrl);
  }

  const apiKey =
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    process.env.PLUGNOTAS_API_KEY_HOMOLOG ||
    null;

  return Boolean(baseUrl && apiKey);
}

function hasConfiguredApiKey() {
  return Boolean(
    process.env.PLUGNOTAS_API_KEY ||
    process.env.PLUGNOTAS_API_KEY_REAL ||
    process.env.PLUGNOTAS_API_KEY_SANDBOX ||
    process.env.PLUGNOTAS_API_KEY_HOMOLOG,
  );
}

/* =========================================================================
 * Inutilização de faixa de numeração
 * POST /api/nfe/inutilizacao
 * ========================================================================= */
router.post('/nfe/inutilizacao', async (req, res) => {
  try {
    const ambiente = getNfeAmbiente();

    if (!hasNfeCreds()) {
      return res.status(400).json({
        ok: false,
        message:
          'Configuração de NF-e incompleta: verifique PLUGNOTAS_BASE_URL e API_KEY.',
        meta: {
          ambiente,
          baseURL: process.env.PLUGNOTAS_BASE_URL || null,
          hasApiKey: hasConfiguredApiKey(),
          mock: process.env.PLUGNOTAS_MOCK || '0',
        },
      });
    }

    const body = req.body || {};

    const result = await tecnospeedNfeInutilizacaoApi.inutilizarFaixaNFe({
      modelo: body.modelo ?? body.mod ?? 55,
      serie: body.serie ?? 1,
      numeroInicial:
        body.numeroInicial ?? body.nInicial ?? body.inicio,
      numeroFinal:
        body.numeroFinal ?? body.nFinal ?? body.fim,
      justificativa:
        body.justificativa ?? body.motivo ?? body.reason,
      ano: body.ano ?? body.aa,
      cpfCnpj: body.cpfCnpj ?? body.cnpj ?? null,
      uf: body.uf ?? null,
      cuf: body.cuf ?? body.cUF ?? null,
      ambienteProducao:
        typeof body.ambienteProducao === 'boolean'
          ? body.ambienteProducao
          : ambiente === 'producao',
    });

    return res
      .status(result?.ok ? 200 : (result?.status || 502))
      .json(result);
  } catch (error) {
    console.error('[nfeRoutes.inutilizarFaixaNFe] ERR:', error);

    return res.status(error?.status ?? 500).json({
      ok: false,
      error: error?.code ?? 'NFE_VOID_RANGE_ERROR',
      message:
        error?.message || 'Erro interno ao inutilizar numeração de NF-e.',
    });
  }
});

/* =========================================================================
 * Consulta de inutilização
 * GET /api/nfe/inutilizacao/:id
 * ========================================================================= */
router.get('/nfe/inutilizacao/:id', async (req, res) => {
  try {
    const id = String(req.params.id ?? '').trim();

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_VOID_ID',
        message: 'Identificador da inutilização não informado.',
      });
    }

    const result =
      await tecnospeedNfeInutilizacaoApi.consultarInutilizacao(id);

    return res
      .status(result?.ok ? 200 : (result?.status || 502))
      .json(result);
  } catch (error) {
    console.error('[nfeRoutes.consultarInutilizacao] ERR:', error);

    return res.status(error?.status ?? 500).json({
      ok: false,
      error: error?.code ?? 'NFE_VOID_STATUS_ERROR',
      message:
        error?.message || 'Erro interno ao consultar inutilização de NF-e.',
    });
  }
});

export default router;
