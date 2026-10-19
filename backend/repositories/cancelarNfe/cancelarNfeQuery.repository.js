// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfeQuery.repository.js — Consulta resumo / status do cancel. ║
// ║ PlugNotas: GET /nfe/:id/resumo                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { api, refreshApiConfig } from './cancelarNfeClient.repository.js';
import { extractErrorMessage, normalizeConsultaData } from './cancelarNfe.utils.js';
import { normalizarStatusCancelamento } from './cancelarNfe.mappers.js';

/* =========================================================================
 * 🔍 Consultar resumo da NF-e
 * ========================================================================= */
export async function consultarResumoNFeParaCancelamento(idOuChave) {
  refreshApiConfig();

  const id = String(idOuChave || '').trim();

  if (!id) {
    return {
      ok: false,
      status: 400,
      message: 'Id, chave ou protocolo da NF-e não informado.',
    };
  }

  try {
    const res = await api.get(`/nfe/${encodeURIComponent(id)}/resumo`);
    const resumo = normalizeConsultaData(res.data);

    return {
      ok: true,
      status: res.status,
      data: resumo,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 500,
      message: extractErrorMessage(
        err.response?.data,
        'Não foi possível consultar a NF-e antes do cancelamento.',
      ),
      error: err.response?.data || err.message,
    };
  }
}

/* =========================================================================
 * 🔁 Consultar status do cancelamento (polling do frontend)
 * ========================================================================= */
export async function consultarStatusCancelamentoNFe(idOuChave) {
  const id = String(idOuChave || '').trim();

  const resumo = await consultarResumoNFeParaCancelamento(id);

  if (!resumo.ok) {
    return {
      ok: false,
      status: resumo.status,
      message: resumo.message,
      error: resumo.error,
    };
  }

  return {
    ok: true,
    status: 200,
    data: normalizarStatusCancelamento(resumo.data, id),
  };
}
