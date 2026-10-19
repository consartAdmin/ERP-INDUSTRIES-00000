// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasParser.js — Parser de XML de NF-e (Históricas)         ║
// ║ PRODNEX ERP — Converte XML → Objeto pronto p/ salvar no banco       ║
// ║ Suporta: nfeProc, NFe puro, protocolo SEFAZ e itens básicos         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { parseStringPromise } from 'xml2js';   // 👈 AQUI

/* =========================================================================
 * Helpers
 * ========================================================================= */

function safe(obj, path, def = null) {
  return path
    .split('.')
    .reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), obj) ?? def;
}

const onlyNumbers = str => String(str || '').replace(/\D/g, '');

/* =========================================================================
 * Extrair itens (para uso futuro, se quiser salvar em tabela de itens)   *
 * ========================================================================= */
function extractItems(rootNFe) {
  const detArray = rootNFe?.infNFe?.[0]?.det || [];
  const items = [];

  for (const det of detArray) {
    const prod = det.prod?.[0] || {};

    items.push({
      line_number: Number(det.$?.nItem || items.length + 1),
      product_code: prod.cProd?.[0] ?? null,
      description: prod.xProd?.[0] ?? null,
      ncm: prod.NCM?.[0] ?? null,
      cest: prod.CEST?.[0] ?? null,
      cfop: prod.CFOP?.[0] ?? null,
      unit: prod.uCom?.[0] ?? null,
      quantity: Number(prod.qCom?.[0] ?? 0),
      unit_price: Number(prod.vUnCom?.[0] ?? 0),
      total_value: Number(prod.vProd?.[0] ?? 0)
    });
  }

  return items;
}

/* =========================================================================
 * Extrair protocolo SEFAZ (se existir no nfeProc)                        *
 * ========================================================================= */
function extractProtocol(parsed) {
  const prot = parsed?.nfeProc?.protNFe?.[0] || parsed?.protNFe?.[0];
  if (!prot) return { status_sefaz: null, status_desc: null };

  const infProt = prot.infProt?.[0] || {};
  return {
    status_sefaz: infProt.cStat?.[0] ?? null,
    status_desc: infProt.xMotivo?.[0] ?? null
  };
}

/* =========================================================================
 * Extrair dados principais da NF-e                                       *
 * ========================================================================= */
function extractMainData(rootNFe) {
  const infNFe = rootNFe?.infNFe?.[0];
  if (!infNFe) {
    throw new Error('Estrutura XML inválida: infNFe ausente.');
  }

  const ide = infNFe.ide?.[0] || {};
  const emit = infNFe.emit?.[0] || {};
  const dest = infNFe.dest?.[0] || {};
  const total = infNFe.total?.[0]?.ICMSTot?.[0] || {};

  const idAttr = infNFe.$?.Id || '';
  const accessKey = String(idAttr).replace(/^NFe/i, '').trim();

  const tpAmb = ide.tpAmb?.[0];
  const env =
    tpAmb === '2'
      ? 'homologacao'
      : tpAmb === '1'
      ? 'producao'
      : tpAmb || null;

  return {
    access_key: accessKey || null,
    model: ide.mod?.[0] ?? null,
    series: ide.serie?.[0] ?? null,
    number: ide.nNF?.[0] ? Number(ide.nNF[0]) : null,
    issue_date: ide.dhEmi?.[0] || ide.dEmi?.[0] || null,

    emitter_cnpj: onlyNumbers(emit.CNPJ?.[0] ?? ''),
    emitter_name: emit.xNome?.[0] ?? null,

    dest_cnpj_cpf: onlyNumbers(dest.CNPJ?.[0] ?? dest.CPF?.[0] ?? ''),
    dest_name: dest.xNome?.[0] ?? null,

    operation_nature: ide.natOp?.[0] ?? null,
    total_value: total.vNF?.[0] ? Number(total.vNF[0]) : 0,

    environment: env
  };
}

/* =========================================================================
 * Função principal — Parser de XML                                       *
 * ========================================================================= */
export async function parseNfeXmlAntigas(xmlString) {
  try {
    const parsed = await parseStringPromise(xmlString, {
      explicitArray: true,
      ignoreAttrs: false,
      mergeAttrs: false
    });

    // Descobre o nó NFe real (dentro de nfeProc ou direto)
    const rootNFe =
      parsed?.nfeProc?.NFe?.[0] || // nfeProc -> NFe
      parsed?.NFe?.[0];            // NFe isolado

    if (!rootNFe) {
      throw new Error('XML não parece ser uma NF-e válida (NFe/nfeProc ausente).');
    }

    const main = extractMainData(rootNFe);
    const protocol = extractProtocol(parsed);
    const items = extractItems(rootNFe);

    if (!main.access_key) {
      throw new Error('Chave de acesso (Id da NFe) não encontrada no XML.');
    }

    return {
      ...main,
      ...protocol,
      xml_original: xmlString,
      items
    };
  } catch (err) {
    console.error('[nfeXmlAntigasParser] Erro ao processar XML:', err);
    throw new Error('Falha ao converter XML de NF-e: ' + err.message);
  }
}
