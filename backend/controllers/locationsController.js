// ╔══════════════════════════════════════════════════════════════════════╗
// ║ locationsController.js — Warehouse Locations Controller (CONSART)     ║
// ║ Routes base: /api/locations                                          ║
// ║ Uses: locationsApi.js + productsLocationsApi.js + pg pool             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import locationsApi from '../repositories/locations/locations.index.js';
import productsLocationsApi from '../repositories/productsLocations/productsLocations.index.js';
import pool from '../config/db.js';

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function handleDbError(res, err, origin) {
  console.error(`[locationsController] ${origin} error:`, err);

  // Duplicate (unique_violation)
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Registro já existente (duplicado).',
      origin,
      code: err.code,
      detail: err.detail,
    });
  }

  // Not-null violation
  if (err.code === '23502') {
    return res.status(400).json({
      error: 'Campo obrigatório não informado.',
      origin,
      code: err.code,
      detail: err.column,
    });
  }

  // Foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Violação de chave estrangeira.',
      origin,
      code: err.code,
      detail: err.detail,
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    origin,
  });
}

const toBool = (v, def = true) => {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 't', 'y', 'yes', 'sim'].includes(s)) return true;
  if (['false', '0', 'f', 'n', 'no', 'nao', 'não'].includes(s)) return false;
  return def;
};

const toInt = (v, def = null) => {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
};

const toStrOrNull = (v) => {
  if (v === undefined) return undefined; // "não mexe" (para update)
  if (v === null || v === '') return null;
  return String(v);
};

const toTrimOrNull = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  return s ? s : null;
};

/* --------------------------------------------------------------------- */
/* 1) LOCALS                                                             */
/* --------------------------------------------------------------------- */

// GET /api/locations/locals
export async function listLocals(req, res) {
  try {
    const activeOnly =
      typeof req.query.activeOnly === 'string'
        ? req.query.activeOnly === 'true'
        : true;

    const rows = await locationsApi.listLocals(pool, { activeOnly });
    return res.json(rows);
  } catch (err) {
    return handleDbError(res, err, 'listLocals');
  }
}

// POST /api/locations/locals
export async function createLocal(req, res) {
  try {
    const body = req.body || {};
    const rawName = body.name ?? body.local ?? body.nome ?? '';
    const name = String(rawName).trim();

    if (!name) {
      return res.status(400).json({
        error: 'Name (nome do local) é obrigatório.',
        origin: 'createLocal',
      });
    }

    const description =
      body.description ?? body.descricao ?? body.obs ?? null;

    const active =
      typeof body.active === 'boolean'
        ? body.active
        : String(body.active ?? 'true').toLowerCase() !== 'false';

    const local = await locationsApi.createLocal(pool, {
      name,
      description,
      active,
    });

    return res.status(201).json(local);
  } catch (err) {
    return handleDbError(res, err, 'createLocal');
  }
}

// PUT /api/locations/locals/:id
export async function updateLocal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido', origin: 'updateLocal' });
    }

    const payload = {};
    if (req.body.name !== undefined) payload.name = String(req.body.name).trim();
    if (req.body.description !== undefined) payload.description = req.body.description;
    if (req.body.active !== undefined) {
      payload.active =
        typeof req.body.active === 'boolean'
          ? req.body.active
          : String(req.body.active).toLowerCase() === 'true';
    }

    const updated = await locationsApi.updateLocal(pool, id, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Local não encontrado', origin: 'updateLocal' });
    }

    return res.json(updated);
  } catch (err) {
    return handleDbError(res, err, 'updateLocal');
  }
}

// DELETE /api/locations/locals/:id
export async function deleteLocal(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'ID inválido', origin: 'deleteLocal' });
    }

    await locationsApi.deleteLocal(pool, id);
    return res.status(204).send();
  } catch (err) {
    return handleDbError(res, err, 'deleteLocal');
  }
}

/* --------------------------------------------------------------------- */
/* 2) CORRIDORS                                                          */
/* --------------------------------------------------------------------- */

