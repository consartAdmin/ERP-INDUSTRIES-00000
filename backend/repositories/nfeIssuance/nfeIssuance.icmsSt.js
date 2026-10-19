// ╔════════════════════════════════════════════════════════════╗
// ║ nfeIssuance.icmsSt.js — cálculo do ICMS-ST retido (CST 60) ║
// ║ normalização da origem, rateio por unidade e aplicação     ║
// ╚════════════════════════════════════════════════════════════╝

import { ICMS_ST_RETAINED_SOURCE_CSTS } from './nfeIssuance.constants.js';
import { normalizeCst, firstNonEmpty, xmlText, toNumberOrNull, firstNumber, roundTo, parseJsonPayload, extractIcmsGroup, inboundBaseQuantity, budgetItemBaseQuantity } from './nfeIssuance.utils.js';

export function normalizeInboundIcmsSt(row) {
  const payload = parseJsonPayload(row?.raw_tax_payload) || {};
  const icmsGroup = extractIcmsGroup(payload);
  const group = icmsGroup?.group || {};

  // raw_tax_payload exists in two shapes in the database:
  // 1) normalized/flat JSON (icms_cst, icms_st_base, ...);
  // 2) XML/xml2js JSON (ICMS -> ICMS10/ICMS60/ICMSSN500 -> ...).
  const sourceCst = normalizeCst(
    firstNonEmpty(
      row?.icms_cst,
      payload?.icms_cst,
      payload?.cst_icms,
      payload?.CST,
      payload?.CSOSN,
      xmlText(group, 'CST'),
      xmlText(group, 'CSOSN'),
    ),
  );

  const flatPayloadIsRetained =
    firstNumber(
      payload?.icms_st_base_retained,
      payload?.vBCSTRet,
      payload?.icms_st_value_retained,
      payload?.vICMSSTRet,
    ) !== null;

  const xmlPayloadIsRetained =
    xmlText(group, 'vBCSTRet') !== null ||
    xmlText(group, 'vICMSSTRet') !== null;

  const isRetainedSource =
    flatPayloadIsRetained ||
    xmlPayloadIsRetained ||
    ICMS_ST_RETAINED_SOURCE_CSTS.has(sourceCst);

  const stBase = firstNumber(
    row?.icms_st_base,
    payload?.icms_st_base,
    payload?.icms_st_base_retained,
    payload?.vBCST,
    payload?.vBCSTRet,
    xmlText(group, 'vBCST'),
    xmlText(group, 'vBCSTRet'),
  );

  const stRate = firstNumber(
    row?.icms_st_rate,
    payload?.icms_st_rate,
    payload?.icms_st_rate_retained,
    payload?.pICMSST,
    payload?.pST,
    xmlText(group, 'pICMSST'),
    xmlText(group, 'pST'),
  );

  const stValue = firstNumber(
    row?.icms_st_value,
    payload?.icms_st_value,
    payload?.icms_st_value_retained,
    payload?.vICMSST,
    payload?.vICMSSTRet,
    xmlText(group, 'vICMSST'),
    xmlText(group, 'vICMSSTRet'),
  );

  const fcpStBase = firstNumber(
    row?.fcp_st_base,
    payload?.fcp_st_base,
    payload?.fcp_st_base_retained,
    payload?.vBCFCPST,
    payload?.vBCFCPSTRet,
    xmlText(group, 'vBCFCPST'),
    xmlText(group, 'vBCFCPSTRet'),
  );

  const fcpStRate = firstNumber(
    row?.fcp_st_rate,
    payload?.fcp_st_rate,
    payload?.fcp_st_rate_retained,
    payload?.pFCPST,
    payload?.pFCPSTRet,
    xmlText(group, 'pFCPST'),
    xmlText(group, 'pFCPSTRet'),
  );

  const fcpStValue = firstNumber(
    row?.fcp_st_value,
    payload?.fcp_st_value,
    payload?.fcp_st_value_retained,
    payload?.vFCPST,
    payload?.vFCPSTRet,
    xmlText(group, 'vFCPST'),
    xmlText(group, 'vFCPSTRet'),
  );

  const ownIcmsValue = isRetainedSource
    ? firstNumber(
      payload?.icms_substitute_value,
      payload?.vICMSSubstituto,
      xmlText(group, 'vICMSSubstituto'),
    )
    : firstNumber(
      row?.icms_value,
      payload?.icms_value,
      payload?.vICMS,
      xmlText(group, 'vICMS'),
    );

  const mvaRate = firstNumber(
    row?.icms_st_mva_rate,
    payload?.icms_st_mva_rate,
    payload?.pMVAST,
    xmlText(group, 'pMVAST'),
  );

  const baseQuantity = inboundBaseQuantity(row);

  let consumerRate = null;
  if (stRate !== null) {
    consumerRate = isRetainedSource ? stRate : stRate + (fcpStRate ?? 0);
  }

  const complete =
    stBase !== null &&
    stRate !== null &&
    stValue !== null &&
    baseQuantity !== null;

  function valueOrigin(columnValue, flatValues, xmlValues) {
    if (toNumberOrNull(columnValue) !== null) return 'columns';
    if (firstNumber(...flatValues) !== null) return 'raw_tax_payload_flat';
    if (firstNumber(...xmlValues) !== null) return 'raw_tax_payload_xml';
    return null;
  }

  const valueOrigins = {
    st_base: valueOrigin(
      row?.icms_st_base,
      [payload?.icms_st_base, payload?.icms_st_base_retained, payload?.vBCST, payload?.vBCSTRet],
      [xmlText(group, 'vBCST'), xmlText(group, 'vBCSTRet')],
    ),
    st_rate: valueOrigin(
      row?.icms_st_rate,
      [payload?.icms_st_rate, payload?.icms_st_rate_retained, payload?.pICMSST, payload?.pST],
      [xmlText(group, 'pICMSST'), xmlText(group, 'pST')],
    ),
    st_value: valueOrigin(
      row?.icms_st_value,
      [payload?.icms_st_value, payload?.icms_st_value_retained, payload?.vICMSST, payload?.vICMSSTRet],
      [xmlText(group, 'vICMSST'), xmlText(group, 'vICMSSTRet')],
    ),
  };

  const nonNullOrigins = Object.values(valueOrigins).filter(Boolean);
  const distinctOrigins = new Set(nonNullOrigins);
  const valuesFrom = distinctOrigins.size === 1
    ? [...distinctOrigins][0]
    : distinctOrigins.size > 1
      ? 'mixed'
      : null;

  return {
    complete,

    inbound_item_id: row?.inbound_item_id ?? null,
    inbound_id: row?.inbound_id ?? null,
    nfe_key: row?.nfe_key ?? null,
    nfe_item_seq: row?.nfe_item_seq ?? null,
    entry_created_at: row?.created_at ?? null,

    product_code: row?.product_code ?? null,
    product_id: row?.product_id ?? null,
    product_grade_id: row?.product_grade_id ?? null,
    grade_id: row?.grade_id ?? null,

    source_cst: sourceCst || null,
    source_icms_group: icmsGroup?.groupName ?? null,
    source_is_retained: isRetainedSource,
    source_values_from: valuesFrom,
    source_value_origins: valueOrigins,

    entry_unit: row?.unit ?? null,
    entry_quantity: toNumberOrNull(row?.quantity),
    entry_conversion_factor: toNumberOrNull(row?.conversion_factor) ?? 1,
    entry_base_quantity: baseQuantity,

    mva_rate: mvaRate,
    st_base: stBase,
    st_rate: stRate,
    st_value: stValue,
    consumer_rate: consumerRate,
    own_icms_value: ownIcmsValue,
    fcp_st_base: fcpStBase,
    fcp_st_rate: fcpStRate,
    fcp_st_value: fcpStValue,
  };
}

