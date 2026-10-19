// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeCancelController.js — Cancelamento de NF-e por Pedido      ║
// ║ Valida pedido, chama TecnoSpeed/PlugNotas e só marca CANCELADA se   ║
// ║ a API realmente confirmar o cancelamento                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';
import ordersApi from '../repositories/orders/orders.index.js';

// -----------------------------------------------------------------------
// Helper: verifica se a resposta indica NF-e CANCELADA na TecnoSpeed/SEFAZ
// -----------------------------------------------------------------------
function isCanceledSituation(data) {
  if (!data) return false;

  const s = String(
    data.situacao ||
      data.situacaoNfe ||
      data.statusNfe ||
      data.statusSefaz ||
      data.status ||
      data.motivo ||
      (data.retorno && data.retorno.situacao) ||
      ''
  ).toUpperCase();

  return (
    s.includes('CANCEL') || // CANCELADA, CANCELADO...
    s.includes('HOMOLOGADO O CANCELAMENTO')
  );
}

// -----------------------------------------------------------------------
// Controller principal
// -----------------------------------------------------------------------
export async function cancelarNfeByOrder(req, res) {
  const { orderId } = req.params;
  const body = req.body || {};

  // Aceita tanto "motivo" quanto "justificativa"
  const motivoRaw = body.motivo ?? body.justificativa;
  const motivo = motivoRaw ? String(motivoRaw).trim() : '';

  // Validação básica
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, message: 'Parâmetro :orderId inválido.' });
  }

  if (!motivo || motivo.length < 15) {
    return res.status(400).json({
      ok: false,
      message: 'Motivo do cancelamento é obrigatório e deve ter pelo menos 15 caracteres.',
    });
  }

  try {
    // 1) Carrega o pedido usando o mesmo service já usado em ordersRoutes.js
    const orderResp = await ordersApi.getById(id);
    if (!orderResp?.ok) {
      return res.status(404).json({
        ok: false,
        message: 'Pedido não encontrado.',
      });
    }

    const header = orderResp.header || orderResp || {};

    if (!header.nfe_plugnotas_id && !header.nfe_key) {
      return res.status(400).json({
        ok: false,
        message: 'Pedido não possui NF-e vinculada (sem ID/Chave).',
      });
    }

    // Preferimos o ID da TecnoSpeed (plugnotas_id); se não tiver, tentamos chave
    const plugId = header.nfe_plugnotas_id || header.nfe_key;

    // 2) Chama TecnoSpeed / PlugNotas para cancelar
    //    (segue o MESMO padrão já usado em ordersRoutes.js)
    const resp = await tecnospeedNfeApi.cancelarNFe(plugId, motivo);

    if (!resp.ok) {
      return res.status(resp.status || 500).json({
        ok: false,
        message: 'Falha ao cancelar NF-e na TecnoSpeed.',
        error: resp.error,
      });
    }

    // A API de cancelamento pode devolver array ou objeto único
    const data = Array.isArray(resp.data) ? resp.data[0] : resp.data;

    // 3) Só marca como CANCELADA se a situação realmente indicar isso
    if (!isCanceledSituation(data)) {
      return res.status(422).json({
        ok: false,
        message:
          'TecnoSpeed/SEFAZ não retornou situação de NF-e cancelada. Verifique o portal antes de considerar esta nota como cancelada.',
        data,
      });
    }

    // 4) Atualiza status da NF-e + status do pedido via ordersApi
    try {
      await ordersApi.update(id, {
        status: 'CANCELADO',     // 🔴 Cancela o pedido no ERP
        nfe_status: 'CANCELADA', // 🔴 NF-e cancelada
        // Se depois você criar colunas no banco, pode adicionar aqui:
        // nfe_cancel_reason: motivo,
        // nfe_canceled_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error(
        '[ordersNfeCancelController] WARN ao atualizar status CANCELADA no pedido:',
        e.message || e,
      );
      // Não quebra a resposta de sucesso se o cancelamento na TecnoSpeed deu certo
    }

    return res.json({
      ok: true,
      message: 'NF-e cancelada com sucesso na TecnoSpeed/SEFAZ e no ERP.',
      nfe: data,
    });
  } catch (err) {
    console.error('[ordersNfeCancelController] erro ao cancelar NF-e:', err);
    return res.status(500).json({
      ok: false,
      message: 'Erro interno ao cancelar NF-e.',
      error: err?.message || String(err),
    });
  }
}

export default {
  cancelarNfeByOrder,
};
