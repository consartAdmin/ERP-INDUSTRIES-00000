// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.mappers.js — Resumo PlugNotas → status de cancelamento   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { CANCELAMENTO_STATUS } from './cancelarNfe.constants.js';
import { pickFirst, toIsoDate } from './cancelarNfe.utils.js';

/* =========================================================================
 * 🧭 Normalização do status de cancelamento
 * ========================================================================= */
function extrairBlocoCancelamento(resumo) {
  if (!resumo || typeof resumo !== 'object') return null;

  const bloco =
    resumo.cancelamento ||
    resumo.eventoCancelamento ||
    resumo.cancelamentoNfe ||
    null;

  if (Array.isArray(bloco)) return bloco[0] || null;

  return bloco && typeof bloco === 'object' ? bloco : null;
}

/**
 * Classifica o texto de situação do EVENTO de cancelamento.
 * Não deve ser usado com a situação da NF-e: nesta API "CONCLUIDO"
 * na nota significa autorizada, e não cancelada.
 */
function classificarStatusCancelamento(texto) {
  const status = String(texto || '').trim().toUpperCase();

  if (!status) return null;

  if (status.includes('REJEIT')) {
    return CANCELAMENTO_STATUS.REJEITADO;
  }

  if (
    status.includes('DENEG') ||
    status.includes('ERRO') ||
    status.includes('FALHA')
  ) {
    return CANCELAMENTO_STATUS.ERRO;
  }

  if (
    status.includes('CANCEL') ||
    status.includes('HOMOLOG') ||
    status.includes('CONCLU') ||
    status.includes('AUTORIZ')
  ) {
    return CANCELAMENTO_STATUS.CONCLUIDO;
  }

  if (
    status.includes('PROCESS') ||
    status.includes('AGUARD') ||
    status.includes('PENDENT')
  ) {
    return CANCELAMENTO_STATUS.PROCESSANDO;
  }

  return null;
}

export function normalizarStatusCancelamento(resumo, idConsultado = null) {
  const bloco = extrairBlocoCancelamento(resumo);

  const situacaoNfe = pickFirst(
    resumo?.situacao,
    resumo?.status,
    resumo?.situacaoNfe,
    resumo?.descricaoSituacao,
  );

  const statusBloco = pickFirst(
    bloco?.status,
    bloco?.situacao,
    bloco?.statusCancelamento,
    bloco?.descricaoSituacao,
  );

  let statusCancelamento = classificarStatusCancelamento(statusBloco);

  if (
    !statusCancelamento &&
    String(situacaoNfe || '').toUpperCase().includes('CANCEL')
  ) {
    statusCancelamento = CANCELAMENTO_STATUS.CONCLUIDO;
  }

  if (!statusCancelamento) {
    statusCancelamento = CANCELAMENTO_STATUS.PROCESSANDO;
  }

  return {
    id:
      idConsultado ||
      pickFirst(resumo?.id, resumo?.idNota, resumo?.idIntegracao),

    statusCancelamento,

    cancellationCompleted:
      statusCancelamento === CANCELAMENTO_STATUS.CONCLUIDO,

    cancellationRejected:
      statusCancelamento === CANCELAMENTO_STATUS.REJEITADO,

    cancellationError:
      statusCancelamento === CANCELAMENTO_STATUS.ERRO,

    protocolo: pickFirst(
      bloco?.protocolo,
      bloco?.numeroProtocolo,
      bloco?.protocoloCancelamento,
      resumo?.protocoloCancelamento,
    ),

    respostaSefaz: pickFirst(
      bloco?.motivo,
      bloco?.xMotivo,
      bloco?.mensagem,
      bloco?.mensagemSefaz,
      bloco?.descricaoSituacao,
      resumo?.mensagemSefaz,
      resumo?.mensagem,
      resumo?.motivo,
      statusBloco,
    ),

    dataCancelamento: toIsoDate(pickFirst(
      bloco?.dataEvento,
      bloco?.dataHoraEvento,
      bloco?.dataCancelamento,
      bloco?.data,
      resumo?.dataCancelamento,
    )),

    justificativa: pickFirst(
      bloco?.justificativa,
      bloco?.motivoCancelamento,
      resumo?.justificativa,
    ),

    situacaoNfe,

    resumo: resumo || null,
  };
}
