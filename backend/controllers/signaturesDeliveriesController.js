// ╔══════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesController.js — Controller Assinaturas Entrega   ║
// ║ CONSART ERP | Logística / Conferência                               ║
// ║                                                                      ║
// ║ Rotas pensadas para:                                                 ║
// ║   - GET    /api/signatures-deliveries        (list + filtros)        ║
// ║   - GET    /api/signatures-deliveries/search (q)                     ║
// ║   - GET    /api/signatures-deliveries/:id                            ║
// ║   - POST   /api/signatures-deliveries                                ║
// ║   - PUT    /api/signatures-deliveries/:id                            ║
// ║   - DELETE /api/signatures-deliveries/:id                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import signaturesDeliveriesApi from '../repositories/signaturesDeliveries/signaturesDeliveries.index.js';

/* =======================================================================
 * Bootstrap
 * ======================================================================= */
export async function initSignaturesDeliveriesController() {
  try {
    await signaturesDeliveriesApi.ensureTable();
    console.log('[init] signaturesDeliveriesController: tabela OK');
  } catch (err) {
    console.error('initSignaturesDeliveriesController() failed:', err);
  }
}

/* =======================================================================
 * Helpers de normalização de entrada (req.body / req.query)
 * ======================================================================= */
function normalizeBody(body = {}) {
  return {
    order_id:
      body.order_id ??
      body.orderId ??
      body.pedido_id ??
      null,
    nfe_key:
      body.nfe_key ??
      body.nfeKey ??
      body.chave_nfe ??
      body.chaveAcesso ??
      null,
    signed_name:
      body.signed_name ??
      body.signedName ??
      body.nome_assinatura ??
      body.nome_recebedor ??
      null,
    signature_image:
      body.signature_image ??
      body.signatureImage ??
      body.assinatura_imagem ??
      null,
  };
}

function normalizeListQuery(query = {}) {
  const order_id =
    query.order_id ??
    query.orderId ??
    query.pedido_id ??
    null;

  const nfe_key =
    query.nfe_key ??
    query.nfeKey ??
    query.chave_nfe ??
    query.chaveAcesso ??
    null;

  const q = query.q ?? query.search ?? null;

  const limit  = query.limit  ?? query.pageSize ?? 50;
  const offset = query.offset ?? query.skip     ?? 0;

  return {
    q:       q || null,
    order_id: order_id != null ? Number(order_id) : null,
    nfe_key:  nfe_key || null,
    limit:    Number(limit)  || 50,
    offset:   Number(offset) || 0,
  };
}

/* =======================================================================
 * Handlers
 * ======================================================================= */

// GET /api/signatures-deliveries
export async function listSignaturesDeliveries(req, res) {
  try {
    const params = normalizeListQuery(req.query);
    const records = await signaturesDeliveriesApi.list(params);

    return res.json({
      success: true,
      count: records.length,
      items: records,
    });
  } catch (err) {
    console.error('listSignaturesDeliveries() failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar assinaturas de entrega.',
    });
  }
}

// GET /api/signatures-deliveries/search?q=...
export async function searchSignaturesDeliveries(req, res) {
  try {
    const q = req.query.q ?? req.query.search ?? '';
    const limit = Number(req.query.limit ?? 20);

    const records = await signaturesDeliveriesApi.search(q, limit);

    return res.json({
      success: true,
      count: records.length,
      items: records,
    });
  } catch (err) {
    console.error('searchSignaturesDeliveries() failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar assinaturas de entrega.',
    });
  }
}

// GET /api/signatures-deliveries/:id
export async function getSignatureDeliveryById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido.',
      });
    }

    const record = await signaturesDeliveriesApi.getById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura de entrega não encontrada.',
      });
    }

    return res.json({
      success: true,
      item: record,
    });
  } catch (err) {
    console.error('getSignatureDeliveryById() failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao buscar a assinatura de entrega.',
    });
  }
}

// POST /api/signatures-deliveries
export async function createSignatureDelivery(req, res) {
  try {
    const payload = normalizeBody(req.body);

    const created = await signaturesDeliveriesApi.create(payload);

    return res.status(201).json({
      success: true,
      item: created,
    });
  } catch (err) {
    console.error('createSignatureDelivery() failed:', err);

    if (err && err.message && err.message.includes('obrigatória')) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao criar a assinatura de entrega.',
    });
  }
}

// PUT /api/signatures-deliveries/:id
export async function updateSignatureDelivery(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido.',
      });
    }

    const payload = normalizeBody(req.body);

    const updated = await signaturesDeliveriesApi.update(id, payload);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura de entrega não encontrada para atualização.',
      });
    }

    return res.json({
      success: true,
      item: updated,
    });
  } catch (err) {
    console.error('updateSignatureDelivery() failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao atualizar a assinatura de entrega.',
    });
  }
}

// DELETE /api/signatures-deliveries/:id
export async function removeSignatureDelivery(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido.',
      });
    }

    const removed = await signaturesDeliveriesApi.remove(id);
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura de entrega não encontrada para remoção.',
      });
    }

    return res.json({
      success: true,
      item: removed,
    });
  } catch (err) {
    console.error('removeSignatureDelivery() failed:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao remover a assinatura de entrega.',
    });
  }
}

export default {
  initSignaturesDeliveriesController,
  listSignaturesDeliveries,
  searchSignaturesDeliveries,
  getSignatureDeliveryById,
  createSignatureDelivery,
  updateSignatureDelivery,
  removeSignatureDelivery,
};
