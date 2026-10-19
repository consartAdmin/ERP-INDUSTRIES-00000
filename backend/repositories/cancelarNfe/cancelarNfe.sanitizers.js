// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.sanitizers.js — Validação pré-cancelamento da NF-e       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { normalizeJustificativa } from './cancelarNfe.utils.js';

/* =========================================================================
 * 🧠 Validação pré-cancelamento
 * ========================================================================= */
export function validarCancelamentoNFe({ justificativa, resumo } = {}) {
  const erros = [];

  const just = normalizeJustificativa(justificativa);

  if (!just) {
    erros.push('A justificativa do cancelamento é obrigatória.');
  }

  if (just.length < 15) {
    erros.push('A justificativa deve conter no mínimo 15 caracteres.');
  }

  const statusRaw =
    resumo?.situacao ||
    resumo?.status ||
    resumo?.situacaoNfe ||
    resumo?.descricaoSituacao ||
    '';

  const status = String(statusRaw || '').trim().toUpperCase();

  if (!status) {
    erros.push('Não foi possível identificar o status atual da NF-e.');
  }

  if (status.includes('CANCEL')) {
    erros.push('A NF-e já está cancelada.');
  }

  if (status.includes('REJEIT')) {
    erros.push(`A NF-e está rejeitada e não pode ser cancelada. Status atual: ${status}.`);
  }

  if (status.includes('PROCESS')) {
    erros.push(`A NF-e ainda está em processamento. Status atual: ${status}.`);
  }

  const statusValidoParaCancelar =
    status === 'CONCLUIDO' ||
    status === 'AUTORIZADO' ||
    status === 'AUTORIZADA' ||
    status.includes('AUTORIZ');

  if (
    status &&
    !status.includes('CANCEL') &&
    !status.includes('REJEIT') &&
    !status.includes('PROCESS') &&
    !statusValidoParaCancelar
  ) {
    erros.push(
      `A NF-e não está em situação válida para cancelamento. Status atual: ${status}.`,
    );
  }

  return {
    ok: erros.length === 0,
    erros,
    justificativa: just,
    statusAtual: status || null,
  };
}
