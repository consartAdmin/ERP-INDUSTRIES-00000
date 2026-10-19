// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfeCancel.repository.js — Cancelar NF-e                      ║
// ║ PlugNotas: POST /nfe/:id/cancelamento                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { api, refreshApiConfig } from './cancelarNfeClient.repository.js';
import { normalizeJustificativa, extractErrorMessage } from './cancelarNfe.utils.js';
import { validarCancelamentoNFe } from './cancelarNfe.sanitizers.js';
import { consultarResumoNFeParaCancelamento } from './cancelarNfeQuery.repository.js';

/* =========================================================================
 * 🚫 Cancelar NF-e
 * ========================================================================= */
export async function cancelarNFe(
  idNota,
  justificativa = 'Cancelamento solicitado pelo emissor',
) {
  refreshApiConfig();

  const id = String(idNota || '').trim();
  const just = normalizeJustificativa(justificativa);

  if (!id) {
    return {
      ok: false,
      status: 400,
      message: 'Id, chave ou protocolo da NF-e não informado.',
    };
  }

  if (!just || just.length < 15) {
    return {
      ok: false,
      status: 400,
      message: 'A justificativa deve conter ao menos 15 caracteres.',
    };
  }

  const resumoAntes = await consultarResumoNFeParaCancelamento(id);

  if (!resumoAntes.ok) {
    return {
      ok: false,
      status: resumoAntes.status,
      message: resumoAntes.message,
      error: resumoAntes.error,
    };
  }

  const validacao = validarCancelamentoNFe({
    justificativa: just,
    resumo: resumoAntes.data,
  });

  if (!validacao.ok) {
    return {
      ok: false,
      status: 400,
      message: validacao.erros.join(' | '),
      erros: validacao.erros,
      resumo: resumoAntes.data,
    };
  }

  try {
    const res = await api.post(
      `/nfe/${encodeURIComponent(id)}/cancelamento`,
      { justificativa: just },
    );

    return {
      ok: true,
      status: res.status,
      data: res.data,
      resumoAntes: resumoAntes.data,
    };
  } catch (err) {
    const errorData = err.response?.data || null;

    return {
      ok: false,
      status: err.response?.status || 500,
      message: extractErrorMessage(errorData),
      error: errorData || err.message,
      resumoAntes: resumoAntes.data,
    };
  }
}
