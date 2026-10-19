// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeEmit.repository.js — Emissão de NF-e                    ║
// ║ ✔ emitirNFe (POST /nfe, mock opcional)                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  getAmbiente,
  PLUGNOTAS_MOCK,
  api,
  refreshApiConfig,
} from './tecnoSpeedNfeClient.repository.js';
import {
  normalizarIbscbsAntesDoEnvio,
} from '../nfe/nfe.reformaTributaria.js';

/* =========================================================================
 * 📤 Emitir NF-e
 * ========================================================================= */
export async function emitirNFe(dadosNFe) {
  refreshApiConfig();

  if (PLUGNOTAS_MOCK) {
    return {
      ok: true,
      mock: true,
      message: 'Modo simulado (PLUGNOTAS_MOCK=1)',
      data: {
        documents: [
          {
            idIntegracao: Array.isArray(dadosNFe)
              ? dadosNFe[0]?.idIntegracao
              : dadosNFe?.idIntegracao,
            id: `mock-${Date.now()}`,
          },
        ],
      },
    };
  }

  async function postNfeWithRetry(payload, retries = 2) {
    let lastErr;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await api.post('/nfe', payload);
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;

        if (status !== 500 || attempt === retries) {
          throw err;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1200 * (attempt + 1))
        );
      }
    }

    throw lastErr;
  }

  try {
    const amb = getAmbiente();
    const producaoFlag = amb === 'producao';

    const arr = Array.isArray(dadosNFe) ? dadosNFe : [dadosNFe];
    const payload = arr.map((doc) => {
      const documentoNormalizado = normalizarIbscbsAntesDoEnvio(doc);

      return {
        ...documentoNormalizado,
        config: {
          ...(documentoNormalizado.config || {}),
          producao: producaoFlag,
        },
      };
    });

    console.log(
      '[NFE][IBSCBS ENVIADO]',
      payload.map((doc) =>
        (doc.itens || []).map((item, index) => ({
          item: index + 1,
          cst: item?.tributos?.ibscbs?.cst,
          classificacao: item?.tributos?.ibscbs?.classificacao,
        }))
      )
    );

    console.log('[NFE][PAYLOAD FINAL]', JSON.stringify(payload, null, 2));

    const res = await postNfeWithRetry(payload, 2);

    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    const plugMessage =
      data?.error?.message ||
      data?.mensagem ||
      data?.message ||
      'Falha na validação do JSON de NFe.';

    const detalhes = Array.isArray(data?.error?.data) ? data.error.data : [];

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[PlugNotasNFe.emitirNFe] ERRO HTTP DETALHADO');
    console.error('STATUS:', status);
    console.error('MESSAGE:', err.message);
    if (data) {
      console.error('DATA RAW:\n', JSON.stringify(data, null, 2));
      if (detalhes.length) {
        console.error(
          'VALIDATION ERRORS:\n',
          JSON.stringify(detalhes, null, 2),
        );
      }
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (status === 409) {
      const current = data?.error?.data?.current || {};
      const id = current.id;
      return {
        ok: true,
        existed: true,
        status: 200,
        data: { id, resumo: current },
      };
    }

    return {
      ok: false,
      status: status || 400,
      message: plugMessage,
      detalhes,
      error: {
        message: plugMessage,
        code: data?.code || null,
        context: 'PlugNotasNFe.emitirNFe',
        raw: data || err,
      },
    };
  }
}