// GET /api/locations/corridors
export async function listCorridors(req, res) {
  try {
    const localId = req.query.localId ? Number(req.query.localId) : null;
    const activeOnly =
      typeof req.query.activeOnly === 'string'
        ? req.query.activeOnly === 'true'
        : true;

    const rows = await locationsApi.listCorridors(pool, {
      localId,
      activeOnly,
    });
    return res.json(rows);
  } catch (err) {
    return handleDbError(res, err, 'listCorridors');
  }
}

// POST /api/locations/corridors
export async function createCorridor(req, res) {
  try {
    const body = req.body || {};
    const rawName = body.name ?? body.corridor ?? body.nome ?? '';
    const name = String(rawName).trim();

    if (!name) {
      return res.status(400).json({
        error: 'Name (nome do corredor) é obrigatório.',
        origin: 'createCorridor',
      });
    }

    const description = body.description ?? body.descricao ?? null;
    const local_id = body.local_id ? Number(body.local_id) : null;
    const active =
      typeof body.active === 'boolean'
        ? body.active
        : String(body.active ?? 'true').toLowerCase() !== 'false';

    const corridor = await locationsApi.createCorridor(pool, {
      name,
      description,
      local_id,
      active,
    });

    return res.status(201).json(corridor);
  } catch (err) {
    return handleDbError(res, err, 'createCorridor');
  }
}

/* --------------------------------------------------------------------- */
/* 3) SHELVES                                                            */
/* --------------------------------------------------------------------- */

export async function listShelves(req, res) {
  try {
    const corridorId = req.query.corridorId ? Number(req.query.corridorId) : null;
    const activeOnly =
      typeof req.query.activeOnly === 'string'
        ? req.query.activeOnly === 'true'
        : true;

    const rows = await locationsApi.listShelves(pool, {
      corridorId,
      activeOnly,
    });
    return res.json(rows);
  } catch (err) {
    return handleDbError(res, err, 'listShelves');
  }
}

export async function createShelf(req, res) {
  try {
    const body = req.body || {};
    const rawName = body.name ?? body.shelf ?? body.nome ?? '';
    const name = String(rawName).trim();

    if (!name) {
      return res.status(400).json({
        error: 'Name (nome da prateleira) é obrigatório.',
        origin: 'createShelf',
      });
    }

    const description = body.description ?? body.descricao ?? null;
    const corridor_id = body.corridor_id ? Number(body.corridor_id) : null;
    const active =
      typeof body.active === 'boolean'
        ? body.active
        : String(body.active ?? 'true').toLowerCase() !== 'false';

    const shelf = await locationsApi.createShelf(pool, {
      name,
      description,
      corridor_id,
      active,
    });

    return res.status(201).json(shelf);
  } catch (err) {
    return handleDbError(res, err, 'createShelf');
  }
}

/* --------------------------------------------------------------------- */
/* 4) BINS                                                               */
/* --------------------------------------------------------------------- */

export async function listBins(req, res) {
  try {
    const shelfId = req.query.shelfId ? Number(req.query.shelfId) : null;
    const activeOnly =
      typeof req.query.activeOnly === 'string'
        ? req.query.activeOnly === 'true'
        : true;

    const rows = await locationsApi.listBins(pool, {
      shelfId,
      activeOnly,
    });
    return res.json(rows);
  } catch (err) {
    return handleDbError(res, err, 'listBins');
  }
}

export async function createBin(req, res) {
  try {
    const body = req.body || {};
    const rawName = body.name ?? body.bin ?? body.nome ?? '';
    const name = String(rawName).trim();

    if (!name) {
      return res.status(400).json({
        error: 'Name (nome da bandeja/bin) é obrigatório.',
        origin: 'createBin',
      });
    }

    const description = body.description ?? body.descricao ?? null;
    const shelf_id = body.shelf_id ? Number(body.shelf_id) : null;
    const active =
      typeof body.active === 'boolean'
        ? body.active
        : String(body.active ?? 'true').toLowerCase() !== 'false';

    const bin = await locationsApi.createBin(pool, {
      name,
      description,
      shelf_id,
      active,
    });

    return res.status(201).json(bin);
  } catch (err) {
    return handleDbError(res, err, 'createBin');
  }
}

