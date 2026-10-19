// customersCreditController.js — Express controller (ESM)

import customersCreditApi from '../repositories/customersCredit/customersCredit.index.js';

const errorStatus = (error) => {
  if (/required|invalid|must be/i.test(error.message)) return 400;
  return 500;
};

export async function list(req, res) {
  try {
    const data = await customersCreditApi.list(req.query || {});
    return res.json(data);
  } catch (error) {
    console.error('[customersCreditController.list]', error);
    return res.status(errorStatus(error)).json({ error: error.message });
  }
}

export async function getByCustomerId(req, res) {
  try {
    const item = await customersCreditApi.getByCustomerId(req.params.customerId);
    if (!item) return res.status(404).json({ error: 'Customer not found' });
    return res.json(item);
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: error.message });
  }
}

export async function upsertByCustomerId(req, res) {
  try {
    const item = await customersCreditApi.upsertByCustomerId(
      req.params.customerId,
      req.body || {}
    );
    if (!item) return res.status(404).json({ error: 'Customer not found' });
    return res.json(item);
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: error.message });
  }
}

export async function removeByCustomerId(req, res) {
  try {
    const result = await customersCreditApi.removeByCustomerId(req.params.customerId);
    if (!result.ok) return res.status(404).json({ error: 'Credit configuration not found' });
    return res.json(result);
  } catch (error) {
    return res.status(errorStatus(error)).json({ error: error.message });
  }
}

export default { list, getByCustomerId, upsertByCustomerId, removeByCustomerId };