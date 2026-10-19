// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCceQuery.repository.js — Consultar status da CC-e                 ║
// ║ PlugNotas: GET /nfe/:id/cce/status                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { api, refreshApiConfig } from './nfeCceClient.repository.js';

/* =========================================================================
 * 🔍 CONSULTAR STATUS CC-e
 * ========================================================================= */

export async function consultarStatusCCe(
  idOuChaveOuProtocolo,
  listaCce = false
) {
  refreshApiConfig();

  try {
    const res = await api.get(
      `/nfe/${encodeURIComponent(idOuChaveOuProtocolo)}/cce/status`,
      {
        params: listaCce ? { listaCce: true } : {},
      }
    );

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
