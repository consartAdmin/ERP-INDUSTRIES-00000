// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ customersSegmentsBatchController.js — HTTP Layer (Express Controllers)      ║
// ║ - GET  /api/customers/segments/batch-list                                   ║
// ║ - POST /api/customers/segments/batch-apply                                  ║
// ║ - POST /api/customers/segments/unlink                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import * as csbApi from '../repositories/customersSegmentsBatch/customersSegmentsBatch.index.js';

const toBool = (v) => {
  if (v === '' || v == null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['true', '1', 't', 'yes', 'y', 'sim', 's'].includes(s)) return true;
  if (['false', '0', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return undefined;
};

export async function batchList(req, res) {
  try {
    const { q, hasSegment, limit, offset } = req.query;

    const result = await csbApi.listBatch({
      q: (q || '').trim(),
      hasSegment: toBool(hasSegment),
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ batchList(customersSegments) error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

export async function batchApply(req, res) {
  try {
    const { customerIds, segment_id } = req.body || {};

    const result = await csbApi.batchApply({
      customerIds: Array.isArray(customerIds) ? customerIds : [],
      segment_id,
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ batchApply(customersSegments) error:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

export async function unlink(req, res) {
  try {
    const { customer_id } = req.body || {};
    const result = await csbApi.unlinkOne({ customer_id });
    return res.json(result);
  } catch (err) {
    console.error('❌ unlink(customersSegments) error:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

export default { batchList, batchApply, unlink };