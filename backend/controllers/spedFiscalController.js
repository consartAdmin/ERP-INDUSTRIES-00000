// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscalController.js                                             ║
// ║ Descrição: Controller do módulo SPED Fiscal                         ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import spedFiscalService from '../services/spedFiscal/spedFiscal.service.js';

function parseParams(req) {
  return {
    companyId: Number(req.query.companyId || req.body.companyId),
    month: Number(req.query.month || req.body.month),
    year: Number(req.query.year || req.body.year),
    uf: req.query.uf || req.body.uf || '',
    finalidade: req.query.finalidade || req.body.finalidade || 'original',
  };
}

export async function previewSpedFiscal(req, res) {
  try {
    const result = await spedFiscalService.preview(parseParams(req));
    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('previewSpedFiscal:', error);
    return res.status(400).json({
      ok: false,
      message: error.message || 'Erro ao montar preview do SPED Fiscal.',
    });
  }
}

export async function validateSpedFiscal(req, res) {
  try {
    const result = await spedFiscalService.validate(parseParams(req));
    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('validateSpedFiscal:', error);
    return res.status(400).json({
      ok: false,
      message: error.message || 'Erro ao validar SPED Fiscal.',
    });
  }
}

export async function generateSpedFiscal(req, res) {
  try {
    const result = await spedFiscalService.generate(parseParams(req));
    return res.status(result.ok ? 200 : 422).json(result);
  } catch (error) {
    console.error('generateSpedFiscal error message:', error.message);
    console.error('generateSpedFiscal error stack:', error.stack);
    console.error('generateSpedFiscal full error:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Erro ao gerar SPED Fiscal.',
    });
  }
}

export async function downloadSpedFiscal(req, res) {
  try {
    const loteId = Number(req.params.id);
    const result = await spedFiscalService.download(loteId);

    if (!result) {
      return res.status(404).json({ ok: false, message: 'Lote não encontrado.' });
    }

    if (!result.txt) {
      return res.status(404).json({ ok: false, message: 'Lote sem arquivo gerado (status diferente de "gerado").' });
    }

    if (!result.hashMatches) {
      console.warn(`[SPED Fiscal] lote ${loteId}: dados mudaram desde a geração (hash diferente).`);
    }

    // Envia direto para o navegador; nada é gravado no servidor.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Sped-Hash-Match', result.hashMatches ? 'true' : 'false');
    res.attachment(result.fileName);
    return res.send(result.txt);
  } catch (error) {
    console.error('downloadSpedFiscal:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Erro ao baixar arquivo SPED Fiscal.',
    });
  }
}