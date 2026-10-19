// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.form.js                                        ║
// ║ MODULE: Products Fiscal — Form                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './productsFiscal.state.js';
import { asNumberOrNull, byId, debugLog, debugWarn, pick, value } from './productsFiscal.utils.js';

function fillIf(id, input) {
  const element = byId(id);
  if (element && input != null) element.value = String(input);
}

export function fillFormFromFiscalData(classification, profile) {
  fillIf('ncm', pick(classification, 'ncm', 'ncm_code'));
  fillIf('cest', pick(classification, 'cest', 'cest_code'));
  fillIf('ex_tipi', pick(classification, 'ex_tipi', 'exTipi'));

  const source = profile ?? classification ?? {};
  const mappings = {
    cst_icms: ['icms_cst', 'cst_icms'],
    csosn: ['csosn'],
    aliquota_icms: ['icms_rate', 'aliquota_icms'],
    reducao_bc: ['icms_reduction', 'reducao_bc'],
    mva_st: ['mva_st'],
    aliquota_st: ['aliquota_st'],
    aliquota_fcp: ['fcp_rate', 'aliquota_fcp'],
    modalidade_bc: ['mod_bc', 'modalidade_bc'],
    modalidade_bc_st: ['mod_bc_st', 'modalidade_bc_st'],
    origem_mercadoria: ['origin_code', 'origem_mercadoria'],
    pis_cst: ['pis_cst'],
    pis_aliquota: ['pis_rate', 'pis_aliquota'],
    cofins_cst: ['cofins_cst'],
    cofins_aliquota: ['cofins_rate', 'cofins_aliquota'],
    ipi_cst: ['ipi_cst'],
    ipi_aliquota: ['ipi_rate', 'ipi_aliquota'],
  };

  Object.entries(mappings).forEach(([id, keys]) => fillIf(id, pick(source, ...keys)));

  const cfopEntry = pick(source, 'cfop_entry', 'cfops_entrada');
  const cfopExit = pick(source, 'cfop_exit', 'cfops_saida');
  if (cfopEntry) fillIf('cfops_entrada', Array.isArray(cfopEntry) ? cfopEntry.join(', ') : cfopEntry);
  if (cfopExit) fillIf('cfops_saida', Array.isArray(cfopExit) ? cfopExit.join(', ') : cfopExit);
}

export function fillSelectedProduct(product) {
  const nameInput = byId('pf_nome');
  if (nameInput) {
    nameInput.value = product?.description || product?.nome || product?.name || '';
  }
  fillIf('pf_product_id', product?.product_id ?? product?.id ?? '');
  fillIf(
    'pf_product_code',
    product?.product_code ?? product?.sku ?? product?.code ?? product?.codigo ?? '',
  );
  debugLog('Produto selecionado:', {
    id: product?.product_id ?? product?.id,
    code: product?.product_code ?? product?.sku ?? product?.code,
    name: nameInput?.value,
  });
}

export function readProductsFiscalForm() {
  const productCode = String(
    state.product?.product_code ??
    state.product?.sku ??
    state.product?.code ??
    state.product?.codigo ??
    value('pf_product_code'),
  ).trim();

  if (!productCode) {
    debugWarn('readProductsFiscalForm(): product_code inválido', {
      state: state.product,
      hidden: value('pf_product_code'),
    });
  }
  const classification = state.fiscalClassification || {};
  const classificationId =
    asNumberOrNull(value('fiscal_classification_id')) ??
    classification.fiscal_classification_id ??
    classification.fiscal_class_id ??
    classification.id ??
    null;
  const productId = state.product?.product_id ?? state.product?.id ?? asNumberOrNull(value('pf_product_id'));
  const payload = {
    product_code: productCode,
    fiscal_classification_id: Number(classificationId),
    source_system: 'CONSART-ERP',
    extra_payload: {
      product_id: productId ?? null,
      product_name: state.product?.description ?? state.product?.nome ?? state.product?.name ?? null,
    },
  };

  debugLog('readProductsFiscalForm():', payload);
  return payload;
}
