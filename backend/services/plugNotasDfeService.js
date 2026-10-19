/* ╔══════════════════════════════════════════════════════════════════════╗
 * ║ plugNotasDfeService.js — Integração DF-e / Manifestação PlugNotas  ║
 * ║ CONSART ERP | ESM                                                   ║
 * ║                                                                      ║
 * ║ Funções principais:                                                 ║
 * ║   - listDestinadas()                → GET /nfe/destinada            ║
 * ║   - solicitarManifestacao()         → POST /nfe/{id}/manifestacao   ║
 * ║   - consultarManifestacaoStatus()   → GET  /nfe/{id}/manifestacao…  ║
 * ║                                                                      ║
 * ║ Funções de agendamento:                                             ║
 * ║   - syncDfeOnce()                  → roda 1 ciclo de busca DF-e     ║
 * ║   - startDfeScheduler({interval})  → setInterval de X em X minutos  ║
 * ╚══════════════════════════════════════════════════════════════════════╝ */

import axios from 'axios';

// =====================================================================
// Configuração
// =====================================================================
const PLUGNOTAS_API_KEY =
  process.env.PLUGNOTAS_API_KEY || process.env.PLUGNOTAS_APIKEY;

const PLUGNOTAS_BASE_URL =
  process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br';

/**
 * CNPJs monitorados pelo auto-sync DF-e.
 * Ex.: DFE_CNPJS=34363337000185,11222333000199
 */
const DFE_CNPJS = String(process.env.DFE_CNPJS || '')
  .split(',')
  .map((c) => c.replace(/\D/g, ''))
  .filter(Boolean);

if (!PLUGNOTAS_API_KEY) {
  console.warn(
    '[plugNotasDfeService] ⚠️ PLUGNOTAS_API_KEY não configurado — DF-e/Manifestação não funcionarão.'
  );
}

if (!DFE_CNPJS.length) {
  console.warn(
    '[plugNotasDfeService] ⚠️ DFE_CNPJS não configurado — auto-sync DF-e ficará sem CNPJs para consultar.'
  );
}

const http = axios.create({
  baseURL: PLUGNOTAS_BASE_URL,
  timeout: 30000,
  headers: {
    'x-api-key': PLUGNOTAS_API_KEY,
    'Content-Type': 'application/json'
  }
});

// =====================================================================
// 1) DF-e — Notas Destinadas (baixa de notas da SEFAZ via PlugNotas)
// =====================================================================

/**
 * Consulta notas destinadas com paginação automática.
 *
 * @param {Object} options
 * @param {string} options.cpfCnpj        - CNPJ/CPF sem máscara
 * @param {boolean} [options.manifestada] - true | false
 * @param {string}  [options.status]      - "CONCLUIDO,CANCELADO" etc.
 * @param {string}  [options.dataInicial] - YYYY-MM-DD
 * @param {string}  [options.dataFinal]   - YYYY-MM-DD
 * @param {boolean} [options.resume=true] - inclui notas com xml resumido
 *
 * @returns {Promise<Array>} Lista com todas as notas retornadas.
 */
export async function listDestinadas(options = {}) {
  if (!PLUGNOTAS_API_KEY) {
    throw new Error(
      'PLUGNOTAS_API_KEY não configurado no ambiente — configure no .env'
    );
  }

  const {
    cpfCnpj,
    manifestada,
    status,
    dataInicial,
    dataFinal,
    resume = true
  } = options;

  if (!cpfCnpj) {
    throw new Error('cpfCnpj é obrigatório para consulta DF-e');
  }

  const notasAcumuladas = [];
  let hashProximaPagina;

  do {
    const params = {
      cpfCnpj,
      resume
    };

    if (typeof manifestada === 'boolean') params.manifestada = manifestada;
    if (status) params.status = status;
    if (dataInicial) params.dataInicial = dataInicial;
    if (dataFinal) params.dataFinal = dataFinal;

    if (hashProximaPagina) params.hashProximaPagina = hashProximaPagina;

    const { data } = await http.get('/nfe/destinada', { params });

    console.log('[PlugNotas DF-e] params =>', params);
    console.log(
      '[PlugNotas DF-e] raw response =>',
      JSON.stringify(data, null, 2)
    );

    const notas = Array.isArray(data?.notas) ? data.notas : [];
    notasAcumuladas.push(...notas);

    hashProximaPagina = data?.hashProximaPagina || null;
  } while (hashProximaPagina);

  return notasAcumuladas;
}

