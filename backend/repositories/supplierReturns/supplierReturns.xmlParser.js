// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.xmlParser.js — parser do XML NF-e de entrada     ║
// ║ emitente, destinatário, totais, transporte, cobrança, itens      ║
// ╚══════════════════════════════════════════════════════════════════╝

import {
  toNumber,
  onlyDigits,
  tagContent,
  allTagBlocks,
  firstTagBlock,
  getNfeKey,
  getAttr,
  normalizeUf,
  normalizeDate,
  normalizeCfopForReturn,
} from './supplierReturns.utils.js';

export function findTaxGroup(imposto = '', group = '') {
    const block = firstTagBlock(imposto, group);
    if (!block) return '';

    const specificRe = new RegExp(
        `<(?:\\w+:)?(${group}[A-Za-z0-9]+)\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?\\1>`,
        'i'
    );

    const specific = block.match(specificRe);
    return specific?.[0] || block;
}

export function parseAddress(addressBlock = {}) {
    return {
        street: tagContent(addressBlock, 'xLgr'),
        number: tagContent(addressBlock, 'nro'),
        complement: tagContent(addressBlock, 'xCpl'),
        district: tagContent(addressBlock, 'xBairro'),
        city_code: onlyDigits(tagContent(addressBlock, 'cMun')),
        city: tagContent(addressBlock, 'xMun'),
        uf: normalizeUf(tagContent(addressBlock, 'UF')),
        cep: onlyDigits(tagContent(addressBlock, 'CEP')),
        country_code: onlyDigits(tagContent(addressBlock, 'cPais')),
        country: tagContent(addressBlock, 'xPais'),
        phone: onlyDigits(tagContent(addressBlock, 'fone')),
    };
}

export function parsePerson(block = '', addressTag = '') {
    const address = firstTagBlock(block, addressTag);

    return {
        tax_id: onlyDigits(tagContent(block, 'CNPJ') || tagContent(block, 'CPF')),
        legal_name: tagContent(block, 'xNome'),
        trade_name: tagContent(block, 'xFant') || tagContent(block, 'xNome'),
        ie: tagContent(block, 'IE'),
        im: tagContent(block, 'IM'),
        crt: tagContent(block, 'CRT'),
        cnae: tagContent(block, 'CNAE'),
        email: tagContent(block, 'email'),
        address: parseAddress(address),
    };
}

export function parseTotals(totalBlock = '') {
    return {
        vBC: toNumber(tagContent(totalBlock, 'vBC'), 0),
        vICMS: toNumber(tagContent(totalBlock, 'vICMS'), 0),
        vICMSDeson: toNumber(tagContent(totalBlock, 'vICMSDeson'), 0),
        vFCP: toNumber(tagContent(totalBlock, 'vFCP'), 0),
        vBCST: toNumber(tagContent(totalBlock, 'vBCST'), 0),
        vST: toNumber(tagContent(totalBlock, 'vST'), 0),
        vFCPST: toNumber(tagContent(totalBlock, 'vFCPST'), 0),
        vFCPSTRet: toNumber(tagContent(totalBlock, 'vFCPSTRet'), 0),
        vProd: toNumber(tagContent(totalBlock, 'vProd'), 0),
        vFrete: toNumber(tagContent(totalBlock, 'vFrete'), 0),
        vSeg: toNumber(tagContent(totalBlock, 'vSeg'), 0),
        vDesc: toNumber(tagContent(totalBlock, 'vDesc'), 0),
        vII: toNumber(tagContent(totalBlock, 'vII'), 0),
        vIPI: toNumber(tagContent(totalBlock, 'vIPI'), 0),
        vIPIDevol: toNumber(tagContent(totalBlock, 'vIPIDevol'), 0),
        vPIS: toNumber(tagContent(totalBlock, 'vPIS'), 0),
        vCOFINS: toNumber(tagContent(totalBlock, 'vCOFINS'), 0),
        vOutro: toNumber(tagContent(totalBlock, 'vOutro'), 0),
        vNF: toNumber(tagContent(totalBlock, 'vNF'), 0),
    };
}

