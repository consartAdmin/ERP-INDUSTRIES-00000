// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasParser.js — Parser de XML de NF-e (Históricas)         ║
// ║ CONSART ERP — Conversão de XML → Objeto pronto p/ salvar no banco   ║
// ║ Suporta: NFe, nfeProc, protocolos, datas, totais, emit/dest, itens  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { parseStringPromise } from 'xml2js';

/* =========================================================================
 * Helpers
 * ========================================================================= */

// Retorna o valor de forma segura (evita undefined)
function safe(obj, path, def = null) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), obj) ?? def;
}

// Remove caracteres não numéricos
const onlyNumbers = str => String(str || '').replace(/\D/g, '');

/* =========================================================================
 * Extrai os itens da NF-e (opcional — caso queira salvar futuramente)
 * ========================================================================= */
function extractItems(nfe) {
  const det = safe(nfe, 'NFe.infNFe.det') || [];
  const items = [];

  for (const detItem of det) {
    const prod = detItem.prod?.[0] || {};

    items.push({
      line_number: Number(detItem.$?.nItem || items.length + 1),
      product_code: safe(prod, 'cProd.0'),
      description: safe(prod, 'xProd.0'),
      ncm: safe(prod, 'NCM.0'),
      cest: safe(prod, 'CEST.0'),
      cfop: safe(prod, 'CFOP.0'),
      unit: safe(prod, 'uCom.0'),
      quantity: Number(safe(prod, 'qCom.0') || 0),
      unit_price: Number(safe(prod, 'vUnCom.0') || 0),
      total_value: Number(safe(prod, 'vProd.0') || 0),
    });
  }

  return items;
}

/* =========================================================================
 * Extrai o protocolo SEFAZ (se existir)
 * ========================================================================= */
function extractProtocol(xmlParsed) {
  const prot = safe(xmlParsed, 'nfeProc.protNFe.0') ||
               safe(xmlParsed, 'protNFe');

  if (!prot) return { status_sefaz: null, status_desc: null };

  return {
    status_sefaz: safe(prot, 'infProt.0.cStat.0'),
    status_desc:  safe(prot, 'infProt.0.xMotivo.0')
  };
}

/* =========================================================================
 * Extrai os dados principais da NF-e
 * ========================================================================= */
function extractMainData(nfe) {
  const ide = safe(nfe, 'NFe.infNFe.ide.0') || {};
  const emit = safe(nfe, 'NFe.infNFe.emit.0') || {};
  const dest = safe(nfe, 'NFe.infNFe.dest.0') || {};
  const total = safe(nfe, 'NFe.infNFe.total.0.ICMSTot.0') || {};

  return {
    access_key: safe(nfe, 'NFe.infNFe.$.Id', '').replace(/^NFe/, ''),
    model: safe(ide, 'mod.0'),
    series: safe(ide, 'serie.0'),
    number: Number(safe(ide, 'nNF.0') || 0),
    issue_date: safe(ide, 'dhEmi.0') || safe(ide, 'dEmi.0') || null,

    emitter_cnpj: onlyNumbers(safe(emit, 'CNPJ.0')),
    emitter_name: safe(emit, 'xNome.0'),

    dest_cnpj_cpf: onlyNumbers(safe(dest, 'CNPJ.0') || safe(dest, 'CPF.0')),
    dest_name: safe(dest, 'xNome.0'),

    operation_nature: safe(ide, 'natOp.0'),

    total_value: Number(safe(total, 'vNF.0') || 0),

    environment: safe(ide, 'tpAmb.0') === '2' ? 'homologacao' : 'producao'
  };
}

/* =========================================================================
 * Função principal — Parser de XML
 * ========================================================================= */
export async function parseNfeXmlAntigas(xmlString) {
  try {
    // Converte XML → objeto JS
    const parsed = await parseStringPromise(xmlString, {
      explicitArray: true,
      ignoreAttrs: false,
      mergeAttrs: false
    });

    // Detecta se o XML vem no formato NFe ou nfeProc
    const nfe =
      parsed?.nfeProc?.NFe?.[0] ||
      parsed?.NFe?.[0] ||
      parsed;

    if (!nfe || !nfe.NFe?.infNFe) {
      throw new Error('XML de NF-e inválido ou estrutura inesperada.');
    }

    // Extrai dados principais
    const main = extractMainData({ NFe: nfe.NFe });

    // Extrai protocolo, se existir
    const protocol = extractProtocol(parsed);

    // Extrai itens (opcional)
    const items = extractItems({ NFe: nfe.NFe });

    // Objeto final
    return {
      ...main,
      ...protocol,
      xml_original: xmlString,
      items
    };
  } catch (err) {
    console.error('[nfeXmlAntigasParser] Erro ao processar XML:', err);
    throw new Error('Falha ao converter XML de NF-e.');
  }
}