// =====================================================================
// 2) Manifestação do Destinatário
// =====================================================================

/**
 * Envia uma manifestação para a NF-e.
 *
 * Endpoint PlugNotas (doc Destinadas):
 *   POST /nfe/{idNotaorChave}/manifestacao
 *
 * @param {Object} params
 * @param {string} params.idNotaOrChave - ID da PlugNotas OU chave da NFe
 * @param {string} params.operacao      - "DESCONHECIMENTODAOPERACAO" |
 *                                        "OPERACAONAOREALIZADA"      |
 *                                        "CONFIRMACAODAOPERACAO"
 * @param {string} [params.justificativa] - obrigatório p/ OPERACAONAOREALIZADA
 */
export async function solicitarManifestacao({
  idNotaOrChave,
  operacao,
  justificativa
}) {
  if (!PLUGNOTAS_API_KEY) {
    throw new Error(
      'PLUGNOTAS_API_KEY não configurado — manifestação não pode ser enviada'
    );
  }

  if (!idNotaOrChave) {
    throw new Error('idNotaOrChave é obrigatório em solicitarManifestacao');
  }
  if (!operacao) {
    throw new Error('operacao é obrigatória em solicitarManifestacao');
  }

  const path = `/nfe/${encodeURIComponent(idNotaOrChave)}/manifestacao`;

  const payload = {
    operacao,
    justificativa: justificativa || undefined
  };

  const { data } = await http.post(path, payload);

  console.log(
    '[PlugNotas Manifestação] request =>',
    path,
    JSON.stringify(payload)
  );
  console.log(
    '[PlugNotas Manifestação] response =>',
    JSON.stringify(data, null, 2)
  );

  return data;
}

/**
 * Consulta o status da manifestação do destinatário.
 *
 * Endpoint PlugNotas:
 *   GET /nfe/{idNotaorChave}/manifestacao/status
 *
 * @param {string} idNotaOrChave
 */
export async function consultarManifestacaoStatus(idNotaOrChave) {
  if (!PLUGNOTAS_API_KEY) {
    throw new Error(
      'PLUGNOTAS_API_KEY não configurado — não é possível consultar status'
    );
  }

  if (!idNotaOrChave) {
    throw new Error(
      'idNotaOrChave é obrigatório em consultarManifestacaoStatus'
    );
  }

  const path = `/nfe/${encodeURIComponent(idNotaOrChave)}/manifestacao/status`;

  const { data } = await http.get(path);

  console.log(
    '[PlugNotas Manifestação STATUS] response =>',
    JSON.stringify(data, null, 2)
  );

  return data;
}

// =====================================================================
// 3) Auto-sync DF-e — ciclo único + agendador
// =====================================================================

/**
 * Roda 1 ciclo de sincronização DF-e para todos os CNPJs
 * configurados em DFE_CNPJS.
 *
 * ⚠️ Aqui ainda não gravamos em nenhuma tabela. A ideia é:
 *   - Buscar as notas destinadas na PlugNotas
 *   - Entregar a lista para um ponto de extensão (TODO)
 *     que salva em nfe_inbox / painelNotasFiscais.
 */
