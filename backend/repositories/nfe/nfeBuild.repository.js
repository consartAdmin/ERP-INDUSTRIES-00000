// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeBuild.repository.js — Monta JSON NF-e do pedido                   ║
// ║ ✔ buildNFeFromOrder (padrão PlugNotas)                               ║
// ║ ✔ Persiste data de emissão no pedido                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  NFE_DEBUG,
} from '../tecnoSpeedNfe/tecnoSpeedNfeClient.repository.js';
import {
  resolveActiveStockMode,
  round2,
  round4,
  sum,
  onlyDigits,
  getEmpresaConfig,
} from './nfe.utils.js';
import {
  formatLocalISODate,
  sanitizeCpfCnpj,
  splitPhone,
  isValidDateObj,
  formatMoneyBRComplete,
} from './nfe.sanitizers.js';
import {
  buildReformaTributariaFromFiscal,
  buildReformaTotals,
} from './nfe.reformaTributaria.js';
import {
  peekNextNfeNumber,
  resolveOrderIdForNfe,
  getNextNfeNumberForOrder,
} from './nfeNumbering.repository.js';
import {
  buildPagamentosFromOrderHeader,
  normalizeCobrancaToTotal,
  buildCobrancaFromOrderHeader,
  loadBudgetPaymentsForNfe,
  buildPaymentDescriptionFromPayload,
  isPagamentoAVistaReal,
} from './nfePayments.repository.js';
import {
  loadUnitsMap,
  loadFiscalBySku,
  loadProductUnitsBySku,
  distribuirDescontoGlobalNosItens,
} from './nfeProducts.repository.js';
import {
  buildIdIntegracaoFromOrder,
  buildDestinatarioFromOrderHeader,
  loadBudgetObservation,
  loadBudgetPaymentDescription,
} from './nfeRecipient.repository.js';
import {
  validarNFeFiscalmente,
} from './nfeValidation.repository.js';
import {
  buildTransporteFromOrder,
  loadOrderDeliveryForNfe,
} from './nfeTransport.repository.js';

/* =========================================================================
 * 🧱 Monta JSON NFe (padrão TecnoSpeed / PlugNotas)
 * ========================================================================= */
