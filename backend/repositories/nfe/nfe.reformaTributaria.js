// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfe.reformaTributaria.js — Reforma Tributária (IBS/CBS)              ║
// ║ ✔ Monta grupos IBS/CBS por item e totais                             ║
// ║ ✔ Normaliza IBS/CBS antes do envio                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  round2,
  round4,
  onlyDigits,
} from './nfe.utils.js';

/* =========================================================================
 * Reforma Tributária — grupos IS e IBS/CBS (PlugNotas)
 * ========================================================================= */
export function buildReformaTributariaFromFiscal(
  fiscal = {},
  baseCalculo = 0,
  quantidade = 0,
) {
  const ibscbsCst = onlyDigits(fiscal.ibscbs_cst);
  const ibscbsClassification = onlyDigits(
    fiscal.ibscbs_classification,
  );

  if (ibscbsCst.length !== 3) {
    throw new Error(
      '[NFE] CST IBS/CBS ausente ou inválido na Classificação Fiscal V2.',
    );
  }

  if (ibscbsClassification.length !== 6) {
    throw new Error(
      '[NFE] Classificação IBS/CBS ausente ou inválida na Classificação Fiscal V2.',
    );
  }

  if (ibscbsClassification === '000000') {
    throw new Error(
      '[NFE] Classificação IBS/CBS 000000 não existe. Configure um cClassTrib válido na Classificação Fiscal V2.',
    );
  }

  if (!ibscbsClassification.startsWith(ibscbsCst)) {
    throw new Error(
      `[NFE] Classificação IBS/CBS ${ibscbsClassification} incompatível com o CST ${ibscbsCst}.`,
    );
  }

  const base = round2(baseCalculo);
  const qtd = round4(quantidade);
  const isRate = round4(fiscal.is_rate ?? 0);
  const isSpecificRate = Number(fiscal.is_specific_rate ?? 0);
  const ibsUfRate = round4(fiscal.ibs_uf_rate ?? 0);
  const ibsMunicipalRate = round4(fiscal.ibs_municipal_rate ?? 0);
  const cbsRate = round4(fiscal.cbs_rate ?? 0);

  const details =
    fiscal.tax_reform_details &&
      typeof fiscal.tax_reform_details === 'object' &&
      !Array.isArray(fiscal.tax_reform_details)
      ? fiscal.tax_reform_details
      : {};
  const detailsIs = details.is || {};
  const detailsIbsCbs = details.ibscbs || {};
  const detailsIbsUf = detailsIbsCbs.uf || {};
  const detailsIbsMunicipio = detailsIbsCbs.municipio || {};
  const detailsCbs = detailsIbsCbs.cbs || {};
  const {
    reducao: _ignoredIbsUfReduction,
    ...detailsIbsUfWithoutReduction
  } = detailsIbsUf;
  const {
    reducao: _ignoredIbsMunicipalReduction,
    ...detailsIbsMunicipioWithoutReduction
  } = detailsIbsMunicipio;
  const {
    reducao: _ignoredCbsReduction,
    ...detailsCbsWithoutReduction
  } = detailsCbs;

  /*
   * O CST 200 exige o grupo de reducao quando o cClassTrib possuir esse
   * indicador. O cadastro pode fornecer os percentuais por colunas proprias
   * ou por tax_reform_details. Para o cClassTrib 200035, a tabela oficial
   * determina reducao de 60% para IBS e CBS; o fallback abaixo mantem as
   * emissoes corretas enquanto os novos campos nao existirem no cadastro.
   */
  const reductionByClassification = {
    '200035': { ibsUf: 60, ibsMunicipio: 60, cbs: 60 },
  };
  const classificationReduction =
    reductionByClassification[ibscbsClassification] || {};

  const readReductionRate = (...values) => {
    const raw = values.find(
      (value) => value !== undefined && value !== null && value !== '',
    );
    const rate = round4(raw ?? 0);

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error(
        `[NFE] Percentual de reducao IBS/CBS invalido: ${raw}. Informe um valor entre 0 e 100.`,
      );
    }

    return rate;
  };

  const ibsUfReductionRate = readReductionRate(
    fiscal.ibs_uf_reduction_rate,
    fiscal.ibs_uf_reduction,
    detailsIbsUf.reducao?.aliquota,
    classificationReduction.ibsUf,
  );
  const ibsMunicipalReductionRate = readReductionRate(
    fiscal.ibs_municipal_reduction_rate,
    fiscal.ibs_municipal_reduction,
    detailsIbsMunicipio.reducao?.aliquota,
    classificationReduction.ibsMunicipio,
  );
  const cbsReductionRate = readReductionRate(
    fiscal.cbs_reduction_rate,
    fiscal.cbs_reduction,
    detailsCbs.reducao?.aliquota,
    classificationReduction.cbs,
  );

  const effectiveRate = (nominalRate, reductionRate) =>
    round4(nominalRate * (1 - reductionRate / 100));

  const ibsUfEffectiveRate = effectiveRate(
    ibsUfRate,
    ibsUfReductionRate,
  );
  const ibsMunicipalEffectiveRate = effectiveRate(
    ibsMunicipalRate,
    ibsMunicipalReductionRate,
  );
  const cbsEffectiveRate = effectiveRate(cbsRate, cbsReductionRate);

  const isValue = round2(
    (base * isRate) / 100 + (qtd * isSpecificRate),
  );
  const ibsUfValue = round2((base * ibsUfEffectiveRate) / 100);
  const ibsMunicipalValue = round2(
    (base * ibsMunicipalEffectiveRate) / 100,
  );
  const cbsValue = round2((base * cbsEffectiveRate) / 100);
  const {
    indicadorDoacao: _ignoredDonationIndicator,
    ...detailsIbsCbsWithoutDonation
  } = detailsIbsCbs;

  const donationClassifications = new Set(['410003', '410026']);
  const mustSendDonationIndicator = donationClassifications.has(
    ibscbsClassification,
  );

  const isCst = onlyDigits(detailsIs.cst ?? fiscal.is_cst);
  const isClassification = onlyDigits(
    detailsIs.classificacao ?? fiscal.is_classification,
  );
  const hasValidIs =
    isCst.length === 3 &&
    isClassification.length === 6 &&
    isClassification !== '000000';

  return {
    ...(hasValidIs
      ? {
        is: {
          ...detailsIs,
          cst: isCst,
          classificacao: isClassification,
          baseCalculo: base,
          aliquota: isRate,
          aliquotaEspecifica: isSpecificRate,
          unidade: String(fiscal.is_unit || 'UN').toUpperCase(),
          quantidade: qtd,
          valor: isValue,
        },
      }
      : {}),
    ibscbs: {
      ...detailsIbsCbsWithoutDonation,
      cst: ibscbsCst,
      classificacao: ibscbsClassification,
      baseCalculo: base,
      valorIbs: round2(ibsUfValue + ibsMunicipalValue),
      ...(mustSendDonationIndicator
        ? {
          indicadorDoacao: Number(fiscal.donation_indicator ?? 1),
        }
        : {}),
      uf: {
        ...detailsIbsUfWithoutReduction,
        aliquota: ibsUfRate,
        ...(ibsUfReductionRate > 0 && ibsUfRate > 0
          ? {
            reducao: {
              aliquota: ibsUfReductionRate,
              aliquotaEfetiva: ibsUfEffectiveRate,
            },
          }
          : {}),
        valor: ibsUfValue,
      },
      municipio: {
        ...detailsIbsMunicipioWithoutReduction,
        aliquota: ibsMunicipalRate,
        ...(ibsMunicipalReductionRate > 0
          ? {
            reducao: {
              aliquota: ibsMunicipalReductionRate,
              aliquotaEfetiva: ibsMunicipalEffectiveRate,
            },
          }
          : {}),
        valor: ibsMunicipalValue,
      },
      cbs: {
        ...detailsCbsWithoutReduction,
        aliquota: cbsRate,
        ...(cbsReductionRate > 0 && cbsRate > 0
          ? {
            reducao: {
              aliquota: cbsReductionRate,
              aliquotaEfetiva: cbsEffectiveRate,
            },
          }
          : {}),
        valor: cbsValue,
      },
    },
  };
}