/* --------------------------------------------------------------------- */
/* 5) POSITIONS                                                          */
/* --------------------------------------------------------------------- */

export async function listPositions(req, res) {
  try {
    const binId = req.query.binId ? Number(req.query.binId) : null;
    const activeOnly =
      typeof req.query.activeOnly === 'string'
        ? req.query.activeOnly === 'true'
        : true;

    const rows = await locationsApi.listPositions(pool, {
      binId,
      activeOnly,
    });
    return res.json(rows);
  } catch (err) {
    return handleDbError(res, err, 'listPositions');
  }
}

export async function createPosition(req, res) {
  try {
    const body = req.body || {};
    const rawName = body.name ?? body.position ?? body.nome ?? '';
    const name = String(rawName).trim();

    if (!name) {
      return res.status(400).json({
        error: 'Name (nome da posição) é obrigatório.',
        origin: 'createPosition',
      });
    }

    const description = body.description ?? body.descricao ?? null;
    const bin_id = body.bin_id ? Number(body.bin_id) : null;
    const active =
      typeof body.active === 'boolean'
        ? body.active
        : String(body.active ?? 'true').toLowerCase() !== 'false';

    const position = await locationsApi.createPosition(pool, {
      name,
      description,
      bin_id,
      active,
    });

    return res.status(201).json(position);
  } catch (err) {
    return handleDbError(res, err, 'createPosition');
  }
}

/* --------------------------------------------------------------------- */
/* 5.1) LOCATION MAP — full warehouse structure                           */
/* --------------------------------------------------------------------- */

// GET /api/locations/map?q=&corredor=&prateleira=&bandeja=&onlyActive=true
export async function listLocationMap(req, res) {
  try {
    const {
      q = '',
      corredor = '',
      prateleira = '',
      bandeja = '',
      onlyActive = true,
      limit = 5000,
    } = req.query;

    const rows = await locationsApi.listLocationMap(pool, {
      q,
      corredor,
      prateleira,
      bandeja,
      onlyActive: toBool(onlyActive, true),
      limit: Number(limit) || 5000,
    });

    return res.json({
      ok: true,
      rows,
      data: rows,
      total: rows.length,
    });
  } catch (err) {
    return handleDbError(res, err, 'listLocationMap');
  }
}

/* --------------------------------------------------------------------- */
/* 6) PRODUCTS LOCATIONS (NEW: public."productsLocations")                */
/* --------------------------------------------------------------------- */
/**
 * IMPORTANTE:
 * Antes havia "localizationProducts" com local_id/corridor_id/etc.
 * Agora a tabela oficial é:
 *   id, product_code, store_id, corredor, prateleira, bandeja, box, observacao,
 *   created_at, updated_at, is_active
 *
 * Estes endpoints aqui ficam como "ponte" para compatibilidade.
 */

// GET /api/locations/product-locations?product_code=...&store_id=...&q=...&onlyActive=true
// GET /api/locations/product-locations?productCode=...&storeId=...&q=...&onlyActive=true
export async function listProductLocations(req, res) {
  try {
    const {
      q,
      product_code,
      productCode,
      sku,
      store_id,
      storeId,
      onlyActive = false,
      limit = 100,
      offset = 0,
      withMeta = false, // <- se true, retorna {rows,total,limit,offset}
    } = req.query;

    const pc = (product_code ?? productCode ?? sku ?? null);

    const data = await productsLocationsApi.list({
      q: q ?? null,
      product_code: pc ?? null,
      store_id: (store_id ?? storeId ?? null),
      onlyActive: toBool(onlyActive, false),
      limit: Number(limit) || 100,
      offset: Number(offset) || 0,
    });

    // ✅ compatibilidade com o frontend antigo (espera array)
    const wantMeta = toBool(withMeta, false);
    if (wantMeta) return res.json(data);

    return res.json(Array.isArray(data?.rows) ? data.rows : []);
  } catch (err) {
    return handleDbError(res, err, 'listProductLocations');
  }
}