export async function buildNFeFromOrder(
  orderInput,
  {
    preview = false,
  } = {},
) {
  const empresa = getEmpresaConfig();

  const header = orderInput?.header || orderInput || {};
  const items = Array.isArray(orderInput?.items) ? orderInput.items : [];

  const stockMode =
    await resolveActiveStockMode();

  console.log('[NFE][STOCK_MODE]', {
    mode: stockMode.mode,
    isSimple: stockMode.isSimple,
    isWithLot: stockMode.isWithLot,
    requireLot: stockMode.requireLot,
  });

  // ✅ SEMPRE usa a data/hora atual no momento da emissão da NF-e
  const realIssueDateObj = new Date();

  if (!isValidDateObj(realIssueDateObj)) {
    throw new Error('[NFE] Falha ao gerar data atual de emissão da NF-e.');
  }

  const realIssueDateISO = formatLocalISODate(realIssueDateObj);

  const orderId = resolveOrderIdForNfe(header);

  if (orderId && !header.shipping) {
    header.shipping = await loadOrderDeliveryForNfe(orderId);

    console.log('[NFE][SHIPPING LOADED DIRECT]', {
      order_id: orderId,
      shipping: header.shipping,
    });
  }

  if (orderId && !preview) {
    await persistOrderIssueDate(
      orderId,
      realIssueDateObj,
    );
  }

  const docDest = sanitizeCpfCnpj(
    header.customer_tax_id ||
    header.cnpj_cpf ||
    header.cpf_cnpj ||
    header.documento ||
    null,
  );

  const ieRaw = (
    header.ie ||
    header.inscricao_estadual ||
    header.state_registration ||
    header.ie_rg ||
    ''
  ).trim();

  const ieInformada = !!ieRaw && !/^ISENTO$/i.test(ieRaw);
  const isNaoContribuinte = !ieInformada;

  const consumidorFinalRaw =
    header.consumidor_final ??
    header.consumidorFinal ??
    header.final_consumer ??
    header.is_final_consumer;

  const consumidorFinalValue = String(consumidorFinalRaw ?? '')
    .trim()
    .toLowerCase();

  const consumidorFinal =
    consumidorFinalRaw === true ||
    consumidorFinalRaw === 1 ||
    ['1', 'true', 'sim', 's', 'yes'].includes(consumidorFinalValue);

  const destinatario = await buildDestinatarioFromOrderHeader(header, {
    docDest,
    ieRaw,
    isNaoContribuinte,
  });

  const skus = items.map((i) => i.sku);
  const fiscalBySku = await loadFiscalBySku(skus);

  const productUnitsBySku = await loadProductUnitsBySku(skus);

  const totalProdutos = round2(
    items.reduce(
      (s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0),
      0,
    ),
  );

  const totalDescontoItens = round2(
    items.reduce(
      (s, it) => s + Number(it.discount_value ?? it.desconto_valor ?? 0),
      0,
    ),
  );

  const totalFrete = round2(
    Number(
      header.freight_value ??
      header.freight ??
      header.shipping_value ??
      header.shipping_amount ??
      header.valor_frete ??
      header.frete ??
      0
    )
  );

  const totalPedidoInformado = round2(
    Number(
      header.total_amount ??
      header.total ??
      header.valor_total ??
      header.order_total ??
      0
    )
  );

  let totalDesconto = totalDescontoItens;

  if (totalPedidoInformado > 0) {
    const descontoCalculadoPeloHeader = round2(
      totalProdutos + totalFrete - totalPedidoInformado
    );

    if (descontoCalculadoPeloHeader >= 0) {
      totalDesconto = descontoCalculadoPeloHeader;
    }
  }

  const subtotalItens = round2(totalProdutos - totalDesconto);
  const valorNotaFinal = round2(subtotalItens + totalFrete);

  const descontoGlobalCalculado = round2(
    Math.max(0, totalDesconto - totalDescontoItens)
  );

  const itemsComDescontoNfe = distribuirDescontoGlobalNosItens(
    items,
    descontoGlobalCalculado,
  );

  const fiscalOperation = header.fiscal_operation || header.operation || {};
  const generatesReceivable =
    fiscalOperation.generates_receivable ??
    header.generates_receivable ??
    true;

  let pagamentos = [];
  let cobranca = null;

  const budgetPaymentData = header.budget_id && generatesReceivable
    ? await loadBudgetPaymentsForNfe(
      header.budget_id,
      valorNotaFinal,
      realIssueDateObj
    )
    : null;

  if (budgetPaymentData?.pagamentos?.length) {
    pagamentos = budgetPaymentData.pagamentos;
    cobranca = budgetPaymentData.cobranca;

    console.log(
      '[NFE] Pagamentos reais do orçamento carregados:',
      JSON.stringify(
        {
          budget_id: header.budget_id,
          pagamentos,
          cobranca,
        },
        null,
        2,
      ),
    );
  } else if (generatesReceivable) {
    cobranca = await buildCobrancaFromOrderHeader(
      {
        ...header,
        total_amount: valorNotaFinal,
      },
      valorNotaFinal,
      realIssueDateObj,
    );

    let totalFatura = NaN;
    if (cobranca) {
      const v1 = Number(cobranca.valorLiquido ?? NaN);
      const v2 = Number(cobranca.valorTotal ?? NaN);
      totalFatura = Number.isFinite(v1) ? v1 : v2;
    }

    pagamentos = await buildPagamentosFromOrderHeader(
      {
        ...header,
        total_amount: valorNotaFinal,
      },
      valorNotaFinal,
      Number.isFinite(totalFatura) ? totalFatura : undefined,
    );

    if (
      cobranca &&
      Array.isArray(pagamentos) &&
      pagamentos.length &&
      Number.isFinite(totalFatura)
    ) {
      pagamentos[0].valor = round2(totalFatura);
    }
  }

  if (orderId && cobranca?.parcelas?.length) {
    const firstDue = cobranca.parcelas[0].dataVencimento;
    if (firstDue) {
      await pool.query(
        `
          UPDATE public."orders"
          SET due_date = $1, updated_at = NOW()
          WHERE order_id = $2
        `,
        [firstDue, orderId],
      );
    }
  }

  const pagamentoAVistaReal = isPagamentoAVistaReal(
    cobranca,
    realIssueDateISO,
  );

  pagamentos = (Array.isArray(pagamentos) ? pagamentos : []).map((p) => ({
    ...p,
    aVista: pagamentoAVistaReal,
  }));

  let cobrancaFinal = pagamentoAVistaReal ? null : cobranca;

  if (pagamentoAVistaReal) {
    console.log(
      '[NFE] Pagamento à vista real detectado → removendo bloco de cobranca (fatura/duplicatas).',
    );
  }

  function nowLocalIsoDateTime(date = new Date()) {
    const d = date;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ✅ SEMPRE usa a data/hora atual na emissão
  const dhSaiEnt = nowLocalIsoDateTime(realIssueDateObj);

  const serie = Number(process.env.NFE_SERIE || 1);
  const idIntegracao = buildIdIntegracaoFromOrder(header);

  /*
   * Preview only consults the probable next number.
   * Real issuance atomically reserves and persists the number.
   */
  const numero = preview
    ? await peekNextNfeNumber(header)
    : await getNextNfeNumberForOrder(header);

  let obs = null;
  let budgetPaymentInfo = null;

  if (header.budget_id) {
    obs = await loadBudgetObservation(header.budget_id);
    budgetPaymentInfo = await loadBudgetPaymentDescription(header.budget_id);
  }

  if (!obs) {
    obs =
      header.observation ||
      header.observacao ||
      header.obs ||
      header.notes ||
      header.additional_info ||
      null;
  }

  const obsParts = [
    String(obs || '').trim(),
    String(budgetPaymentInfo || '').trim(),
  ].filter(Boolean);

  const obsClean = obsParts.join(' | ');

  console.log('[NFE] pagamentos antes do ajuste final =', JSON.stringify(pagamentos, null, 2));
  console.log('[NFE] cobranca antes do ajuste final =', JSON.stringify(cobrancaFinal, null, 2));
  console.log('[NFE] informacoesComplementares =', obsClean);

  const totalPagamentosAntes = round2(sum(pagamentos, (p) => p.valor));
  const diffPagamentos = round2(valorNotaFinal - totalPagamentosAntes);

  if (pagamentos.length && Math.abs(diffPagamentos) >= 0.01) {
    pagamentos[pagamentos.length - 1].valor = round2(
      Number(pagamentos[pagamentos.length - 1].valor || 0) + diffPagamentos,
    );
  }

  let cobrancaAjustada = cobrancaFinal ?? null;

  if (cobrancaAjustada) {
    cobrancaAjustada = normalizeCobrancaToTotal(cobrancaAjustada, valorNotaFinal);

    /*
     * ✅ nFat = número da NF-e.
     *
     * O número da fatura precisa ser o mesmo número da nota (nNF),
     * e não o número do pedido/orçamento, para casar com o
     * "Nº Fatura" de Contas a Receber (nfe_number/parcela).
     */
    cobrancaAjustada = {
      ...cobrancaAjustada,
      numero: String(numero),
    };
  }

  const totalPagamentosFinal = round2(sum(pagamentos, (p) => p.valor));

  const valorTroco = round2(
    Math.max(0, totalPagamentosFinal - valorNotaFinal)
  );

  const pagamentosFinal = generatesReceivable
    ? (Array.isArray(pagamentos) ? pagamentos : [])
    : [{ aVista: true, meio: '90', valor: 0 }];
  const valorTrocoFinal = valorTroco;
  const cobrancaPayload = generatesReceivable
    ? cobrancaAjustada
    : null;

  const paymentInfoFinal = buildPaymentDescriptionFromPayload(
    pagamentosFinal,
    cobrancaPayload,
  );

  console.log('[NFE] pagamentos payload final =', JSON.stringify(pagamentosFinal, null, 2));
  console.log('[NFE] cobranca payload final =', JSON.stringify(cobrancaPayload, null, 2));

  const unitsMap = await loadUnitsMap();

  function normalizeNfeUnit(value) {
    const raw = String(value || 'UN')
      .toUpperCase()
      .trim();

    return (
      unitsMap[raw] ||
      unitsMap[raw.replace(/\./g, '')] ||
      raw.replace(/\./g, '') ||
      'UN'
    );
  }

  const codigoMunicipioIbs = onlyDigits(
    destinatario?.endereco?.codigoCidade,
  );

  if (codigoMunicipioIbs.length !== 7) {
    throw new Error(
      '[NFE] Código do município de consumo do IBS/CBS ausente ou inválido.',
    );
  }

  const lotIds = stockMode.isWithLot ? Array.from(
    new Set(
      itemsComDescontoNfe
        .map((item) => Number(item.lot_id))
        .filter(Number.isFinite),
    ),
  ) : [];

  const productCodes = stockMode.isSimple ? Array.from(
    new Set(
      itemsComDescontoNfe
        .map((item) => String(item.product_code || item.sku || '').trim())
        .filter(Boolean),
    ),
  ) : [];

  const { rows: entradasSt } = lotIds.length
    ? await pool.query(
      `
        SELECT DISTINCT ON (lot_id)
          lot_id,
          quantity AS inbound_quantity,
          icms AS icms_value,
          icms_st_base,
          icms_st_rate,
          icms_st_value
        FROM "inboundInvoiceItems"
        WHERE lot_id = ANY($1::bigint[])
          AND icms_st_base IS NOT NULL
          AND icms_st_rate IS NOT NULL
          AND icms_st_value IS NOT NULL
        ORDER BY lot_id, inbound_item_id DESC
      `,
      [lotIds],
    )
    : { rows: [] };

  const entradaStPorLote = Object.fromEntries(
    entradasSt.map((entrada) => [
      String(entrada.lot_id),
      entrada,
    ]),
  );

  console.log('[NFE][ICMS-ST POR LOTE]', entradaStPorLote);

  const { rows: entradasStPorProdutoRows } = productCodes.length
    ? await pool.query(
      `
        SELECT DISTINCT ON (TRIM(product_code))
          TRIM(product_code) AS product_code,
          quantity AS inbound_quantity,
          icms AS icms_value,
          icms_st_base,
          icms_st_rate,
          icms_st_value
        FROM public."inboundInvoiceItems"
        WHERE TRIM(product_code) = ANY($1::text[])
          AND quantity IS NOT NULL
          AND quantity > 0
          AND icms_st_base IS NOT NULL
          AND icms_st_rate IS NOT NULL
          AND icms_st_value IS NOT NULL
        ORDER BY TRIM(product_code), inbound_item_id DESC
      `,
      [productCodes],
    )
    : { rows: [] };

  const entradaStPorProduto = Object.fromEntries(
    entradasStPorProdutoRows.map((entrada) => [
      String(entrada.product_code).trim(),
      entrada,
    ]),
  );

  console.log('[NFE][ICMS-ST POR PRODUTO]', entradaStPorProduto);

  function getEntradaStForItem(item) {
    if (stockMode.isWithLot) {
      return entradaStPorLote[String(item.lot_id || '').trim()] || null;
    }

    const productCode = String(
      item.product_code || item.sku || '',
    ).trim();

    return entradaStPorProduto[productCode] || null;
  }

  const icmsStDetails = itemsComDescontoNfe
    .map((it) => {
      const fiscal = {
        ...it,
        ...(fiscalBySku[String(it.sku || '').trim()] || {}),
      };

      const cst = String(
        fiscal.cst_icms ||
        fiscal.icms_cst ||
        '',
      ).padStart(2, '0');

      // This complementary information applies to CST 60.
      if (cst !== '60') {
        return null;
      }

      const entradaSt = getEntradaStForItem(it);

      if (!entradaSt) {
        return null;
      }

      const quantidadeSaida = Number(
        it.quantity ??
        it.qtd ??
        it.qtd_comercial ??
        it.qtd_venda ??
        0
      );

      const quantidadeEntrada = Number(entradaSt.inbound_quantity);

      if (
        !Number.isFinite(quantidadeSaida) ||
        quantidadeSaida <= 0 ||
        !Number.isFinite(quantidadeEntrada) ||
        quantidadeEntrada <= 0
      ) {
        return null;
      }

      const proporcao = quantidadeSaida / quantidadeEntrada;

      const proporcionalizarDinheiro = (valor) => {
        const centavosEntrada = Math.round(Number(valor || 0) * 100);
        return Math.round(centavosEntrada * proporcao) / 100;
      };

      const baseStAnterior = proporcionalizarDinheiro(
        entradaSt.icms_st_base
      );

      const valorStAnterior = proporcionalizarDinheiro(
        entradaSt.icms_st_value
      );

      const codigoProduto = String(it.sku || '').trim();

      return [
        `CodProd: ${codigoProduto}`,
        `Base ST Ant.: ${formatMoneyBRComplete(baseStAnterior)}`,
        `Valor ST Ant.: ${formatMoneyBRComplete(valorStAnterior)}`,
      ].join(' / ');
    })
    .filter(Boolean);

  const icmsStInfo = icmsStDetails.length
    ? [
      'Imposto recolhido por ST nos termos do Anexo VII do RICMS/2023, Decreto nº 48.589.',
      ...icmsStDetails,
    ].join(' ')
    : '';

  // ================================================================
  // Nº FATURA / nFat nas Informações Complementares
  // ================================================================
  const numeroFaturaInfo = cobrancaPayload?.numero
    ? `Fatura: ${String(cobrancaPayload.numero).trim()}`
    : '';

  const informacoesComplementaresFinal = [
    String(obs || '').trim(),
    String(icmsStInfo || '').trim(),
    String(numeroFaturaInfo || '').trim(),
    String(paymentInfoFinal || '').trim(),
  ]
    .filter(Boolean)
    .join(' | ');

  console.log(
    '[NFE] Informações complementares finais:',
    informacoesComplementaresFinal,
  );

  const natureOperation = String(
    fiscalOperation.nature_operation ||
    header.nature_operation ||
    'VENDA DE MERCADORIAS'
  ).trim();

  const nfe = {
    idIntegracao,
    dataHoraSaidaEntrada: dhSaiEnt,
    numero,
    finalidade: '1',
    saida: true,
    presencial: '1',
    serie,
    consumidorFinal,
    codigoMunicipioFatoGeradorIbs: codigoMunicipioIbs,
    natureza: natureOperation,

    ...(informacoesComplementaresFinal
      ? {
        informacoesComplementares:
          informacoesComplementaresFinal,
      }
      : {}),

    emitente: {
      cpfCnpj: sanitizeCpfCnpj(empresa.EMPRESA_CNPJ),
      razaoSocial: empresa.EMPRESA_RAZAO,
      nomeFantasia: empresa.EMPRESA_FANTASIA,
    },

    destinatario,

    total: {
      valorFrete: round2(totalFrete),
    },

    transporte: buildTransporteFromOrder(header, totalFrete),

    itens: itemsComDescontoNfe.map((it, idx) => {
      const fiscal = {
        ...it,
        ...(fiscalBySku[String(it.sku || '').trim()] || {}),
      };

      if (!fiscal.fiscal_classification_id) {
        throw new Error(
          `[NFE] SKU ${it.sku}: vínculo fiscal V2 ativo não encontrado.`,
        );
      }
      if (!fiscal.fiscal_profile_id) {
        throw new Error(
          `[NFE] SKU ${it.sku}: a classificação não possui Perfil Fiscal V2 ativo.`,
        );
      }

      const qtdRaw = Number(
        it.quantity ?? it.qtd ?? it.qtd_comercial ?? it.qtd_venda ?? 0,
      );

      const vUnitRaw = Number(it.unit_price ?? it.preco_unitario ?? 0);
      const vDesc = round2(
        Number(it._descontoRateado ?? it.discount_value ?? it.desconto_valor ?? 0),
      );

      const qtd = round4(qtdRaw);
      const vUnitN = round4(vUnitRaw);
      const vBruto = round2(qtd * vUnitN);
      const vLiq = round2(Math.max(0, vBruto - vDesc));

      const skuKey = String(it.sku || '').trim();

      const rawUnidadeComercial =
        it.unidadeComercial ||
        it.unidade_comercial ||
        it.unit_display ||
        it.unit_lookup ||
        it.unit ||
        it.unit_com ||
        it.unit_name ||
        it.unidade ||
        it.unidade_venda ||
        it.uom ||
        productUnitsBySku[skuKey] ||
        'UN';

      const unidadeComercial = String(rawUnidadeComercial || 'UN')
        .toUpperCase()
        .trim();

      const unidadeTributavel = normalizeNfeUnit(
        it.unidadeTributavel ||
        it.unidade_tributavel ||
        it.unit_trib ||
        it.unidade_trib ||
        unidadeComercial
      );

      console.log('[NFE][ITEM_UNIT_XML]', {
        sku: it.sku,
        rawUnidadeComercial,
        unidadeComercial,
        unidadeTributavel,
        productUnitDb: productUnitsBySku[skuKey],
        rawKeys: Object.keys(it),
      });

      const ncm = onlyDigits(fiscal.ncm || fiscal.ncm_code).slice(0, 8);
      if (ncm.length !== 8) {
        throw new Error(`[NFE] SKU ${it.sku}: NCM V2 ausente ou inválido.`);
      }

      let cest = null;
      const cestSrc = fiscal.cest ?? fiscal.cest_code ?? null;
      if (cestSrc != null && cestSrc !== '') {
        const digits = String(cestSrc).replace(/\D/g, '');
        if (digits && digits.length === 7) {
          cest = digits;
        } else {
          console.warn(
            '[NFE] CEST inválido para SKU',
            it.sku,
            'valor:',
            cestSrc,
            '→ será ignorado (não enviado para a NFe).',
          );
        }
      }

      const operationCfop =
        it.operation_cfop ||
        fiscalOperation.cfop ||
        header.operation_cfop ||
        null;

      const operationForcesCfop = Boolean(
        fiscalOperation.force_cfop ??
        header.operation_forces_cfop ??
        false
      );

      const cfopSaidaRaw =
        (operationForcesCfop ? operationCfop : null) ||
        fiscal.cfop_exit ||
        (Array.isArray(fiscal.cfops_saida) && fiscal.cfops_saida.length
          ? fiscal.cfops_saida[0]
          : null) ||
        operationCfop;

      const cfop = onlyDigits(cfopSaidaRaw).slice(0, 4);
      if (cfop.length !== 4) {
        throw new Error(`[NFE] SKU ${it.sku}: CFOP de saída ausente ou inválido.`);
      }

      const origemVal =
        fiscal.origem_mercadoria ??
        (fiscal.origin_code != null ? Number(fiscal.origin_code) : null) ??
        0;

      const origem = String(origemVal);
      if (!fiscal.icms_cst || !fiscal.pis_cst || !fiscal.cofins_cst) {
        throw new Error(
          `[NFE] SKU ${it.sku}: CST de ICMS, PIS ou COFINS ausente no Perfil Fiscal V2.`,
        );
      }

      const cst = String(fiscal.cst_icms || fiscal.icms_cst);
      const icmsAliq = Number(fiscal.aliquota_icms ?? fiscal.icms_rate ?? 0);
      const vIcms = (vLiq * icmsAliq) / 100;

      const icms = { origem, cst };

      if (cst === '60') {
        if (stockMode.isWithLot && !it.lot_id) {
          throw new Error(
            `[NFE] SKU ${it.sku}: o lote é obrigatório porque ` +
            'o modo de estoque ativo é STOCK_WITH_LOT.',
          );
        }

        const retainedFromItem =
          it.icms_st_retained ||
          it.tax_calculation?.icms_st_retained ||
          null;

        if (retainedFromItem) {
          Object.assign(icms, {
            valor: Number(
              retainedFromItem.vICMSSubstituto ??
              it.vICMSSubstituto ??
              0,
            ),

            substituicaoTributaria: {
              baseCalculo: {
                valor: Number(
                  retainedFromItem.vBCSTRet ??
                  it.vBCSTRet ??
                  0,
                ),
              },

              aliquota: round4(
                retainedFromItem.pST ??
                it.pST ??
                0,
              ),

              valor: Number(
                retainedFromItem.vICMSSTRet ??
                it.vICMSSTRet ??
                0,
              ),

              ufDestino: {
                baseCalculo: {
                  valor: 0,
                },
                valor: 0,
              },
            },
          });

          console.log(
            '[NFE][ICMS-ST ITEM][PRE_RESOLVED]',
            {
              sku: it.sku,
              lote: it.lot_id,
              source:
                it.icms_st_origin?.source_type ??
                it.icms_st_origin?.source ??
                null,
              icms,
            },
          );
        } else {
          const entradaSt = getEntradaStForItem(it);

          if (!entradaSt) {
            throw new Error(
              stockMode.isWithLot
                ? `[NFE] SKU ${it.sku}: dados de ICMS-ST não encontrados para o lote ${it.lot_id}.`
                : `[NFE] SKU ${it.sku}: dados de ICMS-ST não encontrados no histórico fiscal do produto.`,
            );
          }

          const quantidadeEntrada = Number(entradaSt.inbound_quantity);
          const proporcao = qtd / quantidadeEntrada;

          if (
            !Number.isFinite(quantidadeEntrada) ||
            quantidadeEntrada <= 0 ||
            !Number.isFinite(proporcao) ||
            proporcao <= 0
          ) {
            throw new Error(
              `[NFE] SKU ${it.sku}: quantidade de entrada inválida ` +
              (stockMode.isWithLot
                ? `para o lote ${it.lot_id}.`
                : 'no histórico fiscal do produto.'),
            );
          }

          const proporcionalizarDinheiro = (valor) => {
            const centavosEntrada = Math.round(Number(valor || 0) * 100);
            return Math.round(centavosEntrada * proporcao) / 100;
          };

          Object.assign(icms, {
            // vICMSSubstituto
            valor: proporcionalizarDinheiro(
              entradaSt.icms_value,
            ),

            substituicaoTributaria: {
              // vBCSTRet
              baseCalculo: {
                valor: proporcionalizarDinheiro(
                  entradaSt.icms_st_base,
                ),
              },

              // pST
              aliquota: round4(
                entradaSt.icms_st_rate,
              ),

              // vICMSSTRet
              valor: proporcionalizarDinheiro(
                entradaSt.icms_st_value,
              ),

              // Exigido pelo schema atual da PlugNotas para esse objeto
              ufDestino: {
                baseCalculo: {
                  valor: 0,
                },
                valor: 0,
              },
            },
          });

          console.log('[NFE][ICMS-ST ITEM][LEGACY_INBOUND]', {
            sku: it.sku,
            modoEstoque: stockMode.mode,
            lote: stockMode.isWithLot ? it.lot_id : null,
            origemFiscal: stockMode.isWithLot
              ? 'LOTE'
              : 'PRODUCT_CODE',
            quantidadeEntrada,
            quantidadeSaida: qtd,
            proporcao,
            icms,
          });
        }
      } else {
        icms.baseCalculo = {
          modalidadeDeterminacao: 0,
          valor: round2(vLiq),
        };

        icms.aliquota = round4(icmsAliq);
        icms.valor = round2(vIcms);
      }

      const pisCst = String(fiscal.pis_cst);
      const pisAliq = Number(fiscal.pis_aliquota ?? fiscal.pis_rate ?? 0);

      const cofCst = String(fiscal.cofins_cst);
      const cofinsAliq = Number(
        fiscal.cofins_aliquota ?? fiscal.cofins_rate ?? 0,
      );

      const isNT = (c) =>
        ['04', '05', '06', '07', '08', '09', '99'].includes(String(c));

      const pis = isNT(pisCst)
        ? { cst: pisCst }
        : {
          cst: pisCst,
          baseCalculo: { valor: round2(vLiq) },
          aliquota: round4(pisAliq),
          valor: round2((vLiq * pisAliq) / 100),
        };

      const cofins = isNT(cofCst)
        ? { cst: cofCst }
        : {
          cst: cofCst,
          baseCalculo: { valor: round2(vLiq) },
          aliquota: round4(cofinsAliq),
          valor: round2((vLiq * cofinsAliq) / 100),
        };

      const ipiCst = fiscal.ipi_cst || null;
      const ipiAliq = Number(fiscal.ipi_aliquota || 0);

      let ipi;
      if (ipiCst) {
        ipi = { cst: ipiCst };
        if (ipiAliq > 0 && vLiq > 0) {
          ipi.baseCalculo = { valor: round2(vLiq) };
          ipi.aliquota = round4(ipiAliq);
          ipi.valor = round2((vLiq * ipiAliq) / 100);
        }
      }

      const tributos = {
        icms,
        pis,
        cofins,
        ...(ipi ? { ipi } : {}),
        ...buildReformaTributariaFromFiscal(fiscal, vLiq, qtd),
      };

      const freightItem = idx === 0 ? round2(totalFrete) : 0;

      const itemJson = {
        codigo: it.sku,
        descricao: it.description || it.descricao || '',
        ncm,
        ...(cest ? { cest } : {}),
        cfop,

        unidade: {
          comercial: unidadeComercial,
          tributavel: unidadeTributavel,
        },

        quantidade: {
          comercial: qtd,
          tributavel: qtd,
        },

        valorUnitario: {
          comercial: vUnitN,
          tributavel: vUnitN,
        },

        valor: vBruto,
        valorTotal: vLiq,
        compoeTotal: true,
        ...(vDesc > 0 ? { valorDesconto: vDesc } : {}),
        ...(freightItem > 0 ? { valorFrete: freightItem } : {}),

        tributos,
      };

      if (NFE_DEBUG) {
        const calcProd = round2(qtd * vUnitN);
        const diff = round2(vBruto - calcProd);

        console.log(
          '──────────────────────── ITEM NFE DEBUG (nItem:',
          idx + 1,
          ') ────────────────────────',
        );
        console.log('SKU..............:', itemJson.codigo);
        console.log('Descrição........:', itemJson.descricao);
        console.log('qCom / qtd.......:', qtd);
        console.log('vUnCom...........:', vUnitN);
        console.log('vProd (valor)....:', vBruto);
        console.log('qCom * vUnCom....:', calcProd);
        console.log('Diferença........:', diff);
        console.log('Desconto linha...:', vDesc);
        console.log(
          'ICMS aliq/valor..:',
          icmsAliq,
          '→',
          icms?.valor ?? '(sem icms.valor)',
        );
        console.log(
          'PIS  aliq/valor..:',
          pisAliq,
          '→',
          pis?.valor ?? '(sem pis.valor)',
        );
        console.log(
          'COFINS aliq/valor:',
          cofinsAliq,
          '→',
          cofins?.valor ?? '(sem cofins.valor)',
        );
        if (ipi) {
          console.log(
            'IPI  aliq/valor..:',
            ipiAliq,
            '→',
            ipi.valor ?? '(sem ipi.valor)',
          );
        }
        console.log(
          '───────────────────────────────────────────────────────────────────────────────',
        );
      }

      return itemJson;
    }),

    ...(pagamentosFinal.length ? { pagamentos: pagamentosFinal } : {}),
    ...(valorTrocoFinal > 0 ? { valorTroco: valorTrocoFinal } : {}),
    ...(cobrancaPayload ? { cobranca: cobrancaPayload } : {}),

    responsavelTecnico: {
      cpfCnpj: sanitizeCpfCnpj(empresa.RESPONSAVEL_CNPJ),
      nome: empresa.RESPONSAVEL_NOME,
      email: empresa.RESPONSAVEL_EMAIL,
      ...(splitPhone(empresa.RESPONSAVEL_TELEFONE)
        ? { telefone: splitPhone(empresa.RESPONSAVEL_TELEFONE) }
        : {}),
    },
  };

  nfe.total = buildReformaTotals(nfe, valorNotaFinal);

  const validacaoFiscal = validarNFeFiscalmente({
    ...nfe,
    _meta: {
      valorFrete: totalFrete,
      valorNotaEsperado: valorNotaFinal,
      generatesReceivable,
    },
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[NFE][VALIDAÇÃO FISCAL]');
  console.log(JSON.stringify(validacaoFiscal.resumo, null, 2));

  if (validacaoFiscal.avisos.length) {
    console.warn('[NFE][VALIDAÇÃO][AVISOS]');
    console.warn(JSON.stringify(validacaoFiscal.avisos, null, 2));
  }

  if (!validacaoFiscal.ok) {
    console.error('[NFE][VALIDAÇÃO][ERROS]');
    console.error(JSON.stringify(validacaoFiscal.erros, null, 2));
    throw new Error(
      `NF-e inválida fiscalmente: ${validacaoFiscal.erros.join(' | ')}`,
    );
  }

  if (NFE_DEBUG) {
    console.log('[NFE][VALIDAÇÃO][LOGS_ITENS]');
    console.log(JSON.stringify(validacaoFiscal.logs, null, 2));
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('[NFE][TOTAL][PAYLOAD_CHECK]', {
    valorNotaFinal,
    total: nfe.total,
    valorFrete: nfe.valorFrete,
    transporte: nfe.transporte,
    pagamentos: nfe.pagamentos,
    valorTroco: nfe.valorTroco,
  });

  return nfe;
}

export async function persistOrderIssueDate(orderId, issueDateObj) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return;

  const issueDateISO = formatLocalISODate(issueDateObj);

  await pool.query(
    `
      UPDATE public."orders"
      SET nfe_issue_date = $1,
          nfe_issue_datetime = $2,
          updated_at = NOW()
      WHERE order_id = $3
    `,
    [issueDateISO, issueDateObj, id],
  );
}
