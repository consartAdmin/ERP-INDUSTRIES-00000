/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ pdv_loginsController.js — Controller dos usuários do PDV            ║
   ║ CONSART ERP                                                          ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import {
    ensureTable,
    list,
    getById,
    create,
    update,
    setActive,
    remove,
    verifyCredentials,
} from '../repositories/pdv_logins/pdv_logins.index.js';

ensureTable()
    .then(() => console.log('[pdv_loginsController] Tabela pdv_logins verificada.'))
    .catch((error) => console.error('[pdv_loginsController] Erro ao verificar tabela:', error));

function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(res, error) {
    console.error('[pdv_loginsController]', error);

    if (error?.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Este nome de usuário já está cadastrado.',
        });
    }

    if (error?.code === '23503') {
        return res.status(409).json({
            success: false,
            message: 'Este usuário possui registros vinculados e não pode ser excluído.',
        });
    }

    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
        success: false,
        message: status === 500 ? 'Erro interno ao processar usuários do PDV.' : error.message,
    });
}

export async function listPdvLogins(req, res) {
    try {
        const result = await list(req.query);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function getPdvLoginById(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });

    try {
        const data = await getById(id);
        if (!data) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function createPdvLogin(req, res) {
    try {
        const data = await create(req.body);
        return res.status(201).json({ success: true, message: 'Usuário criado com sucesso.', data });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function updatePdvLogin(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });

    try {
        const data = await update(id, req.body);
        if (!data) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        return res.status(200).json({ success: true, message: 'Usuário atualizado com sucesso.', data });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function changePdvLoginStatus(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });
    if (req.body?.active === undefined) {
        return res.status(400).json({ success: false, message: 'Informe o campo active.' });
    }

    try {
        const data = await setActive(id, req.body.active);
        if (!data) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        return res.status(200).json({ success: true, message: 'Status atualizado com sucesso.', data });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function deletePdvLogin(req, res) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });

    try {
        const deleted = await remove(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        return res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        return sendError(res, error);
    }
}

export async function authenticatePdvLogin(req, res) {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Informe usuário e senha.' });
    }

    try {
        const data = await verifyCredentials(username, password);
        if (!data) {
            return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
        }
        return res.status(200).json({ success: true, message: 'Credenciais válidas.', data });
    } catch (error) {
        return sendError(res, error);
    }
}