// POST /api/locations/product-locations
export async function createProductLocation(req, res) {
  try {
    const body = req.body || {};

    const product_code = (body.product_code ?? body.productCode ?? body.sku ?? null);
    if (!product_code) {
      return res.status(400).json({
        error: 'product_code (SKU) é obrigatório.',
        origin: 'createProductLocation',
      });
    }

    const payload = {
      product_code: String(product_code).trim(),
      store_id: toInt(body.store_id ?? body.storeId ?? null, null),

      // aceita também aliases antigos
      corredor: toTrimOrNull(body.corredor ?? body.corridor),
      prateleira: toTrimOrNull(body.prateleira ?? body.shelf),
      bandeja: toTrimOrNull(body.bandeja ?? body.bin),
      box: toTrimOrNull(body.box),

      observacao: toStrOrNull(body.observacao ?? body.observation ?? body.notes),
      is_active: toBool(body.is_active ?? body.active, true),
    };

    const row = await productsLocationsApi.create(payload);
    return res.status(201).json(row);
  } catch (err) {
    return handleDbError(res, err, 'createProductLocation');
  }
}

// PUT /api/locations/product-locations/:id
export async function updateProductLocation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'ID inválido',
        origin: 'updateProductLocation',
      });
    }

    const body = req.body || {};

    const patch = {
      // só envia se veio no body
      product_code: body.product_code !== undefined ? String(body.product_code).trim() : undefined,
      store_id: body.store_id !== undefined || body.storeId !== undefined ? toInt(body.store_id ?? body.storeId, null) : undefined,
      corredor: body.corredor !== undefined || body.corridor !== undefined ? toTrimOrNull(body.corredor ?? body.corridor) : undefined,
      prateleira: body.prateleira !== undefined || body.shelf !== undefined ? toTrimOrNull(body.prateleira ?? body.shelf) : undefined,
      bandeja: body.bandeja !== undefined || body.bin !== undefined ? toTrimOrNull(body.bandeja ?? body.bin) : undefined,
      box: body.box !== undefined ? toTrimOrNull(body.box) : undefined,
      observacao: body.observacao !== undefined || body.observation !== undefined || body.notes !== undefined
        ? toStrOrNull(body.observacao ?? body.observation ?? body.notes)
        : undefined,
      is_active: body.is_active !== undefined || body.active !== undefined ? toBool(body.is_active ?? body.active, true) : undefined,
    };

    const row = await productsLocationsApi.update(id, patch);
    if (!row) {
      return res.status(404).json({
        error: 'Registro não encontrado',
        origin: 'updateProductLocation',
      });
    }

    return res.json(row);
  } catch (err) {
    return handleDbError(res, err, 'updateProductLocation');
  }
}

// DELETE /api/locations/product-locations/:id
export async function deleteProductLocation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'ID inválido',
        origin: 'deleteProductLocation',
      });
    }

    await productsLocationsApi.remove(id);
    return res.status(204).send();
  } catch (err) {
    return handleDbError(res, err, 'deleteProductLocation');
  }
}

// PATCH /api/locations/product-locations/:id/deactivate
export async function deactivateProductLocation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'ID inválido',
        origin: 'deactivateProductLocation',
      });
    }

    const row = await productsLocationsApi.deactivate(id);
    if (!row) {
      return res.status(404).json({
        error: 'Registro não encontrado',
        origin: 'deactivateProductLocation',
      });
    }

    return res.json(row);
  } catch (err) {
    return handleDbError(res, err, 'deactivateProductLocation');
  }
}

// PATCH /api/locations/product-locations/:id/primary
// Define a localização como principal do produto (products.product_location_id)
export async function setPrimaryProductLocation(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'ID inválido',
        origin: 'setPrimaryProductLocation',
      });
    }

    const row = await productsLocationsApi.setPrimary(id);
    if (!row) {
      return res.status(404).json({
        error: 'Registro não encontrado',
        origin: 'setPrimaryProductLocation',
      });
    }

    return res.json(row);
  } catch (err) {
    if (err?.status === 400) {
      return res.status(400).json({ error: err.message, origin: 'setPrimaryProductLocation' });
    }
    return handleDbError(res, err, 'setPrimaryProductLocation');
  }
}
