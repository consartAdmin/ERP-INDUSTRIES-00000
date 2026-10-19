// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttemptsController.js — Tentativas de NF-e dos pedidos    ║
// ║ CONSART ERP | Express | ESM                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import * as ordersNfeAttemptsApi from '../repositories/ordersNfeAttempts/ordersNfeAttempts.index.js';

function errorMessage(error) {
  return (
    error?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Erro interno do servidor.'
  );
}

function statusFromError(error) {
  if (Number.isInteger(error?.status)) return error.status;
  if (Number.isInteger(error?.statusCode)) return error.statusCode;

  switch (error?.code) {
    case '22P02':
    case '23502':
    case '23514':
      return 400;
    case '23503':
      return 409;
    case '23505':
      return 409;
    default:
      return 500;
  }
}

function sendError(res, error, context) {
  const status = statusFromError(error);
  console.error(`[ordersNfeAttemptsController.${context}]`, {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    stack: error?.stack,
  });

  return res.status(status).json({
    ok: false,
    error: errorMessage(error),
    code: error?.code ?? null,
    constraint: error?.constraint ?? null,
  });
}

function bodyData(req) {
  return req.body?.data && typeof req.body.data === 'object'
    ? req.body.data
    : req.body ?? {};
}

function bodyItems(req) {
  if (Array.isArray(req.body?.items)) return req.body.items;
  if (Array.isArray(req.body?.data?.items)) return req.body.data.items;
  return [];
}

export async function create(req, res) {
  try {
    const data = { ...bodyData(req) };
    delete data.items;

    if (data.requested_by === undefined && req.user?.user_id !== undefined) {
      data.requested_by = req.user.user_id;
    }

    const attempt = await ordersNfeAttemptsApi.createAttempt(
      data,
      bodyItems(req),
    );

    return res.status(201).json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'create');
  }
}

export async function list(req, res) {
  try {
    const result = await ordersNfeAttemptsApi.list({
      orderId: req.query.order_id ?? req.query.orderId,
      statusId: req.query.nfe_status_id ?? req.query.statusId,
      providerId: req.query.provider_id ?? req.query.providerId,
      accessKey: req.query.access_key ?? req.query.accessKey,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error, 'list');
  }
}

export async function getById(req, res) {
  try {
    const includeItems = String(req.query.include_items ?? 'true') !== 'false';
    const attempt = await ordersNfeAttemptsApi.getById(
      req.params.attemptId,
      { includeItems },
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'getById');
  }
}

export async function getLatestByOrderId(req, res) {
  try {
    const includeItems = String(req.query.include_items ?? 'true') !== 'false';
    const attempt = await ordersNfeAttemptsApi.getLatestByOrderId(
      req.params.orderId,
      { includeItems },
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Nenhuma tentativa de NF-e foi encontrada para o pedido.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'getLatestByOrderId');
  }
}

export async function update(req, res) {
  try {
    const attempt = await ordersNfeAttemptsApi.updateAttempt(
      req.params.attemptId,
      bodyData(req),
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'update');
  }
}

export async function addItems(req, res) {
  try {
    const items = bodyItems(req);
    if (items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Informe ao menos um item.',
      });
    }

    const savedItems = await ordersNfeAttemptsApi.addItems(
      req.params.attemptId,
      items,
    );
    return res.status(201).json({ ok: true, data: savedItems });
  } catch (error) {
    return sendError(res, error, 'addItems');
  }
}

export async function replaceItems(req, res) {
  try {
    const items = bodyItems(req);
    const savedItems = await ordersNfeAttemptsApi.replaceItems(
      req.params.attemptId,
      items,
    );
    return res.json({ ok: true, data: savedItems });
  } catch (error) {
    return sendError(res, error, 'replaceItems');
  }
}

export async function markAuthorized(req, res) {
  try {
    const attempt = await ordersNfeAttemptsApi.markAuthorized(
      req.params.attemptId,
      bodyData(req),
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'markAuthorized');
  }
}

export async function markRejected(req, res) {
  try {
    const attempt = await ordersNfeAttemptsApi.markRejected(
      req.params.attemptId,
      bodyData(req),
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'markRejected');
  }
}

export async function markChecked(req, res) {
  try {
    const attempt = await ordersNfeAttemptsApi.markChecked(
      req.params.attemptId,
      bodyData(req),
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'markChecked');
  }
}

export async function attachInvoice(req, res) {
  try {
    const invoiceId = req.body?.invoice_id ?? req.body?.invoiceId;
    const attempt = await ordersNfeAttemptsApi.attachInvoice(
      req.params.attemptId,
      invoiceId,
    );

    if (!attempt) {
      return res.status(404).json({
        ok: false,
        error: 'Tentativa de NF-e não encontrada.',
      });
    }

    return res.json({ ok: true, data: attempt });
  } catch (error) {
    return sendError(res, error, 'attachInvoice');
  }
}

export default {
  create,
  list,
  getById,
  getLatestByOrderId,
  update,
  addItems,
  replaceItems,
  markAuthorized,
  markRejected,
  markChecked,
  attachInvoice,
};