export function calculateRetainedIcmsSt(origin, item) {
  const saleBaseQuantity = budgetItemBaseQuantity(item);

  if (!origin?.complete || saleBaseQuantity === null) return null;

  const ratio = saleBaseQuantity / origin.entry_base_quantity;
  const hasFcp = origin.fcp_st_value !== null && origin.fcp_st_value > 0;

  return {
    sale_base_quantity: saleBaseQuantity,
    entry_base_quantity: origin.entry_base_quantity,
    proportion: roundTo(ratio, 8),

    // ratio > 1: a venda é maior que a entrada usada como origem, ou seja o
    // ICMS-ST retido por unidade foi multiplicado pela quantidade vendida
    // (prática usual para CST 60). Sinalizado para auditoria, não bloqueia.
    extrapolated: ratio > 1,

    vBCSTRet: roundTo(origin.st_base * ratio, 2),
    pST: roundTo(origin.consumer_rate, 4),
    vICMSSubstituto: origin.own_icms_value === null
      ? null
      : roundTo(origin.own_icms_value * ratio, 2),
    vICMSSTRet: roundTo(origin.st_value * ratio, 2),

    vBCFCPSTRet: hasFcp
      ? roundTo((origin.fcp_st_base ?? origin.st_base) * ratio, 2)
      : null,
    pFCPSTRet: hasFcp ? roundTo(origin.fcp_st_rate, 4) : null,
    vFCPSTRet: hasFcp ? roundTo(origin.fcp_st_value * ratio, 2) : null,
  };
}

export function applyRetainedIcmsSt(item, origin, retained) {
  const { complete, ...originData } = origin;

  item.icms_st_origin = originData;
  item.icms_st_retained = retained;
  item.icms_st_origin_inbound_item_id = origin.inbound_item_id;

  // Nomes do layout NF-e (grupo ICMS60).
  item.vBCSTRet = retained.vBCSTRet;
  item.pST = retained.pST;
  item.vICMSSubstituto = retained.vICMSSubstituto;
  item.vICMSSTRet = retained.vICMSSTRet;
  item.vBCFCPSTRet = retained.vBCFCPSTRet;
  item.pFCPSTRet = retained.pFCPSTRet;
  item.vFCPSTRet = retained.vFCPSTRet;

  // Aliases snake_case para o builder e para o snapshot da tentativa.
  item.icms_st_base_retained = retained.vBCSTRet;
  item.icms_st_rate_retained = retained.pST;
  item.icms_substitute_value = retained.vICMSSubstituto;
  item.icms_st_value_retained = retained.vICMSSTRet;
  item.fcp_st_base_retained = retained.vBCFCPSTRet;
  item.fcp_st_rate_retained = retained.pFCPSTRet;
  item.fcp_st_value_retained = retained.vFCPSTRet;

  item.tax_calculation = {
    ...(item.tax_calculation || {}),
    icms_st_origin: originData,
    icms_st_retained: retained,
  };

  return item;
}