/*
 * Totalizadores RTC obrigatórios quando os itens possuem IBS/CBS.
 * A PlugNotas não calcula o IBSCBSTot: sem estes campos a SEFAZ rejeita
 * com 1119 ("Total de IBS e CBS não informado").
 */
export function buildReformaTotals(nfe = {}, valorNota = 0) {
  const reformaTotals = (Array.isArray(nfe.itens) ? nfe.itens : []).reduce(
    (acc, item) => {
      const ibscbs = item?.tributos?.ibscbs || {};
      const impostoSeletivo = item?.tributos?.is || {};

      acc.baseCalculoIbsCbs += Number(ibscbs.baseCalculo || 0);
      acc.valorIbsUF += Number(ibscbs.uf?.valor || 0);
      acc.valorIbsMunicipio += Number(ibscbs.municipio?.valor || 0);
      acc.valorIbs += Number(ibscbs.valorIbs || 0);
      acc.valorCbs += Number(ibscbs.cbs?.valor || 0);
      acc.valorIs += Number(impostoSeletivo.valor || 0);

      return acc;
    },
    {
      baseCalculoIbsCbs: 0,
      valorIbsUF: 0,
      valorIbsMunicipio: 0,
      valorIbs: 0,
      valorCbs: 0,
      valorIs: 0,
    },
  );

  for (const key of Object.keys(reformaTotals)) {
    reformaTotals[key] = round2(reformaTotals[key]);
  }

  return {
    ...(nfe.total || {}),

    // Base total IBS/CBS
    baseCalculoIbsCbs: reformaTotals.baseCalculoIbsCbs,

    // IBS estadual
    valorDiferimentoIbsUF: 0,
    valorDevolucaoIbsUF: 0,
    valorIbsUF: reformaTotals.valorIbsUF,

    // IBS municipal
    valorDiferimentoIbsMunicipio: 0,
    valorDevolucaoIbsMunicipio: 0,
    valorIbsMunicipio: reformaTotals.valorIbsMunicipio,

    // Total IBS
    valorIbs: reformaTotals.valorIbs,
    valorIbsCreditoPresumindo: 0,
    valorIbsCreditoPresumidoSupensao: 0,

    // Total CBS
    valorCbsDiferimento: 0,
    valorCbsDevolucao: 0,
    valorCbs: reformaTotals.valorCbs,
    valorCbsCreditoPresumido: 0,
    valorCbsCreditoPresumidoSupensao: 0,

    /*
     * Em 2026, IBS e CBS não devem ser acrescentados ao valor cobrado
     * do cliente. vNFTot deve coincidir com a soma dos vItem.
     */
    valorIbsCbsIs: round2(valorNota),
  };
}

export function normalizarIbscbsAntesDoEnvio(documento = {}) {
  return {
    ...documento,
    itens: (Array.isArray(documento.itens) ? documento.itens : []).map((item) => {
      const ibscbs = item?.tributos?.ibscbs;

      if (!ibscbs) return item;

      const cst = onlyDigits(ibscbs.cst).padStart(3, '0').slice(-3);
      const classificacao = onlyDigits(ibscbs.classificacao)
        .padStart(6, '0')
        .slice(-6);

      return {
        ...item,
        tributos: {
          ...item.tributos,
          ibscbs: {
            ...ibscbs,
            cst,
            classificacao,
          },
        },
      };
    }),
  };
}
