// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeSupplierReturn.repository.js — NF-e de devolução        ║
// ║ ✔ emitirNFeSupplierReturn (a partir do draft)                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  round2,
  round4,
  onlyDigits,
  getEmpresaConfig,
} from '../nfe/nfe.utils.js';
import {
  sanitizeCpfCnpj,
  splitPhone,
} from '../nfe/nfe.sanitizers.js';
import {
  buildReformaTributariaFromFiscal,
  buildReformaTotals,
} from '../nfe/nfe.reformaTributaria.js';
import {
  getNextNfeNumberFromBasicTable,
} from '../nfe/nfeNumbering.repository.js';
import {
  loadFiscalBySku,
} from '../nfe/nfeProducts.repository.js';
import {
  emitirNFe,
} from './tecnoSpeedNfeEmit.repository.js';

export async function emitirNFeSupplierReturn(draft = {}) {
  const supplierReturn = draft.supplier_return || {};
  const items = Array.isArray(draft.items) ? draft.items : [];
  const empresa = getEmpresaConfig();

  if (!supplierReturn.original_nfe_key || String(supplierReturn.original_nfe_key).length !== 44) {
    throw new Error('[NFE DEVOLUÇÃO] Chave da NF-e original inválida.');
  }

  if (!items.length) {
    throw new Error('[NFE DEVOLUÇÃO] Nenhum item informado para devolução.');
  }

  /*
   * IBS/CBS vem da Classificação Fiscal V2 do produto do ERP, igual à
   * emissão de venda. Itens sem produto vinculado não têm essa origem.
   */
  const fiscalBySku = await loadFiscalBySku(
    items.filter((item) => item.product_id).map((item) => item.product_code),
  );

  const itemsWithoutFiscal = items.filter(
    (item) => !fiscalBySku[String(item.product_code || '').trim()],
  );

  if (itemsWithoutFiscal.length) {
    throw new Error(
      '[NFE DEVOLUÇÃO] Itens sem produto do ERP com classificação fiscal V2 ativa: ' +
      itemsWithoutFiscal
        .map((item) => `${item.xml_item_no || '?'} - ${item.product_code || ''} ${item.description || ''}`.trim())
        .join('; ') +
      '. Cadastre o código de barras do item em um produto e reimporte o XML.',
    );
  }

  const numero = await getNextNfeNumberFromBasicTable();

  const roundTax = (v) => round2(Number(v || 0));

  const pick = (...values) => {
    for (const v of values) {
      if (v !== null && v !== undefined && String(v).trim() !== '') return v;
    }
    return '';
  };

  const supplierJson =
    supplierReturn.supplier_json ||
    draft.destinatario?.supplier_json ||
    {};

  const supplierAddress =
    supplierJson.address ||
    draft.destinatario?.address ||
    {};

  const supplierIE = onlyDigits(
    supplierReturn.supplier_ie ||
    supplierReturn.ie ||
    supplierJson.ie ||
    ''
  );

  const supplierCity = pick(
    supplierAddress.city,
    supplierAddress.xMun,
    supplierReturn.supplier_city,
    draft.destinatario?.city,
    'BELO HORIZONTE'
  );

  const supplierUf = pick(
    supplierAddress.uf,
    supplierAddress.UF,
    supplierReturn.supplier_uf,
    draft.destinatario?.uf,
    'MG'
  ).toUpperCase();

  const supplierCep = onlyDigits(
    pick(
      supplierAddress.cep,
      supplierAddress.CEP,
      supplierAddress.postal_code,
      '30170012'
    )
  );

  const supplierCityCode = onlyDigits(
    pick(
      supplierAddress.city_code,
      supplierAddress.cMun,
      supplierAddress.codigoCidade,
      '3106200'
    )
  );

  const totalFrete = round2(
    Number(
      supplierReturn.totals_json?.vFrete ??
      draft.total?.valorFrete ??
      0
    )
  );

  const buildItemTributos = (item = {}) => {
    const snapshot = item.xml_snapshot || {};
    const taxes = item.taxes || item.taxes_json || snapshot.taxes || {};

    const originalQty = Number(
      snapshot.quantity_original ||
      snapshot.quantity_return ||
      item.quantity ||
      0
    );

    const returnQty = Number(item.quantity || 0);

    const ratio =
      originalQty > 0 && returnQty > 0
        ? returnQty / originalQty
        : 1;

    const proportional = (v) => round2(Number(v || 0) * ratio);

    const icms = taxes.icms || {};
    const pis = taxes.pis || {};
    const cofins = taxes.cofins || {};
    const ipi = taxes.ipi || {};

    const cstIcms = String(
      item.cst_icms ||
      icms.CST ||
      icms.cst ||
      icms.CSOSN ||
      '00'
    );

    const cstExigeCest = [
      '10',
      '30',
      '60',
      '70',
    ].includes(cstIcms);

    const cest = onlyDigits(item.cest || snapshot.cest || '');

    if (cstExigeCest && cest.length !== 7) {
      throw new Error(
        `[NFE DEVOLUÇÃO] Produto ${item.product_code || item.xml_item_no}: ` +
        `CEST obrigatório para o CST ${cstIcms}.`
      );
    }

    const cstPis = String(
      item.cst_pis ||
      pis.CST ||
      pis.cst ||
      '49'
    );

    const cstCofins = String(
      item.cst_cofins ||
      cofins.CST ||
      cofins.cst ||
      '49'
    );

    const tributos = {
      icms: {
        origem: String(icms.orig || icms.origem || '0'),
        cst: cstIcms,
        baseCalculo: {
          modalidadeDeterminacao: Number(icms.modBC || icms.modalidadeDeterminacao || 0),
          valor: proportional(icms.vBC ?? icms.baseCalculo?.valor ?? 0),
          ...(cstIcms === '20'
            ? {
              percentualReducao: roundTax(
                icms.pRedBC ??
                icms.baseCalculo?.percentualReducao ??
                0
              ),
            }
            : {}),
        },
        aliquota: roundTax(icms.pICMS ?? icms.aliquota ?? 0),
        valor: proportional(icms.vICMS ?? icms.valor ?? 0),
      },

      pis: {
        cst: cstPis,
        baseCalculo: {
          valor: proportional(pis.vBC ?? pis.baseCalculo?.valor ?? 0),
        },
        aliquota: roundTax(pis.pPIS ?? pis.aliquota ?? 0),
        valor: proportional(pis.vPIS ?? pis.valor ?? 0),
      },

      cofins: {
        cst: cstCofins,
        baseCalculo: {
          valor: proportional(cofins.vBC ?? cofins.baseCalculo?.valor ?? 0),
        },
        aliquota: roundTax(cofins.pCOFINS ?? cofins.aliquota ?? 0),
        valor: proportional(cofins.vCOFINS ?? cofins.valor ?? 0),
      },

      ...buildReformaTributariaFromFiscal(
        fiscalBySku[String(item.product_code || '').trim()],
        round2(item.total_value || returnQty * Number(item.unit_value || 0)),
        returnQty,
      ),
    };

    /*
     * O grupo IPI do XML do fornecedor não é repassado: a BH3 não é
     * contribuinte de IPI e a PlugNotas responde HTTP 500 quando ele é
     * enviado (testado em homologação em 24/09/2026). O IPI destacado
     * na compra, quando devolvido, pertence a impostoDevol/vIPIDevol.
     */
    return tributos;
  };

  const nfe = {
    idIntegracao: `SUPRET-${supplierReturn.return_id}-${Date.now()}`,
    numero,
    presencial: '1',
    serie: Number(process.env.NFE_SERIE || 1),

    natureza: 'DEVOLUCAO DE COMPRA',
    finalidade: '4',
    saida: true,
    // Fornecedor com IE é contribuinte, não consumidor final.
    consumidorFinal: !supplierIE,
    // Local de consumo do IBS/CBS = município do destinatário, como na venda.
    codigoMunicipioFatoGeradorIbs: supplierCityCode,

    documentosReferenciados: [
      {
        modelo: '55',
        chave: supplierReturn.original_nfe_key,
      },
    ],

    emitente: {
      cpfCnpj: sanitizeCpfCnpj(empresa.EMPRESA_CNPJ),
      razaoSocial: empresa.EMPRESA_RAZAO,
      nomeFantasia: empresa.EMPRESA_FANTASIA,
    },

    destinatario: {
      cpfCnpj: sanitizeCpfCnpj(
        supplierReturn.supplier_document ||
        supplierJson.tax_id
      ),

      razaoSocial: String(
        supplierJson.legal_name ||
        supplierReturn.supplier_legal_name ||
        supplierReturn.supplier_name ||
        supplierJson.trade_name ||
        'FORNECEDOR'
      )
        .trim()
        .toUpperCase(),

      indicadorIEDestinatario: supplierIE ? '1' : '9',

      ...(supplierIE ? { inscricaoEstadual: supplierIE } : {}),

      endereco: {
        logradouro: String(
          pick(
            supplierAddress.street,
            supplierAddress.xLgr,
            supplierAddress.logradouro,
            'NAO INFORMADO'
          )
        ).toUpperCase(),

        numero: String(
          pick(
            supplierAddress.number,
            supplierAddress.nro,
            supplierAddress.numero,
            '0'
          )
        ).toUpperCase(),

        ...(pick(supplierAddress.complement, supplierAddress.xCpl)
          ? {
            complemento: String(
              pick(supplierAddress.complement, supplierAddress.xCpl)
            ).toUpperCase(),
          }
          : {}),

        bairro: String(
          pick(
            supplierAddress.district,
            supplierAddress.xBairro,
            supplierAddress.bairro,
            'NAO INFORMADO'
          )
        ).toUpperCase(),

        codigoCidade: supplierCityCode || '3106200',
        descricaoCidade: String(supplierCity || 'BELO HORIZONTE').toUpperCase(),
        estado: supplierUf || 'MG',
        cep: supplierCep || '30170012',
        codigoPais: String(pick(supplierAddress.country_code, supplierAddress.cPais, '1058')),
        descricaoPais: String(pick(supplierAddress.country, supplierAddress.xPais, 'Brasil')),
      },
    },

    transporte: {
      modalidadeFrete: String(
        supplierReturn.transport_json?.freight_mode ||
        draft.transport?.freight_mode ||
        '9'
      ),
    },

    total: {
      valorFrete: totalFrete,
    },

    pagamentos: [
      {
        aVista: true,
        meio: '90',
        valor: 0,
      },
    ],

    informacoesComplementares: [
      `NF-e de devolução referente à chave ${supplierReturn.original_nfe_key}.`,
      supplierReturn.return_reason ? `Motivo: ${supplierReturn.return_reason}` : '',
    ].filter(Boolean).join(' '),

    itens: items.map((item, index) => {
      const snapshot = item.xml_snapshot || {};

      const qtd = round4(item.quantity || 0);
      const vUnit = round4(item.unit_value || snapshot.unit_value || 0);
      const vProd = round2(item.total_value || qtd * vUnit);

      const originalQty = Number(
        snapshot.quantity_original ||
        snapshot.quantity_return ||
        qtd ||
        0
      );

      const originalTribQty = Number(
        snapshot.quantity_trib ||
        snapshot.quantity_original ||
        originalQty ||
        0
      );

      const ratio =
        originalQty > 0 && qtd > 0
          ? qtd / originalQty
          : 1;

      const qtdTrib = round4(originalTribQty * ratio);

      const unitCom = String(
        item.unit ||
        snapshot.unit ||
        'UN'
      ).toUpperCase();

      const unitTrib = String(
        snapshot.unit_trib ||
        item.unit ||
        unitCom
      ).toUpperCase();

      return {
        codigo: String(item.product_code || item.product_id || index + 1),
        descricao: String(item.description || 'PRODUTO DEVOLVIDO').toUpperCase(),
        ncm: onlyDigits(item.ncm || snapshot.ncm || '').slice(0, 8),
        ...(item.cest || snapshot.cest
          ? { cest: onlyDigits(item.cest || snapshot.cest).slice(0, 10) }
          : {}),

        cfop: String(item.cfop || '5202'),

        // Obrigatório na devolução (rejeição 321): item da NF-e original.
        dfeReferenciado: {
          chaveAcesso: supplierReturn.original_nfe_key,
          numero: Number(item.xml_item_no || index + 1),
        },

        unidade: {
          comercial: unitCom,
          tributavel: unitTrib,
        },

        quantidade: {
          comercial: qtd,
          tributavel: qtdTrib || qtd,
        },

        valorUnitario: {
          comercial: vUnit,
          tributavel: round4(snapshot.unit_value_trib || vUnit),
        },

        valor: vProd,
        valorTotal: vProd,
        compoeTotal: true,

        ...(snapshot.discount_value
          ? { valorDesconto: round2(Number(snapshot.discount_value || 0) * ratio) }
          : {}),

        tributos: buildItemTributos(item),
      };
    }),

    responsavelTecnico: {
      cpfCnpj: sanitizeCpfCnpj(empresa.RESPONSAVEL_CNPJ),
      nome: empresa.RESPONSAVEL_NOME,
      email: empresa.RESPONSAVEL_EMAIL,
      ...(splitPhone(empresa.RESPONSAVEL_TELEFONE)
        ? { telefone: splitPhone(empresa.RESPONSAVEL_TELEFONE) }
        : {}),
    },
  };

  nfe.total = buildReformaTotals(
    nfe,
    nfe.itens.reduce((acc, it) => acc + Number(it.valorTotal || 0), 0) + totalFrete,
  );

  console.log('[NFE DEVOLUÇÃO][SUPPLIER ADDRESS USED]', JSON.stringify(supplierAddress, null, 2));
  console.log('[NFE DEVOLUÇÃO][PAYLOAD]', JSON.stringify(nfe, null, 2));

  const result = await emitirNFe(nfe);

  console.log(
    '[NFE DEVOLUÇÃO][EMITIR NFE RESULT]',
    JSON.stringify(result, null, 2)
  );

  return result;
}
