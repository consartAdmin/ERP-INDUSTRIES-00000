// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailSignaturesController.js — Controller de Assinaturas de E-mail  ║
// ║ CONSART ERP — CRUD + assinatura padrão                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import emailSignaturesApi from '../repositories/emailSignatures/emailSignatures.index.js';
import pool from '../config/db.js';

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function parseOwnerUserId(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === 'null') {
    return null;
  }
  if (raw === 'all') return 'all';
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function sendError(res, status, message, detail) {
  console.error('[emailSignaturesController] Error:', message, detail || '');
  return res.status(status).json({
    success: false,
    message,
    detail: detail?.message || detail || null
  });
}

/* --------------------------------------------------------------------- */
/* Listar assinaturas                                                    */
/* --------------------------------------------------------------------- */

export async function listSignatures(req, res) {
  try {
    const ownerUserId = parseOwnerUserId(req.query.ownerUserId);
    const rows = await emailSignaturesApi.list(pool, { ownerUserId });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return sendError(res, 500, 'Erro ao listar assinaturas de e-mail.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Buscar por ID                                                         */
/* --------------------------------------------------------------------- */

export async function getSignatureById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return sendError(res, 400, 'Parâmetro "id" inválido.');
    }

    const row = await emailSignaturesApi.getById(pool, id);
    if (!row) {
      return sendError(res, 404, 'Assinatura de e-mail não encontrada.');
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    return sendError(res, 500, 'Erro ao buscar assinatura de e-mail.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Buscar assinatura padrão                                              */
/* --------------------------------------------------------------------- */

export async function getDefaultSignature(req, res) {
  try {
    const ownerUserId = parseOwnerUserId(req.query.ownerUserId);
    const row = await emailSignaturesApi.getDefault(pool, ownerUserId);

    if (!row) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Nenhuma assinatura padrão encontrada.'
      });
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    return sendError(res, 500, 'Erro ao buscar assinatura padrão.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Criar nova assinatura                                                 */
/* --------------------------------------------------------------------- */

export async function createSignature(req, res) {
  try {
    const { owneruserid, name, html, isdefault } = req.body || {};

    if (!name || !html) {
      return sendError(
        res,
        400,
        'Campos "name" e "html" são obrigatórios para criar a assinatura.'
      );
    }

    const created = await emailSignaturesApi.create(pool, {
      owneruserid,
      name,
      html,
      isdefault
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: 'Assinatura de e-mail criada com sucesso.'
    });
  } catch (err) {
    return sendError(res, 500, 'Erro ao criar assinatura de e-mail.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Atualizar assinatura                                                  */
/* --------------------------------------------------------------------- */

export async function updateSignature(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return sendError(res, 400, 'Parâmetro "id" inválido.');
    }

    const { owneruserid, name, html, isdefault } = req.body || {};

    if (!name || !html) {
      return sendError(
        res,
        400,
        'Campos "name" e "html" são obrigatórios para atualizar a assinatura.'
      );
    }

    const updated = await emailSignaturesApi.update(pool, id, {
      owneruserid,
      name,
      html,
      isdefault
    });

    if (!updated) {
      return sendError(res, 404, 'Assinatura de e-mail não encontrada.');
    }

    return res.json({
      success: true,
      data: updated,
      message: 'Assinatura de e-mail atualizada com sucesso.'
    });
  } catch (err) {
    return sendError(res, 500, 'Erro ao atualizar assinatura de e-mail.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Definir assinatura como padrão                                       */
/* --------------------------------------------------------------------- */

export async function setDefaultSignature(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return sendError(res, 400, 'Parâmetro "id" inválido.');
    }

    const updated = await emailSignaturesApi.setDefault(pool, id);
    if (!updated) {
      return sendError(res, 404, 'Assinatura de e-mail não encontrada.');
    }

    return res.json({
      success: true,
      data: updated,
      message: 'Assinatura definida como padrão com sucesso.'
    });
  } catch (err) {
    return sendError(res, 500, 'Erro ao definir assinatura padrão.', err);
  }
}

/* --------------------------------------------------------------------- */
/* Remover assinatura                                                    */
/* --------------------------------------------------------------------- */

export async function deleteSignature(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return sendError(res, 400, 'Parâmetro "id" inválido.');
    }

    const ok = await emailSignaturesApi.remove(pool, id);
    if (!ok) {
      return sendError(res, 404, 'Assinatura de e-mail não encontrada.');
    }

    return res.json({
      success: true,
      message: 'Assinatura de e-mail removida com sucesso.'
    });
  } catch (err) {
    return sendError(res, 500, 'Erro ao remover assinatura de e-mail.', err);
  }
}
