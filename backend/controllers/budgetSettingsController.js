// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetSettingsController.js — Parâmetros globais dos Orçamentos    ║
// ║ CONSART ERP | Express | ESM                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import * as api from '../repositories/budgetSettings/budgetSettings.index.js';

const VALID_MODES = new Set(['BLOCK', 'PASSWORD', 'ALLOW']);

function normalizeAccess(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function getAuthenticatedUser(req) {
    return req?.user?.payload || req?.user || req?.auth || {};
}

function isAdministrator(req) {
    const user = getAuthenticatedUser(req);

    const roleCandidates = [
        req?.user?.access_level,
        req?.user?.role,
        user.access_level,
        user.accessLevel,
        user.role,
        user.profile_name,
        user.perfil_nome,
    ].map(normalizeAccess);

    const username = normalizeAccess(
        req?.user?.name ?? user.name ?? user.username,
    );

    return roleCandidates.some((role) => [
        'ADMIN',
        'ADMINISTRATOR',
        'ADMINISTRADOR',
        'SUPERADMIN',
    ].includes(role)) || username === 'ADMIN';
}

function booleanValue(value, field) {
    if (typeof value !== 'boolean') {
        const error = new Error(`${field} deve ser booleano.`);
        error.status = 400;
        error.code = 'INVALID_BOOLEAN_SETTING';
        throw error;
    }

    return value;
}

function modeValue(value) {
    const mode = String(value || '').trim().toUpperCase();

    if (!VALID_MODES.has(mode)) {
        const error = new Error(
            'out_of_stock_mode deve ser BLOCK, PASSWORD ou ALLOW.',
        );
        error.status = 400;
        error.code = 'INVALID_OUT_OF_STOCK_MODE';
        throw error;
    }

    return mode;
}

function updatedByValue(req) {
    const user = getAuthenticatedUser(req);

    return String(
        req?.user?.name ??
        user.name ??
        user.username ??
        req?.user?.user_id ??
        user.user_id ??
        user.id ??
        'admin'
    ).trim().slice(0, 150);
}

export function createBudgetSettingsController(db) {
    if (!db?.query) {
        throw new TypeError('A conexão com o banco de dados não foi informada.');
    }

    return {
        async get(req, res, next) {
            try {
                const settings = await api.getBudgetSettings(db);

                return res.json({
                    ...settings,
                    can_manage: isAdministrator(req),
                });
            } catch (error) {
                return next(error);
            }
        },

        async update(req, res, next) {
            try {
                if (!isAdministrator(req)) {
                    return res.status(403).json({
                        ok: false,
                        error: 'Somente administradores podem alterar os parâmetros.',
                        code: 'BUDGET_SETTINGS_FORBIDDEN',
                    });
                }

                const maxDiscount = Number(req.body?.max_discount_percent);

                if (
                    !Number.isFinite(maxDiscount) ||
                    maxDiscount < 0 ||
                    maxDiscount > 100
                ) {
                    return res.status(400).json({
                        ok: false,
                        error: 'O desconto máximo deve estar entre 0% e 100%.',
                        code: 'INVALID_MAX_DISCOUNT_PERCENT',
                    });
                }

                const settings = await api.updateBudgetSettings(
                    db,
                    {
                        out_of_stock_mode: modeValue(req.body?.out_of_stock_mode),
                        require_stock_lot: booleanValue(
                            req.body?.require_stock_lot,
                            'require_stock_lot',
                        ),
                        allow_manual_unit_price: booleanValue(
                            req.body?.allow_manual_unit_price,
                            'allow_manual_unit_price',
                        ),
                        max_discount_percent: maxDiscount,
                    },
                    updatedByValue(req),
                );

                return res.json({
                    ...settings,
                    can_manage: true,
                });
            } catch (error) {
                return next(error);
            }
        },
    };
}

export default createBudgetSettingsController;
