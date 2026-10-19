// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesXmlImport.repository.js — NF-e XML → draft           ║
// ║ parseNfeXmlToExpenseEntryDraft (xml2js)                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { parseStringPromise } from 'xml2js';
import { pick, toDateOnly, toNum, onlyDigits } from './expenseEntries.utils.js';

export async function parseNfeXmlToExpenseEntryDraft(xmlBufferOrText) {
  const xmlText = Buffer.isBuffer(xmlBufferOrText)
    ? xmlBufferOrText.toString('utf8')
    : String(xmlBufferOrText || '');

  const parsed = await parseStringPromise(xmlText, {
    explicitArray: true,
    trim: true,
    normalize: true,
    normalizeTags: false,
    mergeAttrs: false,
  });

  const infNFe =
    pick(parsed, 'nfeProc.NFe.infNFe') ||
    pick(parsed, 'NFe.infNFe') ||
    pick(parsed, 'nfeProc.NFe[0].infNFe') ||
    null;

  if (!infNFe) throw new Error('XML inválido: infNFe não encontrado (NF-e).');

  const rawId = pick(infNFe, '$.Id') || '';
  const documentKey = rawId.startsWith('NFe') ? rawId.slice(3) : rawId;

  const issueDate = toDateOnly(pick(infNFe, 'ide.dhEmi') || pick(infNFe, 'ide.dEmi'));
  const entryDate = issueDate;

  const documentNumber = pick(infNFe, 'ide.nNF');
  const documentSeries = pick(infNFe, 'ide.serie');

  const supplierName = pick(infNFe, 'emit.xNome') || pick(infNFe, 'emit.xFant') || null;
  const supplierDocument = onlyDigits(pick(infNFe, 'emit.CNPJ') || pick(infNFe, 'emit.CPF') || '');

  const vProd = toNum(pick(infNFe, 'total.ICMSTot.vProd'), 0);
  const vDesc = toNum(pick(infNFe, 'total.ICMSTot.vDesc'), 0);
  const vTotTrib = toNum(pick(infNFe, 'total.ICMSTot.vTotTrib'), 0);
  const vNF = toNum(pick(infNFe, 'total.ICMSTot.vNF'), 0);

  const det = pick(infNFe, 'det') || [];
  const detArr = Array.isArray(det) ? det : [det];

  const items = detArr
    .map((d) => {
      const prod = (d && d.prod && d.prod[0]) ? d.prod[0] : null;
      if (!prod) return null;

      const sku = pick(prod, 'cProd');
      const description = pick(prod, 'xProd');
      const unit = pick(prod, 'uCom') || pick(prod, 'uTrib');
      const quantity = toNum(pick(prod, 'qCom') || pick(prod, 'qTrib'), 0);
      const unitPrice = toNum(pick(prod, 'vUnCom') || pick(prod, 'vUnTrib'), 0);
      const totalValue = toNum(pick(prod, 'vProd'), quantity * unitPrice);

      return {
        sku: sku ? String(sku) : null,
        description: description ? String(description) : null,
        unit: unit ? String(unit) : null,
        quantity,
        unitPrice,
        totalValue,
      };
    })
    .filter(Boolean);

  const entryDraft = {
    documentType: 'NFE',
    documentNumber: documentNumber ? String(documentNumber) : null,
    documentSeries: documentSeries ? String(documentSeries) : null,
    documentKey: documentKey || null,

    issueDate: issueDate || null,
    entryDate: entryDate || null,

    supplierName,
    supplierDocument: supplierDocument || null,

    totalProductsValue: vProd,
    totalDiscountValue: vDesc,
    totalTaxValue: vTotTrib,
    totalExpenseValue: vNF,

    generatesTaxCredit: false,
    fiscalStatus: 'NO_CREDIT',
    status: 'OPEN',

    notes: 'IMPORTADO VIA XML NF-e',
  };

  return { entryDraft, items };
}
