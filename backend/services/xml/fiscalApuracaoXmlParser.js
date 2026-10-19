// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalApuracaoXmlParser.js                                     ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ CONSART ERP                                                          ║
// ║ XML PARSER LAYER                                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { parseStringPromise } from 'xml2js';


/* ======================================================================
   HELPERS
   ====================================================================== */

function first(value, fallback = null) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function text(value, fallback = '') {
  const v = first(value, fallback);
  return v == null ? fallback : String(v).trim();
}

function numberValue(value, fallback = 0) {
  const raw = text(value, '');
  if (!raw) return fallback;

  const normalized = String(raw).replace(',', '.');
  const n = Number(normalized);

  return Number.isFinite(n) ? n : fallback;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function cleanXmlContent(xmlContent) {
  return String(xmlContent || '')
    .replace(/^\uFEFF/, '')
    .trim();
}

function getIde(infNFe) {
  return first(infNFe?.ide, infNFe?.ide || {});
}

function getEmit(infNFe) {
  return first(infNFe?.emit, infNFe?.emit || {});
}

function getDest(infNFe) {
  return first(infNFe?.dest, infNFe?.dest || {});
}

function getTotal(infNFe) {
  return first(infNFe?.total, infNFe?.total || {});
}

function getProtNFe(parsed) {
  const nfeProc = first(parsed?.nfeProc, parsed?.nfeProc || null);
  const protNFe = first(nfeProc?.protNFe, nfeProc?.protNFe || null);
  const infProt = first(protNFe?.infProt, protNFe?.infProt || null);

  return infProt || {};
}

function normalizeDocumentType(emitTaxId, destTaxId, companyTaxId, tpNF = '') {
  const emit = String(emitTaxId || '').replace(/\D/g, '');
  const dest = String(destTaxId || '').replace(/\D/g, '');
  const company = String(companyTaxId || '').replace(/\D/g, '');
  const operationType = String(tpNF || '').trim();

  if (company) {
    if (emit === company) return 'SAIDA';
    if (dest === company) return 'ENTRADA';
  }

  // Fallback oficial da NF-e:
  // tpNF = 0 -> Entrada
  // tpNF = 1 -> Saída
  if (operationType === '0') return 'ENTRADA';
  if (operationType === '1') return 'SAIDA';

  return 'SAIDA';
}

function getInfNFe(parsed) {
  const nfeProc = first(parsed?.nfeProc, parsed?.nfeProc || null);
  if (nfeProc) {
    const nfe = first(nfeProc?.NFe, nfeProc?.NFe || null);
    if (nfe) {
      return first(nfe?.infNFe, nfe?.infNFe || null);
    }
  }

  const nfe = first(parsed?.NFe, parsed?.NFe || null);
  if (nfe) {
    return first(nfe?.infNFe, nfe?.infNFe || null);
  }

  return null;
}

function parseIcmsTax(imposto = {}) {
  const icmsGroup = first(imposto?.ICMS, imposto?.ICMS || {});
  const icmsKeys = Object.keys(icmsGroup || {}).filter(key => key !== '$');
  const icmsTypeKey = icmsKeys[0];
  const icmsNode = icmsTypeKey ? first(icmsGroup[icmsTypeKey], icmsGroup[icmsTypeKey] || {}) : {};

  return {
    icms_cst: text(icmsNode?.CST || icmsNode?.CSOSN || ''),
    icms_csosn: text(icmsNode?.CSOSN || ''),
    origin_code: text(icmsNode?.orig || ''),
    icms_rate: numberValue(icmsNode?.pICMS, 0),
    icms_base: numberValue(icmsNode?.vBC, 0),
    icms_value: numberValue(icmsNode?.vICMS, 0),

    icms_st_rate: numberValue(icmsNode?.pICMSST, 0),
    icms_st_base: numberValue(icmsNode?.vBCST, 0),
    icms_st_value: numberValue(icmsNode?.vICMSST, 0),

    fcp_rate: numberValue(icmsNode?.pFCP || icmsNode?.pFCPST, 0),
    fcp_base: numberValue(icmsNode?.vBCFCP || icmsNode?.vBCFCPST, 0),
    fcp_value: numberValue(icmsNode?.vFCP || icmsNode?.vFCPST, 0)
  };
}

function parsePisTax(imposto = {}) {
  const pisGroup = first(imposto?.PIS, imposto?.PIS || {});
  const pisKeys = Object.keys(pisGroup || {}).filter(key => key !== '$');
  const pisTypeKey = pisKeys[0];
  const pisNode = pisTypeKey ? first(pisGroup[pisTypeKey], pisGroup[pisTypeKey] || {}) : {};

  return {
    pis_cst: text(pisNode?.CST || ''),
    pis_rate: numberValue(pisNode?.pPIS, 0),
    pis_base: numberValue(pisNode?.vBC, 0),
    pis_value: numberValue(pisNode?.vPIS, 0)
  };
}

function parseCofinsTax(imposto = {}) {
  const cofinsGroup = first(imposto?.COFINS, imposto?.COFINS || {});
  const cofinsKeys = Object.keys(cofinsGroup || {}).filter(key => key !== '$');
  const cofinsTypeKey = cofinsKeys[0];
  const cofinsNode = cofinsTypeKey ? first(cofinsGroup[cofinsTypeKey], cofinsGroup[cofinsTypeKey] || {}) : {};

  return {
    cofins_cst: text(cofinsNode?.CST || ''),
    cofins_rate: numberValue(cofinsNode?.pCOFINS, 0),
    cofins_base: numberValue(cofinsNode?.vBC, 0),
    cofins_value: numberValue(cofinsNode?.vCOFINS, 0)
  };
}

function parseIpiTax(imposto = {}) {
  const ipiGroup = first(imposto?.IPI, imposto?.IPI || {});
  const ipiTrib = first(ipiGroup?.IPITrib, ipiGroup?.IPITrib || {});
  const ipiNt = first(ipiGroup?.IPINT, ipiGroup?.IPINT || {});
  const node = Object.keys(ipiTrib || {}).length ? ipiTrib : ipiNt;

  return {
    ipi_cst: text(node?.CST || ''),
    ipi_rate: numberValue(node?.pIPI, 0),
    ipi_base: numberValue(node?.vBC, 0),
    ipi_value: numberValue(node?.vIPI, 0)
  };
}


/* ======================================================================
   MAIN PARSER
   ====================================================================== */

export async function parseFiscalApuracaoXml(xmlContent, options = {}) {
  const safeXmlContent = cleanXmlContent(xmlContent);

  if (!safeXmlContent) {
    throw new Error('Conteúdo XML vazio');
  }

  const parsed = await parseStringPromise(safeXmlContent, {
    explicitArray: true,
    trim: true,
    mergeAttrs: false
  });

  const infNFe = getInfNFe(parsed);

  if (!infNFe) {
    throw new Error('Estrutura XML da NF-e não encontrada');
  }

  const ide = getIde(infNFe);
  const emit = getEmit(infNFe);
  const dest = getDest(infNFe);
  const total = getTotal(infNFe);
  const protNFe = getProtNFe(parsed);

  const icmsTot = first(total?.ICMSTot, total?.ICMSTot || {});
  const companyTaxId = options.companyTaxId || '';

  const emitTaxId = text(emit?.CNPJ || emit?.CPF || '');
  const destTaxId = text(dest?.CNPJ || dest?.CPF || '');
  const tpNF = text(ide?.tpNF, '');

  const document = {
    document_type: normalizeDocumentType(emitTaxId, destTaxId, companyTaxId, tpNF),
    model: text(ide?.mod, ''),
    serie: text(ide?.serie, ''),
    number: text(ide?.nNF, ''),
    nfe_key: String(infNFe?.$?.Id || '').replace(/^NFe/i, ''),
    protocol: text(protNFe?.nProt, ''),
    issue_date: text(ide?.dhEmi || ide?.dEmi, '').slice(0, 10) || null,
    issue_datetime: text(ide?.dhEmi || '', '') || null,

    emit_tax_id: emitTaxId,
    emit_name: text(emit?.xNome, ''),

    dest_tax_id: destTaxId,
    dest_name: text(dest?.xNome, ''),

    partner_tax_id: '',
    partner_name: '',

    total_products_value: numberValue(icmsTot?.vProd, 0),
    total_nfe_value: numberValue(icmsTot?.vNF, 0),
    total_icms_value: numberValue(icmsTot?.vICMS, 0),
    total_icms_st_value: numberValue(icmsTot?.vST, 0),
    total_fcp_value: numberValue(icmsTot?.vFCP || icmsTot?.vFCPST, 0),
    total_ipi_value: numberValue(icmsTot?.vIPI, 0),
    total_pis_value: numberValue(icmsTot?.vPIS, 0),
    total_cofins_value: numberValue(icmsTot?.vCOFINS, 0),
    total_freight_value: numberValue(icmsTot?.vFrete, 0),
    total_discount_value: numberValue(icmsTot?.vDesc, 0),
    total_other_value: numberValue(icmsTot?.vOutro, 0),

    raw_payload: parsed
  };

  if (document.document_type === 'SAIDA') {
    document.partner_tax_id = destTaxId;
    document.partner_name = document.dest_name;
  } else {
    document.partner_tax_id = emitTaxId;
    document.partner_name = document.emit_name;
  }

  const detList = ensureArray(infNFe?.det);

  const items = detList.map((det, index) => {
    const prod = first(det?.prod, det?.prod || {});
    const imposto = first(det?.imposto, det?.imposto || {});

    const icms = parseIcmsTax(imposto);
    const pis = parsePisTax(imposto);
    const cofins = parseCofinsTax(imposto);
    const ipi = parseIpiTax(imposto);

    const grossValue = numberValue(prod?.vProd, 0);
    const discountValue = numberValue(prod?.vDesc, 0);
    const freightValue = numberValue(prod?.vFrete, 0);
    const otherValue = numberValue(prod?.vOutro, 0);
    const insuranceValue = numberValue(prod?.vSeg, 0);

    return {
      item_number: Number(det?.$?.nItem || index + 1),
      product_code: text(prod?.cProd, ''),
      sku: text(prod?.cProd, ''),
      ean: text(prod?.cEAN || prod?.cEANTrib || ''),
      description: text(prod?.xProd, ''),
      ncm_code: text(prod?.NCM, ''),
      cest_code: text(prod?.CEST, ''),
      cfop: text(prod?.CFOP, ''),
      unit: text(prod?.uCom || prod?.uTrib || ''),
      quantity: numberValue(prod?.qCom || prod?.qTrib, 0),
      unit_value: numberValue(prod?.vUnCom || prod?.vUnTrib, 0),
      gross_value: grossValue,
      discount_value: discountValue,
      freight_value: freightValue,
      other_value: otherValue,
      insurance_value: insuranceValue,
      net_value: grossValue - discountValue + freightValue + otherValue + insuranceValue,

      origin_code: icms.origin_code,

      icms_cst: icms.icms_cst,
      icms_csosn: icms.icms_csosn,
      icms_rate: icms.icms_rate,
      icms_base: icms.icms_base,
      icms_value: icms.icms_value,

      icms_st_rate: icms.icms_st_rate,
      icms_st_base: icms.icms_st_base,
      icms_st_value: icms.icms_st_value,

      fcp_rate: icms.fcp_rate,
      fcp_base: icms.fcp_base,
      fcp_value: icms.fcp_value,

      pis_cst: pis.pis_cst,
      pis_rate: pis.pis_rate,
      pis_base: pis.pis_base,
      pis_value: pis.pis_value,

      cofins_cst: cofins.cofins_cst,
      cofins_rate: cofins.cofins_rate,
      cofins_base: cofins.cofins_base,
      cofins_value: cofins.cofins_value,

      ipi_cst: ipi.ipi_cst,
      ipi_rate: ipi.ipi_rate,
      ipi_base: ipi.ipi_base,
      ipi_value: ipi.ipi_value,

      tax_role: document.document_type === 'SAIDA' ? 'DEBIT' : 'CREDIT',
      source_type: document.document_type === 'SAIDA' ? 'XML_SAIDA' : 'XML_ENTRADA',
      raw_payload: det
    };
  });

  return {
    document,
    items
  };
}

export default parseFiscalApuracaoXml;