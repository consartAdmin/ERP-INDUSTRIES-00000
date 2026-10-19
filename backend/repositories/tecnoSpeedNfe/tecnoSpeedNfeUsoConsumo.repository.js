// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeUsoConsumo.repository.js — NF-e de Uso e Consumo        ║
// ║ ✔ emitirNFeUsoConsumo                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  getAmbiente,
  NFE_DEBUG,
} from './tecnoSpeedNfeClient.repository.js';
import {
  round2,
  round4,
  onlyDigits,
  getEmpresaConfig,
} from '../nfe/nfe.utils.js';
import {
  sanitizeCpfCnpj,
  splitPhone,
  montarLogradouroNfe,
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

/* =========================================================================
 * 🧾 Emitir NF-e de Uso e Consumo
 * ========================================================================= */
export async function emitirNFeUsoConsumo(
  usoConsumoId,
  options = {}
) {
  const id = Number(usoConsumoId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('[NFE USO E CONSUMO] usoConsumoId inválido.');
  }

  const retry = options.retry === true;
  const requestedNfeNumber = Number(options.nfeNumber);
  const requestedIntegrationId = String(
    options.idIntegracao || ''
  ).trim();

  const empresa = getEmpresaConfig();

  /*
   * Carrega o cabeçalho e verifica se já existe uma NF-e vinculada.
   */
  const headerResult = await pool.query(
    `
      SELECT
        uc.*,
        ii.nfe_number,
        ii.nfe_key,
        ii.nfe_status,
        ii.nfe_protocol
      FROM public."usoConsumo" uc
      LEFT JOIN public."invoicesIssued" ii
        ON ii.invoice_id = uc.invoice_id
      WHERE uc.uso_consumo_id = $1
      LIMIT 1
    `,
    [id]
  );

  const usoConsumo = headerResult.rows[0];

  if (!usoConsumo) {
    throw new Error(
      `[NFE USO E CONSUMO] Registro ${id} não encontrado.`
    );
  }

  if (usoConsumo.invoice_id && !retry) {
    throw new Error(
      `[NFE USO E CONSUMO] Este registro já possui uma NF-e vinculada. ` +
      `NF-e: ${usoConsumo.nfe_number || 'em processamento'}; ` +
      `status: ${usoConsumo.nfe_status || 'PENDENTE'}.`
    );
  }

  if (retry) {
    if (!usoConsumo.invoice_id) {
      throw new Error(
        '[NFE USO E CONSUMO] Não existe NF-e vinculada para reenvio.'
      );
    }

    if (
      String(usoConsumo.nfe_status || '').toUpperCase() !== 'REJEITADA'
    ) {
      throw new Error(
        '[NFE USO E CONSUMO] Somente uma NF-e rejeitada pode ser reenviada.'
      );
    }

    if (
      !Number.isInteger(requestedNfeNumber) ||
      requestedNfeNumber <= 0
    ) {
      throw new Error(
        '[NFE USO E CONSUMO] Número da NF-e inválido para reenvio.'
      );
    }

    if (!requestedIntegrationId) {
      throw new Error(
        '[NFE USO E CONSUMO] Novo idIntegracao é obrigatório para reenvio.'
      );
    }
  }

  if (String(usoConsumo.status || '').toUpperCase() !== 'FINALIZADO') {
    throw new Error(
      '[NFE USO E CONSUMO] Somente registros finalizados podem emitir NF-e.'
    );
  }

  const itemsResult = await pool.query(
    `
      SELECT uci.*
      FROM public."usoConsumoItems" uci
      WHERE uci.uso_consumo_id = $1
      ORDER BY uci.uso_consumo_item_id ASC
    `,
    [id]
  );

  if (!itemsResult.rows.length) {
    throw new Error(
      '[NFE USO E CONSUMO] O registro não possui itens.'
    );
  }

  /*
   * Cadastro fiscal V2: "productsFiscalV2" -> "fiscalClassificationV2"
   * -> "fiscalProfileV2", igual à emissão de venda.
   */
  const fiscalBySku = await loadFiscalBySku(
    itemsResult.rows.map((item) => item.product_code),
  );

  const items = itemsResult.rows.map((item) => ({
    ...item,
    fiscal: fiscalBySku[String(item.product_code || '').trim()] || null,
  }));

  const itemsWithoutFiscal = items.filter((item) => !item.fiscal);

  if (itemsWithoutFiscal.length) {
    throw new Error(
      '[NFE USO E CONSUMO] Produtos sem classificação fiscal V2 ativa: ' +
      itemsWithoutFiscal
        .map((item) => `${item.product_code || '?'} ${item.description || ''}`.trim())
        .join('; ') +
      '.'
    );
  }

  const companyCnpj = sanitizeCpfCnpj(empresa.EMPRESA_CNPJ);
  const companyIe = onlyDigits(process.env.EMPRESA_IE);
  const companyCep = onlyDigits(process.env.EMPRESA_CEP);
  const companyCityCode = onlyDigits(process.env.EMPRESA_CODIGO_IBGE);

  if (!companyCnpj || companyCnpj.length !== 14) {
    throw new Error(
      '[NFE USO E CONSUMO] EMPRESA_CNPJ ausente ou inválido no .env.'
    );
  }

  if (!companyIe) {
    throw new Error(
      '[NFE USO E CONSUMO] EMPRESA_IE não configurada no .env.'
    );
  }

  if (!companyCep || companyCep.length !== 8) {
    throw new Error(
      '[NFE USO E CONSUMO] EMPRESA_CEP ausente ou inválido no .env.'
    );
  }

  if (!companyCityCode || companyCityCode.length !== 7) {
    throw new Error(
      '[NFE USO E CONSUMO] EMPRESA_CODIGO_IBGE inválido no .env.'
    );
  }

  const isPisCofinsSemBase = (cst) =>
    ['04', '05', '06', '07', '08', '09', '49', '99']
      .includes(String(cst || ''));

  const nfeItems = items.map((item, index) => {
    const fiscal = item.fiscal || {};

    const codigo = String(item.product_code || '').trim();
    const descricao = String(item.description || '').trim().toUpperCase();
    const ncm = onlyDigits(item.ncm || fiscal.ncm || fiscal.ncm_code)
      .slice(0, 8);

    const cest = onlyDigits(
      item.cest ||
      fiscal.cest ||
      fiscal.cest_code ||
      fiscal.codigo_cest
    ).slice(0, 7);

    const quantidade = round4(item.quantity);
    const valorUnitario = round4(item.cost_price);
    const valorProduto = round2(quantidade * valorUnitario);

    const unidade = String(item.unit || 'UN')
      .trim()
      .toUpperCase();

    const cfop = onlyDigits(item.cfop || usoConsumo.cfop || '5949');

    const origem = String(
      fiscal.origem_mercadoria ??
      fiscal.origin_code ??
      0
    );

    const cstIcms = String(
      item.cst_icms ||
      fiscal.cst_icms ||
      fiscal.icms_cst ||
      ''
    ).padStart(2, '0');

    const aliquotaIcms = round4(
      fiscal.aliquota_icms ??
      fiscal.icms_rate ??
      0
    );

    const cstPis = String(
      fiscal.pis_cst ||
      fiscal.cst_pis ||
      '49'
    ).padStart(2, '0');

    const aliquotaPis = round4(
      fiscal.pis_aliquota ??
      fiscal.pis_rate ??
      0
    );

    const cstCofins = String(
      fiscal.cofins_cst ||
      fiscal.cst_cofins ||
      '49'
    ).padStart(2, '0');

    const aliquotaCofins = round4(
      fiscal.cofins_aliquota ??
      fiscal.cofins_rate ??
      0
    );

    if (!codigo) {
      throw new Error(
        `[NFE USO E CONSUMO] Item ${index + 1}: código do produto ausente.`
      );
    }

    if (!descricao) {
      throw new Error(
        `[NFE USO E CONSUMO] Item ${index + 1}: descrição ausente.`
      );
    }

    if (ncm.length !== 8) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: NCM inválido ou ausente.`
      );
    }

    if (cfop.length !== 4) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: CFOP inválido.`
      );
    }

    if (quantidade <= 0) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: quantidade inválida.`
      );
    }

    if (valorUnitario < 0) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: custo inválido.`
      );
    }

    if (!cstIcms) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: CST do ICMS ausente.`
      );
    }

    if (!Number.isFinite(valorProduto) || valorProduto <= 0) {
      throw new Error(
        `[NFE USO E CONSUMO] Produto ${codigo}: base de cálculo IBS/CBS inválida.`
      );
    }

    const icms = {
      origem,
      cst: cstIcms,
    };

    /*
     * CST 40, 41, 50 e 60 normalmente não recebem cálculo comum
     * de base/aliquota neste formato.
     */
    const icmsSemCalculo = ['40', '41', '50', '60'].includes(cstIcms);

    if (!icmsSemCalculo) {
      icms.baseCalculo = {
        modalidadeDeterminacao: 0,
        valor: valorProduto,
      };

      icms.aliquota = aliquotaIcms;
      icms.valor = round2(valorProduto * aliquotaIcms / 100);
    }

    const pis = isPisCofinsSemBase(cstPis)
      ? {
        cst: cstPis,
      }
      : {
        cst: cstPis,
        baseCalculo: {
          valor: valorProduto,
        },
        aliquota: aliquotaPis,
        valor: round2(valorProduto * aliquotaPis / 100),
      };

    const cofins = isPisCofinsSemBase(cstCofins)
      ? {
        cst: cstCofins,
      }
      : {
        cst: cstCofins,
        baseCalculo: {
          valor: valorProduto,
        },
        aliquota: aliquotaCofins,
        valor: round2(valorProduto * aliquotaCofins / 100),
      };

    return {
      codigo,
      descricao,
      ncm,

      ...(cest
        ? {
          cest,
        }
        : {}),

      cfop,

      unidade: {
        comercial: unidade,
        tributavel: unidade,
      },

      quantidade: {
        comercial: quantidade,
        tributavel: quantidade,
      },

      valorUnitario: {
        comercial: valorUnitario,
        tributavel: valorUnitario,
      },

      valor: valorProduto,

      tributos: {
        icms,
        pis,
        cofins,
        ...buildReformaTributariaFromFiscal(fiscal, valorProduto, quantidade),
      },
    };
  });

  const numero = retry
    ? requestedNfeNumber
    : await getNextNfeNumberFromBasicTable();
  const serie = Number(process.env.NFE_SERIE || 1);

  const totalProdutos = round2(
    nfeItems.reduce(
      (total, item) => total + Number(item.valor || 0),
      0
    )
  );

  const observacao = [
    'RETIRADA DE MERCADORIAS PARA USO E CONSUMO INTERNO.',
    `CONTROLE INTERNO: ${usoConsumo.number || id}.`,
    `DEPARTAMENTO: ${usoConsumo.department || 'NÃO INFORMADO'}.`,
    `RESPONSÁVEL: ${usoConsumo.responsible || 'NÃO INFORMADO'}.`,
    usoConsumo.reason
      ? `MOTIVO: ${String(usoConsumo.reason).trim()}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const nfe = {
    idIntegracao: retry
      ? requestedIntegrationId
      : `USOCONSUMO-${id}`,

    numero,
    serie,

    natureza: 'USO E CONSUMO INTERNO',
    finalidade: '1',
    consumidorFinal: true,
    presencial: '9',
    intermediador: 0,

    codigoMunicipioFatoGeradorIbs: companyCityCode,

    emitente: {
      cpfCnpj: companyCnpj,
      razaoSocial: empresa.EMPRESA_RAZAO,
      nomeFantasia: empresa.EMPRESA_FANTASIA,
    },

    /*
     * Destinatário é a própria BH3.
     */
    destinatario: {
      cpfCnpj: companyCnpj,
      razaoSocial: empresa.EMPRESA_RAZAO,
      nomeFantasia: empresa.EMPRESA_FANTASIA,
      indicadorIEDestinatario: '1',
      inscricaoEstadual: companyIe,

      endereco: {
        logradouro: montarLogradouroNfe(
          process.env.EMPRESA_TIPO_LOGRADOURO,
          process.env.EMPRESA_NOME_LOGRADOURO
        ),
        numero: String(process.env.EMPRESA_NUMERO_LOGRADOURO || 'S/N'),
        bairro: String(process.env.EMPRESA_BAIRRO || '').trim().toUpperCase(),
        codigoCidade: companyCityCode,
        descricaoCidade: String(
          process.env.EMPRESA_MUNICIPIO || ''
        ).trim().toUpperCase(),
        estado: String(process.env.EMPRESA_UF || 'MG')
          .trim()
          .toUpperCase(),
        cep: companyCep,
        codigoPais: '1058',
        descricaoPais: 'BRASIL',
      },
    },

    transporte: {
      modalidadeFrete: '9',
    },

    total: {
      valorFrete: 0,
    },

    pagamentos: [
      {
        aVista: true,
        meio: '90',
        valor: 0,
      },
    ],

    informacoesComplementares: observacao,

    itens: nfeItems,

    responsavelTecnico: {
      cpfCnpj: sanitizeCpfCnpj(empresa.RESPONSAVEL_CNPJ),
      nome: empresa.RESPONSAVEL_NOME,
      email: empresa.RESPONSAVEL_EMAIL,

      ...(splitPhone(empresa.RESPONSAVEL_TELEFONE)
        ? {
          telefone: splitPhone(
            empresa.RESPONSAVEL_TELEFONE
          ),
        }
        : {}),
    },
  };

  nfe.total = buildReformaTotals(nfe, totalProdutos);

  console.log('[NFE USO E CONSUMO][PAYLOAD]', {
    uso_consumo_id: id,
    retry,
    idIntegracao: nfe.idIntegracao,
    numero,
    serie,
    totalProdutos,
    quantidadeItens: nfeItems.length,
    ambiente: getAmbiente(),
  });

  if (NFE_DEBUG) {
    console.log(
      '[NFE USO E CONSUMO][PAYLOAD COMPLETO]',
      JSON.stringify(nfe, null, 2)
    );
  }

  const result = await emitirNFe(nfe);

  if (!result?.ok) {
    throw new Error(
      result?.message ||
      result?.error?.message ||
      '[NFE USO E CONSUMO] A PlugNotas recusou a emissão.'
    );
  }

  const responseData = result.data || {};

  const document =
    responseData.documents?.[0] ||
    responseData.documentos?.[0] ||
    responseData.data?.documents?.[0] ||
    responseData.data?.documentos?.[0] ||
    responseData;

  const plugnotasId =
    document?.id ||
    document?.idDocumento ||
    responseData?.id ||
    null;

  if (!plugnotasId && !result.mock) {
    console.warn(
      '[NFE USO E CONSUMO] Emissão aceita, mas o ID da PlugNotas não foi localizado.',
      JSON.stringify(responseData)
    );
  }

  return {
    ok: true,
    uso_consumo_id: id,
    retry,
    id_integracao: nfe.idIntegracao,
    nfe_number: numero,
    nfe_series: serie,
    nfe_environment: getAmbiente(),
    plugnotas_id: plugnotasId,
    total_amount: totalProdutos,
    provider_response: responseData,
  };
}
