// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMapController.js — Controller dos status NF-e               ║
// ║ CONSART ERP                                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
    list,
    getById,
    getByCode,
} from '../repositories/nfeStatusMap/nfeStatusMap.index.js';


function sendResult(res, result) {
    if (!result || typeof result !== 'object') {
        return res.status(500).json({
            ok: false,
            error: 'Erro interno inesperado.',
        });
    }

    if (result.ok) {
        return res.status(200).json({
            ok: true,
            data: result.data,
        });
    }

    return res.status(result.status || 500).json({
        ok: false,
        error: result.error || 'Erro interno.',
    });
}


/* =========================================================================
 * GET /api/nfe-status-map
 * ========================================================================= */

export async function listNfeStatuses(req, res) {
    const activeOnly =
        String(req.query.activeOnly ?? 'true').toLowerCase() !== 'false';

    const result = await list({
        activeOnly,
    });

    return sendResult(res, result);
}


/* =========================================================================
 * GET /api/nfe-status-map/:id
 * ========================================================================= */

export async function getNfeStatusById(req, res) {
    const result = await getById(req.params.id);

    return sendResult(res, result);
}


/* =========================================================================
 * GET /api/nfe-status-map/code/:code
 * ========================================================================= */

export async function getNfeStatusByCode(req, res) {
    const result = await getByCode(req.params.code);

    return sendResult(res, result);
}