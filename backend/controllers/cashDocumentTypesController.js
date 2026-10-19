// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashDocumentTypesController.js — Tipos de Documento do Caixa       ║
// ║ CONSART ERP | Controllers HTTP                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    createCashDocumentType,
    ensureCashDocumentTypesTable,
    getCashDocumentTypeById,
    listCashDocumentTypes,
    removeCashDocumentType,
    seedCashDocumentTypes,
    setCashDocumentTypeActive,
    toggleCashDocumentTypeActive,
    updateCashDocumentType,
} from '../repositories/cashDocumentTypes/cashDocumentTypes.index.js';

function sendError(res, error, fallbackMessage) {
    const status = Number(error?.statusCode) || 500;

    if (status >= 500) {
        console.error('[cashDocumentTypesController]', error);
    }

    return res.status(status).json({
        ok: false,
        error: error?.message || fallbackMessage,
    });
}

export async function list(req, res) {
    try {
        const rows = await listCashDocumentTypes({
            search: req.query.search,
            activeOnly: req.query.activeOnly ?? req.query.active,
            includeInactive: req.query.includeInactive,
        });

        return res.json({ ok: true, data: rows, total: rows.length });
    } catch (error) {
        return sendError(res, error, 'Erro ao listar tipos de documento.');
    }
}

export async function getById(req, res) {
    try {
        const row = await getCashDocumentTypeById(req.params.id);

        if (!row) {
            return res.status(404).json({
                ok: false,
                error: 'Tipo de documento não encontrado.',
            });
        }

        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao consultar tipo de documento.');
    }
}

export async function create(req, res) {
    try {
        const row = await createCashDocumentType(req.body);
        return res.status(201).json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao criar tipo de documento.');
    }
}

export async function update(req, res) {
    try {
        const row = await updateCashDocumentType(req.params.id, req.body);

        if (!row) {
            return res.status(404).json({
                ok: false,
                error: 'Tipo de documento não encontrado.',
            });
        }

        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao atualizar tipo de documento.');
    }
}

export async function remove(req, res) {
    try {
        const row = await removeCashDocumentType(req.params.id);

        if (!row) {
            return res.status(404).json({
                ok: false,
                error: 'Tipo de documento não encontrado.',
            });
        }

        return res.json({
            ok: true,
            message: 'Tipo de documento desativado com sucesso.',
            data: row,
        });
    } catch (error) {
        return sendError(res, error, 'Erro ao desativar tipo de documento.');
    }
}

export async function setActive(req, res) {
    try {
        if (typeof req.body?.is_active !== 'boolean') {
            return res.status(400).json({
                ok: false,
                error: 'Informe is_active como true ou false.',
            });
        }

        const row = await setCashDocumentTypeActive(
            req.params.id,
            req.body.is_active
        );

        if (!row) {
            return res.status(404).json({
                ok: false,
                error: 'Tipo de documento não encontrado.',
            });
        }

        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao alterar situação do tipo de documento.');
    }
}

export async function toggleActive(req, res) {
    try {
        const row = await toggleCashDocumentTypeActive(req.params.id);

        if (!row) {
            return res.status(404).json({
                ok: false,
                error: 'Tipo de documento não encontrado.',
            });
        }

        return res.json({ ok: true, data: row });
    } catch (error) {
        return sendError(res, error, 'Erro ao alternar situação do tipo de documento.');
    }
}

export async function setup(req, res) {
    try {
        await ensureCashDocumentTypesTable();
        const rows = await seedCashDocumentTypes();

        return res.json({
            ok: true,
            message: 'Tabela e tipos iniciais preparados com sucesso.',
            data: rows,
        });
    } catch (error) {
        return sendError(res, error, 'Erro ao preparar tipos de documento.');
    }
}
