// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxRegimesController.js — Regime Tributário                         ║
// ║ CONSART ERP | Controllers HTTP                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    createTaxRegime,
    getTaxRegimeById,
    listTaxRegimes,
    setTaxRegimeActive,
    updateTaxRegime,
} from '../repositories/taxRegimes/taxRegimes.repository.js';

import {
    REGIMES,
    REGIME_DEFAULTS,
    SIMPLES_ANNEXES,
} from '../repositories/taxRegimes/taxRegimes.constants.js';

function sendError(res, error, fallbackMessage) {
    const status = Number(error?.statusCode) || 500;

    if (status >= 500) {
        console.error('[taxRegimesController]', error);
    }

    return res.status(status).json({
        ok: false,
        error: error?.message || fallbackMessage,
    });
}

export async function list(req, res) {
    try {
        const includeInactive = ['1', 'true'].includes(String(req.query.includeInactive || ''));
        const rows = await listTaxRegimes({ includeInactive });

        return res.json({ ok: true, data: rows, total: rows.length });
    } catch (error) {
        return sendError(res, error, 'Erro ao listar regimes tributários.');
    }
}

export async function options(req, res) {
    return res.json({
        ok: true,
        regimes: REGIMES,
        defaults: REGIME_DEFAULTS,
        simplesAnnexes: SIMPLES_ANNEXES,
    });
}

export async function getById(req, res) {
    try {
        const row = await getTaxRegimeById(req.params.id);

        if (!row) {
            return res.status(404).json({ ok: false, error: 'Regime tributário não encontrado.' });
        }

        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao consultar regime tributário.');
    }
}

export async function create(req, res) {
    try {
        const row = await createTaxRegime(req.body || {});
        return res.status(201).json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao cadastrar regime tributário.');
    }
}

export async function update(req, res) {
    try {
        const row = await updateTaxRegime(req.params.id, req.body || {});
        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao atualizar regime tributário.');
    }
}

export async function setActive(req, res) {
    try {
        const row = await setTaxRegimeActive(req.params.id, req.body?.is_active !== false);
        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao alterar status do regime tributário.');
    }
}
