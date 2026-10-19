// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: manufacturesOrdersController.js                               ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ DESCRIPTION: Controller de pedidos para fabricantes + PDF            ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as api from '../repositories/manufacturesOrders/manufacturesOrders.index.js';

import {
  buildOrdersManufacturesPdfStream,
  getOrdersManufacturesPdfFilename,
} from '../generationPdf/generateOrdersManufacturesPdf.js';

import generationManufacturesOrdersExcel from '../generationExcel/generationManufacturesOrdersExcel.js';

import {
  buildManufacturesOrderManufacturerPdf,
  getManufacturesOrderManufacturerPdfFilename,
} from '../generationPdf/generateManufacturesOrderManufacturerPdf.js';

function ok(res, data, extra = {}) {
  return res.json({
    ok: true,
    ...extra,
    data,
  });
}

function fail(res, status, error, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: error?.message || error || 'Erro interno',
    ...extra,
  });
}

export async function list(req, res) {
  try {
    const result = await api.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[manufacturesOrdersController.list]', error);
    return fail(res, 500, error);
  }
}

export async function getById(req, res) {
  try {
    const data = await api.getById(req.params.id);

    if (!data) {
      return fail(res, 404, 'Pedido de fabricante não encontrado.');
    }

    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.getById]', error);
    return fail(res, 500, error);
  }
}

export async function create(req, res) {
  try {
    const data = await api.create(req.body);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    console.error('[manufacturesOrdersController.create]', error);
    return fail(res, 500, error);
  }
}

export async function update(req, res) {
  try {
    const data = await api.update(req.params.id, req.body);

    if (!data) {
      return fail(res, 404, 'Pedido de fabricante não encontrado.');
    }

    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.update]', error);
    return fail(res, 500, error);
  }
}

export async function addItem(req, res) {
  try {
    const data = await api.addItem(req.params.id, req.body);
    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.addItem]', error);
    return fail(res, 500, error);
  }
}

export async function updateItem(req, res) {
  try {
    const data = await api.updateItem(req.params.itemId, req.body);

    if (!data) {
      return fail(res, 404, 'Item não encontrado.');
    }

    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.updateItem]', error);
    return fail(res, 500, error);
  }
}

export async function removeItem(req, res) {
  try {
    const data = await api.removeItem(req.params.itemId);
    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.removeItem]', error);
    return fail(res, 500, error);
  }
}

export async function remove(req, res) {
  try {
    const data = await api.remove(req.params.id);
    return ok(res, data);
  } catch (error) {
    console.error('[manufacturesOrdersController.remove]', error);
    return fail(res, 500, error);
  }
}

export async function generatePdf(req, res) {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, 400, 'ID inválido.');
    }

    const order = await api.getById(id);

    if (!order) {
      return fail(res, 404, 'Pedido de fabricante não encontrado.');
    }

    const filename = getOrdersManufacturesPdfFilename(order);
    const doc = buildOrdersManufacturesPdfStream(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);
    doc.end();

    return null;
  } catch (error) {
    console.error('[manufacturesOrdersController.generatePdf]', error);

    if (!res.headersSent) {
      return fail(res, 500, error);
    }

    return null;
  }
}

export async function generateExcel(req, res) {
  try {
    const result = await api.listWithItems(req.query);

    return generationManufacturesOrdersExcel({
      orders: result.rows || [],
      res,
      filename: 'pedidos-fabricantes.xlsx',
    });
  } catch (error) {
    console.error('[manufacturesOrdersController.generateExcel]', error);

    if (!res.headersSent) {
      return fail(res, 500, error);
    }

    return null;
  }
}

export async function generateExcelById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, 400, 'ID inválido.');
    }

    const order = await api.getById(id);

    if (!order) {
      return fail(res, 404, 'Pedido de fabricante não encontrado.');
    }

    return generationManufacturesOrdersExcel({
      orders: [order],
      res,
      filename: `pedido-fabricante-${order.order_number || id}.xlsx`,
    });
  } catch (error) {
    console.error('[manufacturesOrdersController.generateExcelById]', error);

    if (!res.headersSent) {
      return fail(res, 500, error);
    }

    return null;
  }
}

export async function generateManufacturerPdf(req, res) {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return fail(res, 400, 'ID inválido.');
    }

    const order = await api.getById(id);

    if (!order) {
      return fail(res, 404, 'Pedido de fabricante não encontrado.');
    }

    const filename = `pedido-fabricante-${order.order_number || id}.pdf`;
    const doc = buildManufacturesOrderManufacturerPdf(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);
    doc.end();

    return null;
  } catch (error) {
    console.error('[manufacturesOrdersController.generateManufacturerPdf]', error);

    if (!res.headersSent) {
      return fail(res, 500, error);
    }

    return null;
  }
}