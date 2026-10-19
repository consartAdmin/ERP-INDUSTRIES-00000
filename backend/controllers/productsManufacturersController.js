// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsManufacturersController.js — HTTP (Fabricantes)             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ProductsManufacturersAPI, {
  ensureProductsManufacturersTable,
} from '../repositories/productsManufacturers/productsManufacturers.index.js';

ensureProductsManufacturersTable()
  .then(() => {
    console.log('[productsManufacturersController] Tabela productsManufactures ok.');
  })
  .catch((err) => {
    console.error('[productsManufacturersController] Erro ao garantir tabela:', err);
  });

function sendError(res, err) {
  const status = err?.status || 500;
  console.error('[productsManufacturersController] Erro:', err);
  res.status(status).json({
    ok: false,
    error: err?.message || 'Erro interno ao processar fabricante.',
    details: err?.details || undefined,
  });
}

export async function list(req, res) {
  try {
    const data = await ProductsManufacturersAPI.list(req.query);
    res.json({ ok: true, data });
  } catch (err) {
    sendError(res, err);
  }
}

export async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsManufacturersAPI.getById(id);
    if (!item) return res.status(404).json({ ok: false, error: 'Fabricante não encontrado.' });
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function create(req, res) {
  try {
    const item = await ProductsManufacturersAPI.create(req.body);
    res.status(201).json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsManufacturersAPI.update(id, req.body);
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function deactivate(req, res) {
  try {
    const id = Number(req.params.id);
    const item = await ProductsManufacturersAPI.deactivate(id);
    res.json({ ok: true, data: item });
  } catch (err) {
    sendError(res, err);
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const ok = await ProductsManufacturersAPI.remove(id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Fabricante não encontrado.' });
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
