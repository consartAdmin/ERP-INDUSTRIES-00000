// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliersController.js — HTTP (Fornecedores)                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ProductsSuppliersAPI, {
  ensureProductsSuppliersTable,
} from '../repositories/productsSuppliers/productsSuppliers.index.js';

ensureProductsSuppliersTable()
  .then(() => {
    console.log('[productsSuppliersController] Tabela productsSuppliers ok.');
  })
  .catch((err) => {
    console.error('[productsSuppliersController] Erro ao garantir tabela:', err);
  });

function sendError(res, err) {
  const status = err?.status || 500;
  console.error('[productsSuppliersController] Erro:', err);
  res.status(status).json({
    ok: false,
    error: err?.message || 'Erro interno ao processar fornecedor.',
    details: err?.details || undefined,
  });
}

export async function list(req, res) {
  try {
    const data = await ProductsSuppliersAPI.list(req.query);
    res.json({ ok: true, data });
  } catch (err) {
    sendError(res, err);
  }
}

export async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsSuppliersAPI.getById(id);
    if (!item) return res.status(404).json({ ok: false, error: 'Fornecedor não encontrado.' });
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function create(req, res) {
  try {
    const item = await ProductsSuppliersAPI.create(req.body);
    res.status(201).json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsSuppliersAPI.update(id, req.body);
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function deactivate(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsSuppliersAPI.deactivate(id);
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const ok = await ProductsSuppliersAPI.remove(id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Fornecedor não encontrado.' });
    res.json({ ok: true, data: { removed: true } });
  } catch (err) {
    sendError(res, err);
  }
}

export default {
  list,
  getById,
  create,
  update,
  deactivate,
  remove,
};
