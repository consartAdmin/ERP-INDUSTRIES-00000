// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taskGroupsController.js                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import taskGroupsApi from '../repositories/taskGroups/taskGroups.index.js';

function sendError(res, error) {
  console.error('[taskGroupsController]', error);

  return res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Erro interno no servidor.',
  });
}

export async function ensure(req, res) {
  try {
    await taskGroupsApi.ensureTable();
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function list(req, res) {
  try {
    const result = await taskGroupsApi.list(req.query);
    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getById(req, res) {
  try {
    const row = await taskGroupsApi.getById(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Grupo de tarefa não encontrado.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function create(req, res) {
  try {
    const row = await taskGroupsApi.create(req.body);

    return res.status(201).json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function update(req, res) {
  try {
    const row = await taskGroupsApi.update(req.params.id, req.body);

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function remove(req, res) {
  try {
    const row = await taskGroupsApi.remove(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Grupo de tarefa não encontrado.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function restore(req, res) {
  try {
    const row = await taskGroupsApi.restore(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Grupo de tarefa não encontrado.',
      });
    }

    return res.json({
      ok: true,
      row,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export default {
  ensure,
  list,
  getById,
  create,
  update,
  remove,
  restore,
};