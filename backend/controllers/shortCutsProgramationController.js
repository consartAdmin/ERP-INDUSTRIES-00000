// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationController.js                                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import api from '../repositories/shortCutsProgramation/shortCutsProgramation.index.js';

const sendError = (res, err, status = 500) => {
  console.error('[shortCutsProgramationController]', err);
  return res.status(status).json({
    ok: false,
    error: err?.message || 'Internal server error',
  });
};

export async function list(req, res) {
  try {
    const data = await api.list(req.query);
    return res.json({ ok: true, ...data });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listCategories(req, res) {
  try {
    const rows = await api.listCategories(req.query);
    return res.json({ ok: true, rows });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listSubCategories(req, res) {
  try {
    const rows = await api.listSubCategories(req.query);
    return res.json({ ok: true, rows });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getById(req, res) {
  try {
    const row = await api.getById(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Shortcut not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function create(req, res) {
  try {
    const row = await api.create(req.body);
    return res.status(201).json({ ok: true, row });
  } catch (err) {
    const msg = String(err?.message || '');

    if (
      msg.includes('required') ||
      msg.includes('duplicate key') ||
      msg.includes('unique')
    ) {
      return sendError(res, err, 400);
    }

    return sendError(res, err);
  }
}

export async function update(req, res) {
  try {
    const row = await api.update(req.params.id, req.body);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Shortcut not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function remove(req, res) {
  try {
    const row = await api.remove(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Shortcut not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function restore(req, res) {
  try {
    const row = await api.restore(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Shortcut not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createCategory(req, res) {
  try {
    const row = await api.createCategory(req.body);
    return res.status(201).json({ ok: true, row });
  } catch (err) {
    return sendError(res, err, 400);
  }
}

export async function updateCategory(req, res) {
  try {
    const row = await api.updateCategory(req.params.id, req.body);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Category not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function removeCategory(req, res) {
  try {
    const row = await api.removeCategory(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Category not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createSubCategory(req, res) {
  try {
    const row = await api.createSubCategory(req.body);
    return res.status(201).json({ ok: true, row });
  } catch (err) {
    return sendError(res, err, 400);
  }
}

export async function updateSubCategory(req, res) {
  try {
    const row = await api.updateSubCategory(req.params.id, req.body);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategory not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function removeSubCategory(req, res) {
  try {
    const row = await api.removeSubCategory(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'Subcategory not found',
      });
    }

    return res.json({ ok: true, row });
  } catch (err) {
    return sendError(res, err);
  }
}

export default {
  list,
  listCategories,
  listSubCategories,
  getById,
  create,
  update,
  remove,
  restore,

  createCategory,
  updateCategory,
  removeCategory,
  createSubCategory,
  updateSubCategory,
  removeSubCategory,
};