export async function syncDfeOnce() {
  if (!PLUGNOTAS_API_KEY) {
    console.warn(
      '[plugNotasDfeService] syncDfeOnce: PLUGNOTAS_API_KEY ausente — abortando ciclo DF-e.'
    );
    return;
  }

  if (!DFE_CNPJS.length) {
    console.warn(
      '[plugNotasDfeService] syncDfeOnce: nenhum CNPJ em DFE_CNPJS — nada para consultar.'
    );
    return;
  }

  console.log(
    `[plugNotasDfeService] ▶ Iniciando ciclo DF-e para ${DFE_CNPJS.length} CNPJ(s).`
  );

  for (const cnpj of DFE_CNPJS) {
    try {
      console.log(
        `[plugNotasDfeService] → Consultando DF-e destinadadas para CNPJ ${cnpj}...`
      );

      // Aqui você pode aplicar filtros, por ex:
      // - manifestada: false → apenas notas ainda não manifestadas
      // - status: 'AUTORIZADA,CONFIRMADA' etc., conforme doc PlugNotas
      const notas = await listDestinadas({
        cpfCnpj: cnpj,
        resume: true
      });

      console.log(
        `[plugNotasDfeService] ✔ CNPJ ${cnpj} - ${notas.length} nota(s) destinadadas retornadas.`
      );

      // =================================================================
      // TODO: ponto de extensão para gravar no seu painel / nfe_inbox
      // =================================================================
      //
      // Exemplo (pseudocódigo):
      //
      //   await nfeInboxService.importFromPlugNotas({
      //     cnpj,
      //     notas
      //   });
      //
      // ou chamar uma rota interna:
      //
      //   await axios.post(`${API_BASE_INTERNO}/api/nfe-inbox/import`, {
      //     cnpj,
      //     notas
      //   });
      //
      // Aqui mantive apenas o log para não acoplar diretamente.
      // =================================================================
    } catch (err) {
      console.error(
        `[plugNotasDfeService] ❌ Erro ao sincronizar DF-e para CNPJ ${cnpj}:`,
        err?.response?.data || err?.message || err
      );
    }
  }

  console.log('[plugNotasDfeService] ⏹ Ciclo DF-e concluído.');
}

// Guard para não criar múltiplos intervals
let dfeInterval = null;

/**
 * Inicia o agendador de DF-e, rodando syncDfeOnce() a cada X ms.
 *
 * @param {Object} [options]
 * @param {number} [options.intervalMs=60000] - intervalo em milissegundos
 */
export function startDfeScheduler({ intervalMs = 60_000 } = {}) {
  if (dfeInterval) {
    console.warn(
      '[plugNotasDfeService] startDfeScheduler: já existe um agendador ativo. Ignorando nova chamada.'
    );
    return;
  }

  if (!PLUGNOTAS_API_KEY) {
    console.warn(
      '[plugNotasDfeService] startDfeScheduler: PLUGNOTAS_API_KEY ausente — agendador não será iniciado.'
    );
    return;
  }

  if (!DFE_CNPJS.length) {
    console.warn(
      '[plugNotasDfeService] startDfeScheduler: nenhum CNPJ em DFE_CNPJS — agendador não será iniciado.'
    );
    return;
  }

  console.log(
    `[plugNotasDfeService] ⏱  Iniciando agendador DF-e a cada ${intervalMs} ms (${(
      intervalMs / 1000
    ).toFixed(0)}s).`
  );

  // dispara um ciclo imediato na subida da API
  syncDfeOnce().catch((err) => {
    console.error(
      '[plugNotasDfeService] Erro no primeiro syncDfeOnce():',
      err?.message || err
    );
  });

  // agendamento contínuo
  dfeInterval = setInterval(() => {
    syncDfeOnce().catch((err) => {
      console.error(
        '[plugNotasDfeService] Erro em syncDfeOnce() agendado:',
        err?.message || err
      );
    });
  }, intervalMs);

  // boa prática para Cloud Run / Node moderno
  if (typeof dfeInterval.unref === 'function') {
    dfeInterval.unref();
  }
}

/**
 * (Opcional) Para parar o agendador, caso precise em testes.
 */
export function stopDfeScheduler() {
  if (dfeInterval) {
    clearInterval(dfeInterval);
    dfeInterval = null;
    console.log('[plugNotasDfeService] ⛔ Agendador DF-e parado.');
  }
}
