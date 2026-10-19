'use strict';

import { resolveFeature } from '../../repositories/appFeatures/appFeatures.index.js';
import {
  generateBudgetPdf as generateBudgetPdfSimple,
} from './generationBudgetsPdf.simple.js.js';
import {
  generateBudgetPdf as generateBudgetPdfWithImages,
} from './generationBudgetsPdf.withImages.js';

export const BUDGET_PDF_FEATURE_CODE = 'BUDGET_PDF_TEMPLATE';

export const BUDGET_PDF_TEMPLATES = Object.freeze({
  SIMPLE: 'SIMPLE',
  WITH_IMAGES: 'WITH_IMAGES',
});

const generators = Object.freeze({
  [BUDGET_PDF_TEMPLATES.SIMPLE]: generateBudgetPdfSimple,
  [BUDGET_PDF_TEMPLATES.WITH_IMAGES]: generateBudgetPdfWithImages,
});

function normalizeTemplate(value) {
  const template = String(value ?? '').trim().toUpperCase();
  return generators[template] ? template : null;
}

export async function resolveBudgetPdfTemplate(options = {}) {
  const forcedTemplate = normalizeTemplate(options.pdfTemplate);

  if (forcedTemplate) {
    return {
      template: forcedTemplate,
      source: 'REQUEST_OVERRIDE',
      feature: null,
    };
  }

  const feature = await resolveFeature({
    featureCode: BUDGET_PDF_FEATURE_CODE,
    scopeType: options.featureScopeType ?? 'GLOBAL',
    scopeId: options.featureScopeId ?? 1,
  });

  const configuredTemplate = normalizeTemplate(feature?.optionCode);
  const template = feature?.enabled && configuredTemplate
    ? configuredTemplate
    : BUDGET_PDF_TEMPLATES.SIMPLE;

  return {
    template,
    source: feature?.enabled && configuredTemplate
      ? feature.source
      : 'SAFE_DEFAULT',
    feature,
  };
}

export async function generateBudgetPdf(budget = {}, options = {}) {
  const selection = await resolveBudgetPdfTemplate(options);
  const generator = generators[selection.template];

  if (options.debug) {
    console.log('[BUDGET_PDF_TEMPLATE]', {
      featureCode: BUDGET_PDF_FEATURE_CODE,
      template: selection.template,
      source: selection.source,
      scopeType: options.featureScopeType ?? 'GLOBAL',
      scopeId: options.featureScopeId ?? 1,
    });
  }

  return generator(budget, options);
}

export default {
  generateBudgetPdf,
  resolveBudgetPdfTemplate,
  BUDGET_PDF_FEATURE_CODE,
  BUDGET_PDF_TEMPLATES,
};
