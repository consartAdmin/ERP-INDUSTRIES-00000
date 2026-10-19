// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.actions.js — Ações do módulo SPED Fiscal                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  generateSped,
  getDownloadUrl,
  getPreview,
  validateSped,
} from './spedFiscal.api.js';
import { els } from './spedFiscal.state.js';
import { renderIssues, renderPreview, setStatus } from './spedFiscal.render.js';
import { errorMessage } from './spedFiscal.utils.js';
import { readLoteId, validateInputs } from './spedFiscal.validation.js';

function firstArray(containers, property) {
  for (const container of containers) {
    if (Array.isArray(container?.[property]) && container[property].length) {
      return container[property];
    }
  }

  return [];
}

function normalizeValidationResponse(response = {}) {
  const validation =
    response.data?.validation ||
    response.validation ||
    response.data ||
    response;

  const containers = [
    validation,
    response.data?.validation,
    response.validation,
    response.data,
    response,
  ];

  let issues = firstArray(containers, 'issues');

  if (!issues.length) {
    const warnings = firstArray(containers, 'warnings').map(issue => ({
      ...issue,
      type: issue.type || issue.tipo || 'warning',
    }));

    const errors = firstArray(containers, 'errors').map(issue => ({
      ...issue,
      type: issue.type || issue.tipo || 'error',
    }));

    issues = [...errors, ...warnings];
  }

  return {
    ...validation,
    issues,
    totalErrors: validation.totalErrors ?? response.totalErrors ?? 0,
    totalWarnings: validation.totalWarnings ?? response.totalWarnings ?? 0,
  };
}

export async function handlePreview() {
  try {
    const params = validateInputs();
    setStatus('Carregando prévia e inconsistências...', 'info');

    const [previewResponse, validationResponse] = await Promise.all([
      getPreview(params),
      validateSped(params),
    ]);

    const validation = normalizeValidationResponse(validationResponse);

    renderPreview(previewResponse.data);
    renderIssues(validation);

    const totalErrors = Number(validation.totalErrors || 0);
    const totalWarnings = Number(validation.totalWarnings || 0);

    setStatus(
      `Prévia carregada. Erros: ${totalErrors}. Alertas: ${totalWarnings}.`,
      totalErrors > 0 ? 'warning' : 'info',
    );
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

export async function handleValidate() {
  try {
    const params = validateInputs();
    setStatus('Validando dados...', 'info');

    const response = await validateSped(params);
    const validation = normalizeValidationResponse(response);
    renderIssues(validation);

    if (validation.ok) {
      setStatus(
        `Validação concluída sem erros. Alertas: ${validation.totalWarnings || 0}`,
        'info',
      );
      return;
    }

    setStatus(
      `Validação encontrou ${validation.totalErrors || 0} erro(s) e ${validation.totalWarnings || 0} alerta(s).`,
      'warning',
    );
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

export async function handleGenerate() {
  try {
    const params = validateInputs();
    setStatus('Gerando SPED Fiscal...', 'info');

    const response = await generateSped(params);

    const validation = normalizeValidationResponse(response);

    if (!response.ok) {
      renderIssues(validation);
      setStatus(response.message || 'Falha ao gerar SPED.', 'warning');

      if (response.loteId && els.downloadLoteId) {
        els.downloadLoteId.value = response.loteId;
      }
      return;
    }

    renderIssues(validation);

    if (els.downloadLoteId) {
      els.downloadLoteId.value = response.loteId || '';
    }

    setStatus(`SPED gerado com sucesso. Lote ${response.loteId}.`, 'info');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  }
}

export function handleDownload() {
  try {
    const loteId = readLoteId();
    window.open(getDownloadUrl(loteId), '_blank', 'noopener,noreferrer');
  } catch (error) {
    setStatus(errorMessage(error), 'warning');
  }
}
