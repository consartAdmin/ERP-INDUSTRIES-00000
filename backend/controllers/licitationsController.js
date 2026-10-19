// ╔══════════════════════════════════════════════════════════════════════╗
// ║ licitationsController.js — Controller de Licitações                 ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
    createLicitation,
    deleteLicitation,
    ensureLicitationItemsTable,
    getLicitationById,
    getLicitationsSummary,
    diagnoseLicitationsDatabase,
    listLicitations,
    updateLicitation,
    updateLicitationStatus,
} from '../repositories/licitations/licitations.index.js';

function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(res, error) {
    console.error('[LICITATIONS]', {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
        table: error?.table,
        column: error?.column,
        constraint: error?.constraint,
        stack: error?.stack,
    });

    if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
            ok: false,
            error: error.message,
        });
    }

    if (error?.code === '23505') {
        return res.status(409).json({
            ok: false,
            error: 'Já existe um registro com os mesmos dados únicos.',
        });
    }

    if (error?.code === '22P02') {
        return res.status(400).json({
            ok: false,
            error: 'Um dos valores informados possui formato inválido.',
        });
    }

    return res.status(500).json({
        ok: false,
        error: 'Erro interno ao processar a solicitação.',
        details:
            process.env.NODE_ENV === 'development'
                ? error?.message
                : undefined,
    });
}

export async function initializeLicitations(req, res) {
    try {
        await ensureLicitationItemsTable();

        return res.status(200).json({
            ok: true,
            message: 'Estrutura de licitações verificada com sucesso.',
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function list(req, res) {
    try {
        const result = await listLicitations(req.query);

        return res.status(200).json({
            ok: true,
            data: result.rows,
            pagination: result.pagination,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getById(req, res) {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'ID inválido.',
            });
        }

        const licitation = await getLicitationById(id);

        if (!licitation) {
            return res.status(404).json({
                ok: false,
                error: 'Item de licitação não encontrado.',
            });
        }

        return res.status(200).json({
            ok: true,
            data: licitation,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function create(req, res) {
    try {
        const licitation = await createLicitation(req.body);

        return res.status(201).json({
            ok: true,
            message: 'Item de licitação criado com sucesso.',
            data: licitation,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function update(req, res) {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'ID inválido.',
            });
        }

        const licitation = await updateLicitation(id, req.body);

        if (!licitation) {
            return res.status(404).json({
                ok: false,
                error: 'Item de licitação não encontrado.',
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Item de licitação atualizado com sucesso.',
            data: licitation,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function remove(req, res) {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'ID inválido.',
            });
        }

        const licitation = await deleteLicitation(id);

        if (!licitation) {
            return res.status(404).json({
                ok: false,
                error: 'Item de licitação não encontrado.',
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Item de licitação excluído com sucesso.',
            data: licitation,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function changeStatus(req, res) {
    try {
        const id = parseId(req.params.id);

        if (!id) {
            return res.status(400).json({
                ok: false,
                error: 'ID inválido.',
            });
        }

        const licitation = await updateLicitationStatus(id, req.body?.status);

        if (!licitation) {
            return res.status(404).json({
                ok: false,
                error: 'Item de licitação não encontrado.',
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Status atualizado com sucesso.',
            data: licitation,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function summary(req, res) {
    try {
        const data = await getLicitationsSummary(req.query);

        return res.status(200).json({
            ok: true,
            data,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function diagnose(req, res) {
    try {
        const data = await diagnoseLicitationsDatabase();

        return res.status(200).json({
            ok: true,
            data,
        });
    } catch (error) {
        return sendError(res, error);
    }
}

