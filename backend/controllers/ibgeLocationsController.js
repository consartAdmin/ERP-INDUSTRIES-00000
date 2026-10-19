// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsController.js — Controller HTTP para IBGE Locations     ║
// ║ CONSART ERP | ESM                                                    ║
// ║ Endpoints (via routes):                                              ║
// ║  GET    /api/ibge-locations                                          ║
// ║  GET    /api/ibge-locations/search                                   ║
// ║  GET    /api/ibge-locations/ufs                                      ║
// ║  GET    /api/ibge-locations/resolve                                  ║
// ║  GET    /api/ibge-locations/count-by-state                           ║
// ║  GET    /api/ibge-locations/by-ibge/:ibgeCode                        ║
// ║  GET    /api/ibge-locations/cities/:state                            ║
// ║  GET    /api/ibge-locations/:id                                      ║
// ║  POST   /api/ibge-locations                                          ║
// ║  PUT    /api/ibge-locations/:id                                      ║
// ║  DELETE /api/ibge-locations/:id  (soft delete: status=false)         ║
// ║  POST   /api/ibge-locations/ensure                                   ║
// ║  POST   /api/ibge-locations/import/state  (IBGE → Banco por UF)      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as IBGE from '../repositories/ibgeLocations/ibgeLocations.index.js';

const okData = (res, data, status = 200) => res.status(status).json({ ok: true, data });
const fail = (res, error, status = 400) =>
  res.status(status).json({ ok: false, error: String(error?.message || error) });

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const toBool = (v) => {
  if (v === undefined) return undefined;
  const s = String(v).toLowerCase().trim();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
  return undefined;
};

/* =======================================================================
 * ✅ UFS (distinct)
 * GET /api/ibge-locations/ufs
 * ======================================================================= */
export async function ufs(req, res) {
  try {
    const parsedStatus = toBool(req.query.status);
    const data = await IBGE.listUfs({ status: parsedStatus });
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * ✅ RESOLVE CITY -> IBGE CODE
 * GET /api/ibge-locations/resolve?uf=MG&city=Belo Horizonte
 * ======================================================================= */
export async function resolveCity(req, res) {
  try {
    const uf = String(req.query.uf || req.query.state || '').trim().toUpperCase().slice(0, 2);
    const city = String(req.query.city || req.query.nome || '').trim();

    if (!uf || uf.length !== 2) return fail(res, 'uf is required (2 chars). Example: ?uf=MG&city=...', 400);
    if (!city || city.length < 2) return fail(res, 'city is required. Example: ?uf=MG&city=Belo Horizonte', 400);

    const data = await IBGE.resolveCity({ uf, city });
    if (!data) return fail(res, 'Not found', 404);

    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * ENSURE TABLE
 * ======================================================================= */
export async function ensure(_req, res) {
  try {
    const r = await IBGE.ensureTable();
    okData(res, r);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * LIST (✅ paginação real: page/limit -> offset, e retorna pagination)
 * Query:
 *  q, state, status, page, limit, offset
 * Response:
 *  { ok:true, data:[...], pagination:{page,limit,offset,total,totalPages} }
 * ======================================================================= */
export async function list(req, res) {
  try {
    const { q, state } = req.query;

    const parsedStatus = toBool(req.query.status);

    const limit = toInt(req.query.limit, 10);
    const page = toInt(req.query.page, 1) || 1;

    const offset =
      req.query.offset !== undefined
        ? toInt(req.query.offset, 0)
        : (Math.max(1, page) - 1) * limit;

    const result = await IBGE.list({
      q,
      state,
      status: parsedStatus,
      limit,
      offset,
      includeTotal: true,
    });

    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    const total = Array.isArray(result) ? null : (toInt(result?.total, null));

    const totalPages =
      total === null ? null : Math.max(1, Math.ceil(total / Math.max(1, limit)));

    return res.status(200).json({
      ok: true,
      data: rows,
      pagination: {
        page: Math.max(1, page),
        limit,
        offset,
        total,
        totalPages,
      },
    });
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * SEARCH (alias)
 * ======================================================================= */
export async function search(req, res) {
  try {
    const q = req.query.q ?? '';
    const limit = req.query.limit ?? 50;
    const data = await IBGE.search(q, limit);
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * ✅ COUNT BY STATE (quantidade de cidades por UF)
 * GET /api/ibge-locations/count-by-state?status=true
 * ======================================================================= */
export async function countByState(req, res) {
  try {
    const parsedStatus = toBool(req.query.status);
    const data = await IBGE.countByState({ status: parsedStatus });
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * GET BY IBGE CODE
 * ======================================================================= */
export async function getByIbgeCode(req, res) {
  try {
    const { ibgeCode } = req.params;
    const data = await IBGE.getByIbgeCode(ibgeCode);
    if (!data) return fail(res, 'Not found', 404);
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * ✅ CITIES BY STATE (com q/limit/offset opcional)
 * GET /api/ibge-locations/cities/:state?q=bel&limit=50&offset=0
 * ======================================================================= */
export async function citiesByState(req, res) {
  try {
    const { state } = req.params;

    const q = req.query.q ?? '';
    const limit = toInt(req.query.limit, 200);
    const offset = toInt(req.query.offset, 0);

    const parsedStatus = (req.query.status === undefined) ? true : toBool(req.query.status);

    const data = await IBGE.getCitiesByState(state, {
      q,
      limit,
      offset,
      status: parsedStatus,
    });

    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * GET BY ID
 * ======================================================================= */
export async function getById(req, res) {
  try {
    const { id } = req.params;
    const data = await IBGE.getById(id);
    if (!data) return fail(res, 'Not found', 404);
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * ✅ IMPORT BY STATE (IBGE → Banco por UF)
 * body: { state: "MG" }  (aceita também uf/sigla)
 * ======================================================================= */
export async function importByState(req, res) {
  try {
    const state =
      req.body?.state ??
      req.body?.uf ??
      req.body?.sigla ??
      req.query?.state ??
      req.query?.uf ??
      null;

    if (!state) return fail(res, 'State (UF) is required. Example: { "state": "MG" }', 400);

    await IBGE.ensureTable();
    const result = await IBGE.importByState(state);
    okData(res, result, 200);
  } catch (e) {
    fail(res, e, 500);
  }
}

/* =======================================================================
 * CREATE
 * ======================================================================= */
export async function create(req, res) {
  try {
    const data = await IBGE.create(req.body || {});
    okData(res, data, 201);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique')) {
      return fail(res, msg, 409);
    }
    fail(res, e, 400);
  }
}

/* =======================================================================
 * UPDATE
 * ======================================================================= */
export async function update(req, res) {
  try {
    const { id } = req.params;
    const data = await IBGE.update(id, req.body || {});
    if (!data) return fail(res, 'Not found', 404);
    okData(res, data);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique')) {
      return fail(res, msg, 409);
    }
    fail(res, e, 400);
  }
}

/* =======================================================================
 * REMOVE (soft delete status=false)
 * ======================================================================= */
export async function remove(req, res) {
  try {
    const { id } = req.params;
    const data = await IBGE.remove(id);
    if (!data) return fail(res, 'Not found', 404);
    okData(res, data);
  } catch (e) {
    fail(res, e, 500);
  }
}

export default {
  ensure,
  list,
  search,
  ufs,
  resolveCity,
  countByState,
  getByIbgeCode,
  citiesByState,
  getById,
  create,
  update,
  remove,
  importByState,
};
