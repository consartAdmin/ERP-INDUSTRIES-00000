// ╔══════════════════════════════════════════════════════════════════════╗
// ║ processesController.js — Controller REST de Processos — CONSART ERP ║
// ║ Rotas: /api/processes                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import processesApi from '../repositories/processes/processes.index.js';
import generateProcessesPdf from '../generationPdf/generationProcessesPdf.js'; // ✅ CAMINHO REAL

/* ────────────────────────────────────────────────────────────── */
/* Listar processos (GET /api/processes)                         */
/* ────────────────────────────────────────────────────────────── */
export async function listProcesses(req, res) {
  try {
    const {
      q = '',
      status = '',
      limit = 20,
      offset = 0,
    } = req.query;

    const data = await processesApi.list({
      q: String(q || ''),
      status: String(status || ''),
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
    });

    return res.json({
      ok: true,
      ...data,
    });
  } catch (err) {
    console.error('[processesController.listProcesses] erro:', err);
    return res.status(500).json({ ok: false, message: 'Erro ao listar processos' });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Criar processo                                                */
/* ────────────────────────────────────────────────────────────── */
export async function createProcess(req, res) {
  try {
    const { codigo, nome, descricao, status } = req.body;

    const created = await processesApi.create({
      codigo,
      nome,
      descricao,
      status,
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    console.error('[processesController.createProcess] erro:', err);
    return res.status(400).json({ ok: false, message: err.message });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Atualizar processo                                            */
/* ────────────────────────────────────────────────────────────── */
export async function updateProcess(req, res) {
  try {
    const { id } = req.params;
    const { codigo, nome, descricao, status, is_active } = req.body;

    const updated = await processesApi.update(id, {
      codigo,
      nome,
      descricao,
      status,
      is_active,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Processo não encontrado' });
    }

    return res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[processesController.updateProcess] erro:', err);
    return res.status(400).json({ ok: false, message: err.message });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Remover processo                                              */
/* ────────────────────────────────────────────────────────────── */
export async function deleteProcess(req, res) {
  try {
    const { id } = req.params;

    await processesApi.remove(id, { hard: false });

    return res.json({ ok: true, message: 'Processo removido com sucesso' });
  } catch (err) {
    console.error('[processesController.deleteProcess] erro:', err);
    return res.status(400).json({ ok: false, message: err.message });
  }
}

/* ────────────────────────────────────────────────────────────── */
/* GERAR PDF (GET /api/processes/:id/pdf)                        */
/* ────────────────────────────────────────────────────────────── */
export async function processPdf(req, res) {
  try {
    const { id } = req.params;

    const proc = await processesApi.getById(id);
    if (!proc) {
      return res.status(404).json({ ok: false, message: 'Processo não encontrado' });
    }

    const filename =
      (proc.codigo || `processo-${proc.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9\-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') + '.pdf';

    const buffer = await generateProcessesPdf(proc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[processesController.processPdf] erro:', err);
    return res.status(500).json({ ok: false, message: 'Erro ao gerar PDF do processo' });
  }
}

export default {
  listProcesses,
  createProcess,
  updateProcess,
  deleteProcess,
  processPdf,
};