export function parseTransport(transpBlock = '') {
    const transporta = firstTagBlock(transpBlock, 'transporta');
    const veicTransp = firstTagBlock(transpBlock, 'veicTransp');
    const volBlocks = allTagBlocks(transpBlock, 'vol');

    return {
        freight_mode: tagContent(transpBlock, 'modFrete'),

        carrier: {
            tax_id: onlyDigits(tagContent(transporta, 'CNPJ') || tagContent(transporta, 'CPF')),
            legal_name: tagContent(transporta, 'xNome'),
            ie: tagContent(transporta, 'IE'),
            address: tagContent(transporta, 'xEnder'),
            city: tagContent(transporta, 'xMun'),
            uf: normalizeUf(tagContent(transporta, 'UF')),
        },

        vehicle: {
            plate: tagContent(veicTransp, 'placa'),
            uf: normalizeUf(tagContent(veicTransp, 'UF')),
            rntc: tagContent(veicTransp, 'RNTC'),
        },

        volumes: volBlocks.map((vol) => ({
            quantity: toNumber(tagContent(vol, 'qVol'), 0),
            species: tagContent(vol, 'esp'),
            brand: tagContent(vol, 'marca'),
            numbering: tagContent(vol, 'nVol'),
            net_weight: toNumber(tagContent(vol, 'pesoL'), 0),
            gross_weight: toNumber(tagContent(vol, 'pesoB'), 0),
        })),
    };
}

export function parseBilling(infNFe = '') {
    const cobr = firstTagBlock(infNFe, 'cobr');
    const fat = firstTagBlock(cobr, 'fat');
    const dupBlocks = allTagBlocks(cobr, 'dup');

    return {
        fatura: {
            number: tagContent(fat, 'nFat'),
            original_value: toNumber(tagContent(fat, 'vOrig'), 0),
            discount_value: toNumber(tagContent(fat, 'vDesc'), 0),
            net_value: toNumber(tagContent(fat, 'vLiq'), 0),
        },

        duplicatas: dupBlocks.map((dup, index) => ({
            number: tagContent(dup, 'nDup') || String(index + 1).padStart(3, '0'),
            due_date: tagContent(dup, 'dVenc'),
            value: toNumber(tagContent(dup, 'vDup'), 0),
        })),
    };
}

export function parsePayments(infNFe = '') {
    const pag = firstTagBlock(infNFe, 'pag');
    const detPagBlocks = allTagBlocks(pag, 'detPag');

    return detPagBlocks.map((detPag) => {
        const card = firstTagBlock(detPag, 'card');

        return {
            tPag: tagContent(detPag, 'tPag'),
            vPag: toNumber(tagContent(detPag, 'vPag'), 0),
            indPag: tagContent(detPag, 'indPag'),
            xPag: tagContent(detPag, 'xPag'),
            card: {
                tpIntegra: tagContent(card, 'tpIntegra'),
                cnpj: onlyDigits(tagContent(card, 'CNPJ')),
                tBand: tagContent(card, 'tBand'),
                cAut: tagContent(card, 'cAut'),
            },
        };
    });
}

export function parseAdditionalInfo(infNFe = '') {
    const infAdic = firstTagBlock(infNFe, 'infAdic');

    return {
        infAdFisco: tagContent(infAdic, 'infAdFisco'),
        infCpl: tagContent(infAdic, 'infCpl'),
    };
}

export function parseReferences(infNFe = '') {
    return allTagBlocks(infNFe, 'NFref').map((ref) => ({
        refNFe: tagContent(ref, 'refNFe'),
        refCTe: tagContent(ref, 'refCTe'),
        refNFP: tagContent(ref, 'refNFP'),
        refECF: tagContent(ref, 'refECF'),
    }));
}

