// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsController.js — Controller Canhoto NF-e Digital          ║
// ║ CONSART ERP                                                         ║
// ║ Identificação por: nfe_key ou nfe_number                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as api from '../repositories/nfeReceipts/nfeReceipts.index.js';

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Helpers                                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

function publicReceipt(row) {
  if (!row) return null;

  const { signature_png, ...safe } = row;
  return safe;
}

function cleanDigits(v = '') {
  return String(v || '').replace(/\D/g, '');
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Ensure Table                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function ensureTable(req, res) {
  try {
    await api.ensureTable();

    res.json({
      ok: true,
      message: 'nfeReceipts table ensured',
    });
  } catch (err) {
    console.error('[nfeReceipts] ensureTable error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Create Pending Receipt by Invoice ID                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function createPendingByNfeId(req, res) {
  try {
    const nfeId = Number(req.params.nfeId || req.body?.nfe_id);

    if (!Number.isFinite(nfeId) || nfeId <= 0) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_ID' });
    }

    const row = await api.createPendingReceiptByNfeId(nfeId);

    res.json({
      ok: true,
      data: publicReceipt(row),
      publicUrl: `/receipts/receipts.html?key=${row.access_key}`,
    });
  } catch (err) {
    console.error('[nfeReceipts] createPendingByNfeId error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Create Pending Receipt by NF-e Number                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function createPendingByNumber(req, res) {
  try {
    const number = cleanDigits(req.params.number || req.body?.nfe_number);

    if (!number) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_NUMBER' });
    }

    const row = await api.createPendingReceiptByNfeNumber(number);

    res.json({
      ok: true,
      data: publicReceipt(row),
      publicUrl: `/receipts/receipts.html?number=${number}`,
    });
  } catch (err) {
    console.error('[nfeReceipts] createPendingByNumber error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Get Receipt by Access Key                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function getByAccessKey(req, res) {
  try {
    const key = cleanDigits(req.params.key || req.query.key);

    if (key.length !== 44) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACCESS_KEY' });
    }

    const row = await api.getByAccessKey(key);

    if (!row) {
      return res.status(404).json({ ok: false, error: 'RECEIPT_NOT_FOUND' });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] getByAccessKey error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Get Receipt by NF-e Number                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function getByNfeNumber(req, res) {
  try {
    const number = cleanDigits(req.params.number || req.query.number);

    if (!number) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_NUMBER' });
    }

    const row = await api.getByNfeNumber(number);

    if (!row) {
      return res.status(404).json({ ok: false, error: 'RECEIPT_NOT_FOUND' });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] getByNfeNumber error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Get Receipt by Invoice ID                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function getByNfeId(req, res) {
  try {
    const nfeId = Number(req.params.nfeId);

    if (!Number.isFinite(nfeId) || nfeId <= 0) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_ID' });
    }

    const row = await api.getByNfeId(nfeId);

    if (!row) {
      return res.status(404).json({ ok: false, error: 'RECEIPT_NOT_FOUND' });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] getByNfeId error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Sign Receipt by Access Key                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function signByAccessKey(req, res) {
  try {
    const key = cleanDigits(req.params.key || req.body?.key);

    if (key.length !== 44) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACCESS_KEY' });
    }

    const row = await api.signReceiptByAccessKey(key, req.body || {}, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'RECEIPT_NOT_FOUND_OR_INVALID_STATUS',
      });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] signByAccessKey error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Sign Receipt by NF-e Number                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function signByNfeNumber(req, res) {
  try {
    const number = cleanDigits(req.params.number || req.body?.nfe_number);

    if (!number) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_NUMBER' });
    }

    const row = await api.signReceiptByNfeNumber(number, req.body || {}, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'RECEIPT_NOT_FOUND_OR_INVALID_STATUS',
      });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] signByNfeNumber error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Refuse Receipt by Access Key                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function refuseByAccessKey(req, res) {
  try {
    const key = cleanDigits(req.params.key || req.body?.key);

    if (key.length !== 44) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACCESS_KEY' });
    }

    const row = await api.refuseReceiptByAccessKey(key, req.body || {}, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'RECEIPT_NOT_FOUND_OR_INVALID_STATUS',
      });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] refuseByAccessKey error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Refuse Receipt by NF-e Number                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function refuseByNfeNumber(req, res) {
  try {
    const number = cleanDigits(req.params.number || req.body?.nfe_number);

    if (!number) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_NUMBER' });
    }

    const row = await api.refuseReceiptByNfeNumber(number, req.body || {}, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: 'RECEIPT_NOT_FOUND_OR_INVALID_STATUS',
      });
    }

    res.json({ ok: true, data: publicReceipt(row) });
  } catch (err) {
    console.error('[nfeReceipts] refuseByNfeNumber error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ List Receipts                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function listReceipts(req, res) {
  try {
    const data = await api.listReceipts({
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      q: req.query.q,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });

    res.json({ ok: true, ...data });
  } catch (err) {
    console.error('[nfeReceipts] listReceipts error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Get Signature PNG by Access Key                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function getSignaturePngByAccessKey(req, res) {
  try {
    const key = cleanDigits(req.params.key || req.query.key);

    if (key.length !== 44) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACCESS_KEY' });
    }

    const buffer = await api.getSignaturePngByAccessKey(key);

    if (!buffer) {
      return res.status(404).json({ ok: false, error: 'SIGNATURE_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    console.error('[nfeReceipts] getSignaturePngByAccessKey error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Get Signature PNG by NF-e Number                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

export async function getSignaturePngByNfeNumber(req, res) {
  try {
    const number = cleanDigits(req.params.number || req.query.number);

    if (!number) {
      return res.status(400).json({ ok: false, error: 'INVALID_NFE_NUMBER' });
    }

    const buffer = await api.getSignaturePngByNfeNumber(number);

    if (!buffer) {
      return res.status(404).json({ ok: false, error: 'SIGNATURE_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    console.error('[nfeReceipts] getSignaturePngByNfeNumber error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}