// ╔═════════════════════════════════════════════════════════════════╗
// ║ paymentMethodsController.js — Express Controllers (ESM)         ║
// ╚═════════════════════════════════════════════════════════════════╝

import * as api from '../repositories/paymentMethods/paymentMethods.index.js';

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

export async function list(req, res) {
  try {
    const { q = '', active = '', limit = '50', offset = '0' } = req.query || {};
    const result = await api.list({
      q: String(q || ''),
      active: active === '' ? undefined : active,
      limit: num(limit, 50),
      offset: num(offset, 0),
    });
    return res.json(result);
  } catch (err) {
    console.error('paymentMethods.list', err);
    return res.status(500).json({ error: 'Failed to list payment methods.' });
  }
}

export async function get(req, res) {
  try {
    const row = await api.getById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    console.error('paymentMethods.get', err);
    return res.status(400).json({ error: err.message || 'Failed to get payment method.' });
  }
}

export async function create(req, res) {
  try {
    const row = await api.create(req.body || {});
    return res.status(201).json(row);
  } catch (err) {
    console.error('paymentMethods.create', err);
    const status = err?.code === '23505' ? 409 : 400;
    return res.status(status).json({ error: err.message || 'Failed to create payment method.' });
  }
}

export async function update(req, res) {
  try {
    const row = await api.update(req.params.id, req.body || {});
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    console.error('paymentMethods.update', err);
    const status = err?.code === '23505' ? 409 : 400;
    return res.status(status).json({ error: err.message || 'Failed to update payment method.' });
  }
}

export async function toggleActive(req, res) {
  try {
    if (typeof req.body?.active === 'undefined') {
      return res.status(400).json({ error: 'O campo "active" é obrigatório.' });
    }

    const row = await api.toggleActive(req.params.id, req.body.active);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    console.error('paymentMethods.toggleActive', err);
    return res.status(400).json({ error: err.message || 'Failed to update payment method status.' });
  }
}

export async function remove(req, res) {
  try {
    const row = await api.remove(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, row });
  } catch (err) {
    console.error('paymentMethods.remove', err);
    return res.status(400).json({ error: err.message || 'Failed to delete payment method.' });
  }
}

export default { list, get, create, update, toggleActive, remove };