export function parseItemTaxes(imposto = '') {
    const icms = findTaxGroup(imposto, 'ICMS');
    const ipi = firstTagBlock(imposto, 'IPI');
    const pis = findTaxGroup(imposto, 'PIS');
    const cofins = findTaxGroup(imposto, 'COFINS');

    return {
        icms: {
            orig: tagContent(icms, 'orig'),
            CST: tagContent(icms, 'CST'),
            CSOSN: tagContent(icms, 'CSOSN'),
            modBC: tagContent(icms, 'modBC'),
            vBC: toNumber(tagContent(icms, 'vBC'), 0),
            pRedBC: toNumber(tagContent(icms, 'pRedBC'), 0),
            pICMS: toNumber(tagContent(icms, 'pICMS'), 0),
            vICMS: toNumber(tagContent(icms, 'vICMS'), 0),
            modBCST: tagContent(icms, 'modBCST'),
            pMVAST: toNumber(tagContent(icms, 'pMVAST'), 0),
            pRedBCST: toNumber(tagContent(icms, 'pRedBCST'), 0),
            vBCST: toNumber(tagContent(icms, 'vBCST'), 0),
            pICMSST: toNumber(tagContent(icms, 'pICMSST'), 0),
            vICMSST: toNumber(tagContent(icms, 'vICMSST'), 0),
            vFCP: toNumber(tagContent(icms, 'vFCP'), 0),
            pFCP: toNumber(tagContent(icms, 'pFCP'), 0),
            vFCPST: toNumber(tagContent(icms, 'vFCPST'), 0),
            pFCPST: toNumber(tagContent(icms, 'pFCPST'), 0),
        },

        ipi: {
            cEnq: tagContent(ipi, 'cEnq'),
            CST: tagContent(ipi, 'CST'),
            vBC: toNumber(tagContent(ipi, 'vBC'), 0),
            pIPI: toNumber(tagContent(ipi, 'pIPI'), 0),
            vIPI: toNumber(tagContent(ipi, 'vIPI'), 0),
        },

        pis: {
            CST: tagContent(pis, 'CST'),
            vBC: toNumber(tagContent(pis, 'vBC'), 0),
            pPIS: toNumber(tagContent(pis, 'pPIS'), 0),
            vPIS: toNumber(tagContent(pis, 'vPIS'), 0),
        },

        cofins: {
            CST: tagContent(cofins, 'CST'),
            vBC: toNumber(tagContent(cofins, 'vBC'), 0),
            pCOFINS: toNumber(tagContent(cofins, 'pCOFINS'), 0),
            vCOFINS: toNumber(tagContent(cofins, 'vCOFINS'), 0),
        },
    };
}

