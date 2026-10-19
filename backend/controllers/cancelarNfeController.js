// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfeController.js — Controller Cancelamento NF-e             ║
// ║ CONSART ERP — ESM                                                   ║
// ║ Responsável por:                                                    ║
// ║  - Validar entrada                                                  ║
// ║  - Solicitar o cancelamento ao provedor                             ║
// ║  - Consultar o status do evento                                     ║
// ║  - Persistir CANCELADO em invoicesIssued de forma idempotente       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  cancelarNFe,
  consultarResumoNFeParaCancelamento,
  consultarStatusCancelamentoNFe,
} from '../repositories/cancelarNfe/cancelarNfe.index.js';

import {
  getByProviderId,
  cancel as cancelInvoiceIssued,
} from '../repositories/invoicesIssued/invoicesIssued.index.js';

function normalizeText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toUpperCase();
}

function getUserId(req) {
  return req.user?.userId ?? req.user?.id ?? null;
}

/* =========================================================================
 * 🚫 POST /api/nfe/cancelar
 * ========================================================================= */
export async function cancelarNfeController(req, res) {
  try {
    const idNota = normalizeText(req.body?.idNota);
    const justificativa = normalizeText(req.body?.justificativa);

    if (!idNota) {
      return res.status(400).json({
        ok: false,
        message: 'Informe o ID, chave ou protocolo da NF-e.',
      });
    }

    if (!justificativa || justificativa.length < 15) {
      return res.status(400).json({
        ok: false,
        message: 'A justificativa deve conter no mínimo 15 caracteres.',
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[NFE][CANCELAMENTO] SOLICITANDO');
    console.log('ID:', idNota);
    console.log('JUSTIFICATIVA:', justificativa);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const result = await cancelarNFe(idNota, justificativa);

    if (!result.ok) {
      console.warn('[NFE][CANCELAMENTO] FALHA:', result.message);

      return res.status(result.status || 400).json({
        ok: false,
        message: result.message,
        error: result.error,
        resumo: result.resumoAntes || null,
      });
    }

    console.log('[NFE][CANCELAMENTO] SOLICITAÇÃO ACEITA');

    return res.status(200).json({
      ok: true,
      message: 'Solicitação de cancelamento enviada com sucesso.',
      data: result.data,
      resumoAntes: result.resumoAntes || null,
    });
  } catch (error) {
    console.error('[cancelarNfeController] ERRO:', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro interno ao solicitar o cancelamento da NF-e.',
      error: error.message || error,
    });
  }
}

/* =========================================================================
 * 🔍 GET /api/nfe/status/:id
 * ========================================================================= */
export async function consultarStatusNfeController(req, res) {
  try {
    const id = normalizeText(req.params?.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'Informe o ID ou chave da NF-e.',
      });
    }

    const result = await consultarResumoNFeParaCancelamento(id);

    if (!result.ok) {
      return res.status(result.status || 400).json(result);
    }

    return res.status(200).json({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[consultarStatusNfeController] ERRO:', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao consultar status da NF-e.',
      error: error.message || error,
    });
  }
}

/* =========================================================================
 * 🔁 GET /api/nfe/cancelamento/:id/status
 * Consumido pelo polling do frontend.
 * Quando o provedor confirma o evento, persiste CANCELADO uma única vez.
 * A resposta permanece plana para compatibilidade com nfeCancellation.js.
 * ========================================================================= */
export async function consultarStatusCancelamentoController(req, res) {
  try {
    const id = normalizeText(req.params?.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: 'Informe o ID, chave ou protocolo da NF-e.',
      });
    }

    const result = await consultarStatusCancelamentoNFe(id);

    if (!result.ok) {
      return res.status(result.status || 400).json({
        ok: false,
        message: result.message,
        error: result.error,
      });
    }

    let invoice = null;

    if (result.data?.cancellationCompleted === true) {
      const invoiceResult = await getByProviderId(id);

      if (!invoiceResult.ok || !invoiceResult.invoice) {
        console.error(
          '[NFE][CANCELAMENTO] Evento concluído, mas a NF-e não foi localizada no ERP.',
          { providerId: id, error: invoiceResult.error },
        );

        return res.status(409).json({
          ok: false,
          message:
            'O cancelamento foi confirmado pelo provedor, mas a NF-e não foi localizada no ERP para atualização.',
          code: 'INVOICE_ISSUED_NOT_FOUND',
          providerId: id,
          ...result.data,
        });
      }

      const currentInvoice = invoiceResult.invoice;
      const currentStatus = normalizeStatus(
        currentInvoice.nfe_status_code || currentInvoice.nfe_status,
      );

      // O polling pode consultar várias vezes. Não sobrescreve cancelled_at
      // nem cria auditorias CANCEL duplicadas quando já estiver cancelada.
      if (currentStatus === 'CANCELADO') {
        invoice = currentInvoice;
      } else {
        const reason =
          normalizeText(result.data.justificativa) ||
          normalizeText(result.data.respostaSefaz) ||
          'Cancelamento confirmado pelo provedor';

        const cancelResult = await cancelInvoiceIssued(
          currentInvoice.invoice_id,
          reason,
          { userId: getUserId(req) },
        );

        if (!cancelResult.ok || !cancelResult.invoice) {
          console.error(
            '[NFE][CANCELAMENTO] Falha ao persistir CANCELADO no ERP.',
            cancelResult.error,
          );

          return res.status(500).json({
            ok: false,
            message:
              'O cancelamento foi confirmado pelo provedor, mas não foi possível atualizar a NF-e no ERP.',
            code: 'INVOICE_CANCELLATION_PERSIST_FAILED',
            error: cancelResult.error || null,
            ...result.data,
          });
        }

        invoice = cancelResult.invoice;
      }
    }

    return res.status(200).json({
      ok: true,
      ...result.data,
      invoice,
    });
  } catch (error) {
    console.error('[consultarStatusCancelamentoController] ERRO:', error);

    return res.status(500).json({
      ok: false,
      message: 'Erro ao consultar o status do cancelamento da NF-e.',
      error: error.message || error,
    });
  }
}
