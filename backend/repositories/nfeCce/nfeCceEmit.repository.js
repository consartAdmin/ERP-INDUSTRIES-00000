// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCceEmit.repository.js — Emitir CC-e                               ║
// ║ PlugNotas: POST /nfe/:id/cce                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { api, refreshApiConfig } from './nfeCceClient.repository.js';
import { normalizeCorrecaoText } from './nfeCce.sanitizers.js';

/* =========================================================================
 * 📤 EMITIR CC-e
 * ========================================================================= */

export async function emitirCCe(idOuChave, correcao) {
  refreshApiConfig();

  const id = String(idOuChave || '').trim();
  const texto = normalizeCorrecaoText(correcao);

  if (!id) {
    return {
      ok: false,
      status: 400,
      error: 'Id, chave ou protocolo da NF-e não informado.',
    };
  }

  if (!texto) {
    return {
      ok: false,
      status: 400,
      error: 'Texto da carta de correção não informado.',
    };
  }

  try {
    const res = await api.post(`/nfe/${encodeURIComponent(id)}/cce`, {
      correcao: texto,
    });

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 400,
      error: err.response?.data || err.message,
    };
  }
}
