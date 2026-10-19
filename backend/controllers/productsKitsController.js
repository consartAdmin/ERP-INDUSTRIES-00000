// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKitsController.js                                     ║
// ║ MODULE: Products Kits Controller                                    ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureProductsKitsTables,
  listProductsKits,
  getProductsKitById,
  createProductsKit,
  updateProductsKit,
  deleteProductsKit,
  hardDeleteProductsKit,
} from '../repositories/productsKits/productsKits.index.js';

export async function ensure(req, res) {
  try {
    await ensureProductsKitsTables();

    return res.json({
      ok: true,
      message: 'Products kits tables ensured successfully.',
    });
  } catch (error) {
    console.error('[productsKitsController.ensure]', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to ensure products kits tables.',
    });
  }
}

export async function list(req, res) {
  try {
    const { q = '', active = true } = req.query;

    const rows = await listProductsKits({
      q,
      active,
    });

    return res.json({
      ok: true,
      rows,
    });
  } catch (error) {
    console.error('[productsKitsController.list]', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to list products kits.',
    });
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params;

    const kit = await getProductsKitById(id);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: 'Products kit not found.',
      });
    }

    return res.json({
      ok: true,
      data: kit,
    });
  } catch (error) {
    console.error('[productsKitsController.getById]', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to get products kit.',
    });
  }
}

export async function create(req, res) {
  try {
    const created = await createProductsKit(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Products kit created successfully.',
      data: created,
    });
  } catch (error) {
    console.error('[productsKitsController.create]', error);

    return res.status(400).json({
      ok: false,
      error: error.message || 'Failed to create products kit.',
    });
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params;

    const updated = await updateProductsKit(id, req.body);

    return res.json({
      ok: true,
      message: 'Products kit updated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('[productsKitsController.update]', error);

    return res.status(400).json({
      ok: false,
      error: error.message || 'Failed to update products kit.',
    });
  }
}

export async function remove(req, res) {
  try {
    const { id } = req.params;

    const removed = await deleteProductsKit(id);

    if (!removed) {
      return res.status(404).json({
        ok: false,
        error: 'Products kit not found.',
      });
    }

    return res.json({
      ok: true,
      message: 'Products kit deactivated successfully.',
      data: removed,
    });
  } catch (error) {
    console.error('[productsKitsController.remove]', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to deactivate products kit.',
    });
  }
}

export async function destroy(req, res) {
  try {
    const { id } = req.params;

    const removed = await hardDeleteProductsKit(id);

    if (!removed) {
      return res.status(404).json({
        ok: false,
        error: 'Products kit not found.',
      });
    }

    return res.json({
      ok: true,
      message: 'Products kit permanently deleted.',
      data: removed,
    });
  } catch (error) {
    console.error('[productsKitsController.destroy]', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to delete products kit.',
    });
  }
}