export function parseInboundNfeXml(xmlText, { emitUf = 'MG' } = {}) {
    const xml = String(xmlText || '');
    const infNFe = firstTagBlock(xml, 'infNFe') || xml;

    const ide = firstTagBlock(infNFe, 'ide');
    const emit = firstTagBlock(infNFe, 'emit');
    const dest = firstTagBlock(infNFe, 'dest');
    const total = firstTagBlock(infNFe, 'ICMSTot');
    const transp = firstTagBlock(infNFe, 'transp');

    const supplier = parsePerson(emit, 'enderEmit');
    const destination = parsePerson(dest, 'enderDest');
    const totals = parseTotals(total);
    const transport = parseTransport(transp);
    const billing = parseBilling(infNFe);
    const payments = parsePayments(infNFe);
    const additional_info = parseAdditionalInfo(infNFe);
    const references = parseReferences(infNFe);

    const header = {
        original_nfe_key: getNfeKey(xml),
        original_document_number: tagContent(ide, 'nNF'),
        original_series: tagContent(ide, 'serie'),
        original_issue_date: normalizeDate(tagContent(ide, 'dhEmi') || tagContent(ide, 'dEmi')),
        original_nat_op: tagContent(ide, 'natOp'),
        original_model: tagContent(ide, 'mod'),
        original_tp_nf: tagContent(ide, 'tpNF'),
        original_fin_nfe: tagContent(ide, 'finNFe'),
        original_ind_final: tagContent(ide, 'indFinal'),
        original_ind_pres: tagContent(ide, 'indPres'),
        original_id: getAttr(infNFe, 'Id'),

        supplier,
        destination,
        totals,
        transport,
        billing,
        payments,
        additional_info,
        references,

        original_total_value: totals.vNF,
        original_products_value: totals.vProd,

        customer_from_xml: {
            tax_id: destination.tax_id,
            legal_name: destination.legal_name,
            ie: destination.ie,
            city: destination.address?.city,
            uf: destination.address?.uf,
            address: destination.address,
        },
    };

    const dets = allTagBlocks(infNFe, 'det');

    const items = dets.map((detBlock, index) => {
        const prod = firstTagBlock(detBlock, 'prod');
        const imposto = firstTagBlock(detBlock, 'imposto');
        const taxes = parseItemTaxes(imposto);

        const cProd = tagContent(prod, 'cProd');
        const cEAN = tagContent(prod, 'cEAN');
        const xProd = tagContent(prod, 'xProd');
        const qCom = toNumber(tagContent(prod, 'qCom'), 0);
        const vUnCom = toNumber(tagContent(prod, 'vUnCom'), 0);
        const vProd = toNumber(tagContent(prod, 'vProd'), qCom * vUnCom);
        const cfopEntrada = tagContent(prod, 'CFOP');

        return {
            xml_item_no: Number(getAttr(detBlock, 'nItem')) || Number(tagContent(detBlock, 'nItem')) || index + 1,

            product_id: null,
            product_code: cProd,
            xml_product_code: cProd,
            barcode: cEAN,
            barcode_trib: tagContent(prod, 'cEANTrib'),

            description: xProd,

            quantity_original: qCom,
            quantity_return: qCom,

            unit: tagContent(prod, 'uCom') || 'UN',
            unit_trib: tagContent(prod, 'uTrib') || tagContent(prod, 'uCom') || 'UN',

            quantity_trib: toNumber(tagContent(prod, 'qTrib'), qCom),
            unit_value: vUnCom,
            unit_value_trib: toNumber(tagContent(prod, 'vUnTrib'), vUnCom),

            total_value_original: vProd,
            total_value_return: vProd,

            discount_value: toNumber(tagContent(prod, 'vDesc'), 0),
            freight_value: toNumber(tagContent(prod, 'vFrete'), 0),
            insurance_value: toNumber(tagContent(prod, 'vSeg'), 0),
            other_value: toNumber(tagContent(prod, 'vOutro'), 0),

            cfop_inbound: cfopEntrada,
            cfop: normalizeCfopForReturn(cfopEntrada, supplier?.address?.uf, emitUf),

            ncm: onlyDigits(tagContent(prod, 'NCM')).slice(0, 8),
            cest: onlyDigits(tagContent(prod, 'CEST')).slice(0, 10),
            extipi: tagContent(prod, 'EXTIPI'),
            cbenef: tagContent(prod, 'cBenef'),

            xped: tagContent(prod, 'xPed'),
            nitemped: tagContent(prod, 'nItemPed'),

            cst_icms: taxes.icms.CST || taxes.icms.CSOSN,
            cst_pis: taxes.pis.CST,
            cst_cofins: taxes.cofins.CST,

            taxes,

            selected: true,
            product_found: false,
        };
    });

    if (!header.original_nfe_key || header.original_nfe_key.length !== 44) {
        throw new Error('Não foi possível localizar a chave de 44 dígitos da NF-e no XML importado.');
    }

    if (!items.length) {
        throw new Error('Nenhum item foi localizado no XML da NF-e importada.');
    }

    return { header, items };
}
