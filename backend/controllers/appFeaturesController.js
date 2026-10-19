// appFeaturesController.js — HTTP controllers

import {
    getFeatureByCode,
    listFeatureOptions,
    listFeatures,
    removeFeatureAssignment,
    resolveFeature,
    upsertFeatureAssignment,
} from '../repositories/appFeatures/appFeatures.index.js';

function isTrue(value) {
    return value === true || String(value).toLowerCase() === 'true';
}

function sendError(res, error) {
    console.error('[appFeaturesController]', error);

    if (error.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ ok: false, error: error.message });
    }

    if (error.code === 'FEATURE_OR_OPTION_NOT_FOUND') {
        return res.status(404).json({ ok: false, error: error.message });
    }

    return res.status(500).json({
        ok: false,
        error: 'Não foi possível processar a funcionalidade.',
    });
}

export async function list(req, res) {
    try {
        const rows = await listFeatures({
            includeInactive: isTrue(req.query.includeInactive),
        });

        return res.json({ ok: true, rows });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getByCode(req, res) {
    try {
        const feature = await getFeatureByCode(req.params.featureCode);

        if (!feature) {
            return res.status(404).json({ ok: false, error: 'Funcionalidade não encontrada.' });
        }

        return res.json({ ok: true, feature });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function options(req, res) {
    try {
        const rows = await listFeatureOptions(req.params.featureCode, {
            includeInactive: isTrue(req.query.includeInactive),
        });

        return res.json({ ok: true, rows });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function resolve(req, res) {
    try {
        const feature = await resolveFeature({
            featureCode: req.params.featureCode,
            scopeType: req.query.scopeType ?? 'GLOBAL',
            scopeId: req.query.scopeId ?? 1,
        });

        if (!feature) {
            return res.status(404).json({ ok: false, error: 'Funcionalidade não encontrada.' });
        }

        return res.json({ ok: true, feature });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function saveAssignment(req, res) {
    try {
        const feature = await upsertFeatureAssignment({
            featureCode: req.params.featureCode,
            scopeType: req.body.scopeType ?? 'GLOBAL',
            scopeId: req.body.scopeId ?? 1,
            optionCode: req.body.optionCode ?? null,
            customValue: req.body.customValue ?? null,
            isEnabled: req.body.isEnabled ?? true,
            startsAt: req.body.startsAt ?? null,
            endsAt: req.body.endsAt ?? null,
        });

        return res.json({ ok: true, feature });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function deleteAssignment(req, res) {
    try {
        const removed = await removeFeatureAssignment({
            featureCode: req.params.featureCode,
            scopeType: req.query.scopeType ?? 'GLOBAL',
            scopeId: req.query.scopeId ?? 1,
        });

        if (!removed) {
            return res.status(404).json({ ok: false, error: 'Configuração não encontrada.' });
        }

        return res.json({ ok: true });
    } catch (error) {
        return sendError(res, error);
    }
}

