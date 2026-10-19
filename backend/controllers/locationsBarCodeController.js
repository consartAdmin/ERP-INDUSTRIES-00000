// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsBarCodeController.js — Controller Locations BarCode        ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';
import locationsBarCodeApi from '../repositories/locationsBarCode/locationsBarCode.index.js';

function ok(res, data = null, extra = {}) {
  return res.json({
    ok: true,
    data,
    ...extra,
  });
}

function fail(res, status = 500, error = 'Internal server error') {
  return res.status(status).json({
    ok: false,
    error,
  });
}

export async function listLocationsBarCode(req, res) {
  try {
    const rows = await locationsBarCodeApi.list(pool, {
      q: req.query.q || '',
      activeOnly: String(req.query.activeOnly || '').toLowerCase() === 'true',
      limit: req.query.limit || 500,
      offset: req.query.offset || 0,
    });

    return ok(res, rows, { total: rows.length });
  } catch (error) {
    console.error('[locationsBarCodeController] list error:', error);
    return fail(res, 500, error.message);
  }
}

export async function getLocationsBarCodeById(req, res) {
  try {
    const { id } = req.params;

    const row = await locationsBarCodeApi.getById(pool, id);

    if (!row) {
      return fail(res, 404, 'Barcode location not found');
    }

    return ok(res, row);
  } catch (error) {
    console.error('[locationsBarCodeController] getById error:', error);
    return fail(res, 500, error.message);
  }
}

export async function readLocationsBarCode(req, res) {
  try {
    const barcode = req.params.barcode || req.query.barcode || req.body?.barcode;

    if (!barcode) {
      return fail(res, 400, 'barcode is required');
    }

    const row = await locationsBarCodeApi.getByBarcode(pool, barcode);

    if (!row) {
      return fail(res, 404, 'No active location found for this barcode');
    }

    return ok(res, row);
  } catch (error) {
    console.error('[locationsBarCodeController] read error:', error);
    return fail(res, 500, error.message);
  }
}

export async function createLocationsBarCode(req, res) {
  try {
    const row = await locationsBarCodeApi.create(pool, req.body || {});
    return res.status(201).json({
      ok: true,
      data: row,
    });
  } catch (error) {
    console.error('[locationsBarCodeController] create error:', error);

    if (error.code === '23505') {
      return fail(res, 409, 'Barcode already exists');
    }

    return fail(res, 500, error.message);
  }
}

export async function updateLocationsBarCode(req, res) {
  try {
    const { id } = req.params;

    const row = await locationsBarCodeApi.update(pool, id, req.body || {});

    if (!row) {
      return fail(res, 404, 'Barcode location not found');
    }

    return ok(res, row);
  } catch (error) {
    console.error('[locationsBarCodeController] update error:', error);

    if (error.code === '23505') {
      return fail(res, 409, 'Barcode already exists');
    }

    return fail(res, 500, error.message);
  }
}

export async function deactivateLocationsBarCode(req, res) {
  try {
    const { id } = req.params;

    const row = await locationsBarCodeApi.deactivate(pool, id);

    if (!row) {
      return fail(res, 404, 'Barcode location not found');
    }

    return ok(res, row);
  } catch (error) {
    console.error('[locationsBarCodeController] deactivate error:', error);
    return fail(res, 500, error.message);
  }
}

export async function deleteLocationsBarCode(req, res) {
  try {
    const { id } = req.params;

    await locationsBarCodeApi.remove(pool, id);

    return ok(res, {
      id,
      deleted: true,
    });
  } catch (error) {
    console.error('[locationsBarCodeController] delete error:', error);
    return fail(res, 500, error.message);
  }
}

export async function generateLocationsBarCodeBins(req, res) {
  try {
    const rows = await locationsBarCodeApi.generateBins(pool);

    return ok(res, rows, {
      generated: rows.length,
      message: rows.length
        ? 'Barcodes generated successfully.'
        : 'No new barcode generated. Existing barcodes were preserved.',
    });
  } catch (error) {
    console.error('[locationsBarCodeController] generateBins error:', error);
    return fail(res, 500, error.message);
  }
}