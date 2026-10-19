// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dreGerencialController.js — DRE Gerencial em Tempo Real             ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import dreGerencialApi from '../repositories/dreGerencial/dreGerencial.index.js';

import generateReportDreGerencialPdfStream from '../generationPdf/generationReportDreGerencialPdf.js';

export async function resumo(req, res) {
  try {
    const data = await dreGerencialApi.getResumo(req.query.month);

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[dreGerencial][resumo] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao gerar resumo DRE.',
      details: err.message,
    });
  }
}

export async function listDespesas(req, res) {
  try {
    const rows = await dreGerencialApi.listDespesas(req.query.month);

    return res.json({
      ok: true,
      rows,
    });
  } catch (err) {
    console.error('[dreGerencial][listDespesas] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao listar despesas.',
      details: err.message,
    });
  }
}

export async function createDespesa(req, res) {
  try {
    const data = await dreGerencialApi.createDespesa(req.body || {});

    return res.status(201).json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[dreGerencial][createDespesa] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao criar despesa.',
      details: err.message,
    });
  }
}

export async function updateDespesa(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID inválido.',
      });
    }

    const data = await dreGerencialApi.updateDespesa(id, req.body || {});

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: 'Despesa não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[dreGerencial][updateDespesa] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao atualizar despesa.',
      details: err.message,
    });
  }
}

export async function deleteDespesa(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID inválido.',
      });
    }

    const data = await dreGerencialApi.deleteDespesa(id);

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: 'Despesa não encontrada.',
      });
    }

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error('[dreGerencial][deleteDespesa] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao excluir despesa.',
      details: err.message,
    });
  }
}

export async function gerarPdfDre(req, res) {
  try {
    const month = req.query.month;

    const resumo = await dreGerencialApi.getResumo(month);
    const despesas = await dreGerencialApi.listDespesas(month);

    const filename = `DRE_Gerencial_${month || 'periodo'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const doc = generateReportDreGerencialPdfStream({
      resumo,
      despesas,
      month,
    });

    doc.pipe(res);
  } catch (err) {
    console.error('[dreGerencial][gerarPdfDre] error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao gerar PDF da DRE.',
      details: err.message,
    });
  }
}

export default {
  resumo,
  listDespesas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
};