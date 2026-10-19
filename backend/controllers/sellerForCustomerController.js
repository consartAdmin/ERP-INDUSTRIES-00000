// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerController.js — HTTP Layer (Express Controllers)   ║
// ║ Link Sellers ↔ Customers (SellerForCustomer)                        ║
// ║ CONSART ERP · Uses sellerForCustomerApi (Postgres)                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as sellerForCustomerApi from '../repositories/sellerForCustomer/sellerForCustomer.index.js';

/* =========================================================================
   LIST with filters + pagination
   ========================================================================= */

async function list(req, res) {
  try {
    const {
      seller_id,
      customer_id,
      active,
      limit,
      offset,
      orderBy,
    } = req.query;

    const result = await sellerForCustomerApi.listSellerForCustomer({
      seller_id: seller_id ?? undefined,
      customer_id: customer_id ?? undefined,
      active: active === undefined ? undefined : active === 'true' || active === '1',
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      orderBy: orderBy || 'created_at DESC',
    });

    return res.json(result);
  } catch (err) {
    console.error('[sellerForCustomerController.list] Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'LIST_ERROR',
      message: err.message || 'Error listing seller/customer relations.',
    });
  }
}

/* =========================================================================
   GET BY ID
   ========================================================================= */

async function getById(req, res) {
  try {
    const { id } = req.params;
    const item = await sellerForCustomerApi.getSellerForCustomerById(Number(id));

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Relation not found.',
      });
    }

    return res.json({ ok: true, item });
  } catch (err) {
    console.error('[sellerForCustomerController.getById] Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'GET_ERROR',
      message: err.message || 'Error loading relation.',
    });
  }
}

/* =========================================================================
   CREATE
   ========================================================================= */

async function create(req, res) {
  try {
    const payload = req.body || {};

    const created = await sellerForCustomerApi.createSellerForCustomer(payload);

    return res.status(201).json({
      ok: true,
      item: created,
    });
  } catch (err) {
    console.error('[sellerForCustomerController.create] Error:', err);

    if (err?.code === 'DUPLICATE_RELATION') {
      return res.status(409).json({
        ok: false,
        error: 'DUPLICATE_RELATION',
        message: err.message || 'This seller is already linked to this customer.',
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'CREATE_ERROR',
      message: err.message || 'Error creating relation.',
    });
  }
}

/* =========================================================================
   UPDATE
   ========================================================================= */

async function update(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const updated = await sellerForCustomerApi.updateSellerForCustomer(Number(id), payload);

    if (!updated) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Relation not found.',
      });
    }

    return res.json({
      ok: true,
      item: updated,
    });
  } catch (err) {
    console.error('[sellerForCustomerController.update] Error:', err);

    if (err?.code === 'DUPLICATE_RELATION') {
      return res.status(409).json({
        ok: false,
        error: 'DUPLICATE_RELATION',
        message: err.message || 'This seller is already linked to this customer.',
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'UPDATE_ERROR',
      message: err.message || 'Error updating relation.',
    });
  }
}

/* =========================================================================
   DELETE
   ========================================================================= */

async function remove(req, res) {
  try {
    const { id } = req.params;
    const ok = await sellerForCustomerApi.deleteSellerForCustomer(Number(id));

    if (!ok) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: 'Relation not found.',
      });
    }

    return res.json({
      ok: true,
      deletedId: Number(id),
    });
  } catch (err) {
    console.error('[sellerForCustomerController.remove] Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'DELETE_ERROR',
      message: err.message || 'Error deleting relation.',
    });
  }
}

/* =========================================================================
   HELPERS: Customers by Seller / Sellers by Customer
   ========================================================================= */

async function listCustomersBySeller(req, res) {
  try {
    const { sellerId } = req.params;
    const items = await sellerForCustomerApi.listCustomersBySeller(Number(sellerId));

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error('[sellerForCustomerController.listCustomersBySeller] Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'LIST_CUSTOMERS_BY_SELLER_ERROR',
      message: err.message || 'Error listing customers for this seller.',
    });
  }
}

async function listSellersByCustomer(req, res) {
  try {
    const { customerId } = req.params;
    const items = await sellerForCustomerApi.listSellersByCustomer(Number(customerId));

    return res.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error('[sellerForCustomerController.listSellersByCustomer] Error:', err);
    return res.status(500).json({
      ok: false,
      error: 'LIST_SELLERS_BY_CUSTOMER_ERROR',
      message: err.message || 'Error listing sellers for this customer.',
    });
  }
}

/* =========================================================================
   HEALTHCHECK
   ========================================================================= */

async function ping(req, res) {
  try {
    const ok = await sellerForCustomerApi.ping();
    return res.json({ ok });
  } catch (err) {
    console.error('[sellerForCustomerController.ping] Error:', err);
    return res.status(500).json({ ok: false, error: 'PING_ERROR' });
  }
}

/* =========================================================================
   DEFAULT EXPORT
   ========================================================================= */

const sellerForCustomerController = {
  list,
  getById,
  create,
  update,
  remove,
  listCustomersBySeller,
  listSellersByCustomer,
  ping,
};

export default sellerForCustomerController;
