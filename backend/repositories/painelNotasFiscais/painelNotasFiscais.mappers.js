// ╔══════════════════════════════════════════════════════════════════════╗
// ║ painelNotasFiscais.mappers.js — XML da NF-e → campos do painel       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { XMLParser } from 'fast-xml-parser';
import { log, onlyDigits, toNumberSafe, getNodeValue } from './painelNotasFiscais.utils.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
});

// ───────────────────────────────────────────────────────────────────────────
// Extração do XML
export function extrairCampos(xmlStr = '') {
  try {
    const j = parser.parse(xmlStr);

    const nfeProc = j?.nfeProc || {};
    const NFe = nfeProc?.NFe || j?.NFe || {};
    const infNFe = NFe?.infNFe || {};

    const ide = infNFe?.ide || {};
    const dest = infNFe?.dest || {};
    const total = infNFe?.total || {};
    const ICMSTot = total?.ICMSTot || {};
    const prot = nfeProc?.protNFe?.infProt || {};

    const chave =
      getNodeValue(
        prot?.chNFe,
        infNFe?.Id ? String(infNFe.Id).replace(/^NFe/i, '') : '',
      ) || '';

    const valorTotal =
      toNumberSafe(
        getNodeValue(
          ICMSTot?.vNF,
          ICMSTot?.vProd,
          total?.vNF,
          infNFe?.vNF,
        )
      );

    return {
      chave: onlyDigits(chave),
      cliente: getNodeValue(dest?.xNome, dest?.nome, '-') || '-',
      cnpj: getNodeValue(dest?.CNPJ, dest?.CPF, '-') || '-',
      numero: getNodeValue(ide?.nNF, ide?.numero, '-') || '-',
      emissao: getNodeValue(ide?.dhEmi, ide?.dEmi, '-') || '-',
      valorTotal,
    };
  } catch (err) {
    log('Falha ao extrair XML:', err.message);
    return {
      chave: '',
      cliente: '-',
      cnpj: '-',
      numero: '-',
      emissao: '-',
      valorTotal: null,
    };
  }
}
