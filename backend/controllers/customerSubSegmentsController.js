// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ customerSubSegmentsController.js — REST Controller (ESM)                 ║
// ║ Subsegmentos de clientes                                                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import customerSubSegmentsApi from '../repositories/customerSubSegments/customerSubSegments.index.js';

const {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove
} = customerSubSegmentsApi;

const ok         = (res, data) => res.status(200).json(data);
const created    = (res, data) => res.status(201).json(data);
const noContent  = (res)       => res.status(204).end();
const badRequest = (res, msg)  => res.status(400).json({ error: msg });
const notFound   = (res, msg)  => res.status(404).json({ error: msg });
const serverError = (res, err) => {
  console.error("❌ customerSubSegmentsController error:", err);
  return res.status(500).json({ error: "Internal server error", detail: err?.message });
};

/* CREATE */
export async function createHandler(req, res) {
  try {
    const { segment_id, subsegment_name, description, is_active } = req.body || {};

    if (!segment_id) return badRequest(res, "segment_id is required.");
    if (!subsegment_name) return badRequest(res, "subsegment_name is required.");

    const record = await create({
      segment_id,
      subsegment_name,
      description,
      is_active
    });

    return created(res, record);

  } catch (err) {
    return serverError(res, err);
  }
}

/* LIST */
export async function listHandler(req, res) {
  try {
    const data = await list({
      q: req.query.q || '',
      segment_id: req.query.segment_id || null,
      active: req.query.active,
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0
    });
    return ok(res, data);
  } catch (err) {
    return serverError(res, err);
  }
}

/* GET BY ID */
export async function getByIdHandler(req, res) {
  try {
    const row = await getById(req.params.id);
    if (!row) return notFound(res, "Subsegment not found.");
    return ok(res, row);
  } catch (err) {
    return serverError(res, err);
  }
}

/* UPDATE */
export async function updateHandler(req, res) {
  try {
    const { id } = req.params;
    const { subsegment_name, description, segment_id, is_active } = req.body;

    const updated = await update(id, {
      subsegment_name,
      description,
      segment_id,
      is_active
    });

    if (!updated) return notFound(res, "Subsegment not found.");

    return ok(res, updated);
  } catch (err) {
    return serverError(res, err);
  }
}

/* DELETE */
export async function removeHandler(req, res) {
  try {
    await remove(req.params.id, {
      hard: String(req.query.hard).toLowerCase() === 'true'
    });
    return noContent(res);
  } catch (err) {
    return serverError(res, err);
  }
}

export default {
  createHandler,
  listHandler,
  getByIdHandler,
  updateHandler,
  removeHandler
};
