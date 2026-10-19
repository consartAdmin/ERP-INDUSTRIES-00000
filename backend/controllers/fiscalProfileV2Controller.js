// ╔══════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2Controller.js — Express Controller (ESM)          ║
// ╚══════════════════════════════════════════════════════════════════╝

import * as svc from '../repositories/fiscalProfileV2/fiscalProfileV2.index.js';

const bool = (value) => value === undefined ? undefined : ['true', '1'].includes(String(value).toLowerCase());
const page = (query) => ({
  limit: Math.min(Math.max(Number(query.limit) || 100, 1), 500),
  offset: Math.max(Number(query.offset) || 0, 0)
});
const sendError = (res, error) => {
  const duplicate = error.code === '23505';
  res.status(error.status || (duplicate ? 409 : 500)).json({
    ok: false, code: duplicate ? 'DUPLICATE_PROFILE' : 'FISCAL_PROFILE_ERROR', message: error.message
  });
};

export async function list(req, res) {
  try { res.json({ ok: true, data: await svc.list({ active: bool(req.query.active), search: req.query.search, ...page(req.query) }) }); }
  catch (error) { sendError(res, error); }
}
export async function getById(req, res) {
  try {
    const data = await svc.getById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, code: 'PROFILE_NOT_FOUND' });
    res.json({ ok: true, data });
  } catch (error) { sendError(res, error); }
}
export async function create(req, res) {
  try {
    if (!req.body.profile_name?.trim()) return res.status(400).json({ ok: false, code: 'PROFILE_NAME_REQUIRED' });
    res.status(201).json({ ok: true, data: await svc.create(req.body) });
  } catch (error) { sendError(res, error); }
}
export async function update(req, res) {
  try {
    const data = await svc.update(req.params.id, req.body);
    if (!data) return res.status(404).json({ ok: false, code: 'PROFILE_NOT_FOUND' });
    res.json({ ok: true, data });
  } catch (error) { sendError(res, error); }
}
export async function setActive(req, res) {
  try {
    if (typeof req.body.is_active !== 'boolean') return res.status(400).json({ ok: false, code: 'IS_ACTIVE_REQUIRED' });
    const data = await svc.setActive(req.params.id, req.body.is_active);
    if (!data) return res.status(404).json({ ok: false, code: 'PROFILE_NOT_FOUND' });
    res.json({ ok: true, data });
  } catch (error) { sendError(res, error); }
}
