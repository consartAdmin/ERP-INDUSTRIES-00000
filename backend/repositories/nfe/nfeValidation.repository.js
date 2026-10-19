// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeValidation.repository.js — Validação fiscal pré-envio             ║
// ║ ✔ Checagens completas do payload NF-e                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  round4,
  money,
  nearlyEqual,
  sum,
} from './nfe.utils.js';

/* =========================================================================
 * ✅ Validação fiscal completa pré-envio
 * ========================================================================= */
export function validarNFeFiscalmente(nfe) {
  const erros = [];
  const avisos = [];
  const logs = [];

  const itens = Array.isArray(nfe?.itens) ? nfe.itens : [];
  const pagamentos = Array.isArray(nfe?.pagamentos) ? nfe.pagamentos : [];
  const parcelas = Array.isArray(nfe?.cobranca?.parcelas)
    ? nfe.cobranca.parcelas
    : [];

  if (!itens.length) {
    erros.push('NF-e sem itens.');
  }

  let somaProdutos = 0;
  let somaDescontos = 0;
  let somaLiquidaItens = 0;

  itens.forEach((item, idx) => {
    const nItem = idx + 1;

    const qtdCom = round4(item?.quantidade?.comercial);
    const qtdTrib = round4(item?.quantidade?.tributavel);

    const vUnCom = round4(item?.valorUnitario?.comercial);
    const vUnTrib = round4(item?.valorUnitario?.tributavel);

    const vProd = money(item?.valor);
    const vDesc = money(item?.valorDesconto || 0);

    const vBrutoEsperado = money(qtdCom * vUnCom);
    const vLiquido = money(vProd - vDesc);

    somaProdutos += vProd;
    somaDescontos += vDesc;
    somaLiquidaItens += vLiquido;

    if (!nearlyEqual(qtdCom, qtdTrib, 0.0001)) {
      avisos.push(
        `Item ${nItem}: quantidade comercial difere da tributável.`,
      );
    }

    if (!nearlyEqual(vUnCom, vUnTrib, 0.0001)) {
      avisos.push(
        `Item ${nItem}: valor unitário comercial difere do tributável.`,
      );
    }

    if (!nearlyEqual(vProd, vBrutoEsperado, 0.01)) {
      erros.push(
        `Item ${nItem}: valor bruto do item inválido. valor=${vProd} mas qCom×vUnCom=${vBrutoEsperado}.`,
      );
    }

    if (vDesc < 0) {
      erros.push(`Item ${nItem}: desconto negativo inválido.`);
    }

    if (vDesc > vProd) {
      erros.push(`Item ${nItem}: desconto maior que o valor bruto do item.`);
    }

    const icmsBase = money(item?.tributos?.icms?.baseCalculo?.valor);
    const pisBase = money(item?.tributos?.pis?.baseCalculo?.valor);
    const cofinsBase = money(item?.tributos?.cofins?.baseCalculo?.valor);
    const ipiBase = money(item?.tributos?.ipi?.baseCalculo?.valor);

    if (item?.tributos?.icms?.baseCalculo && !nearlyEqual(icmsBase, vLiquido)) {
      erros.push(
        `Item ${nItem}: base de ICMS inconsistente. base=${icmsBase} líquido=${vLiquido}.`,
      );
    }

    if (item?.tributos?.pis?.baseCalculo && !nearlyEqual(pisBase, vLiquido)) {
      erros.push(
        `Item ${nItem}: base de PIS inconsistente. base=${pisBase} líquido=${vLiquido}.`,
      );
    }

    if (
      item?.tributos?.cofins?.baseCalculo &&
      !nearlyEqual(cofinsBase, vLiquido)
    ) {
      erros.push(
        `Item ${nItem}: base de COFINS inconsistente. base=${cofinsBase} líquido=${vLiquido}.`,
      );
    }

    if (item?.tributos?.ipi?.baseCalculo && !nearlyEqual(ipiBase, vLiquido)) {
      avisos.push(
        `Item ${nItem}: base de IPI difere do líquido do item. base=${ipiBase} líquido=${vLiquido}.`,
      );
    }

    if (!item?.codigo) erros.push(`Item ${nItem}: código do produto ausente.`);
    if (!item?.descricao)
      erros.push(`Item ${nItem}: descrição do produto ausente.`);
    if (!item?.cfop) erros.push(`Item ${nItem}: CFOP ausente.`);
    if (!item?.ncm) avisos.push(`Item ${nItem}: NCM ausente.`);

    logs.push({
      item: nItem,
      codigo: item?.codigo,
      descricao: item?.descricao,
      quantidadeComercial: qtdCom,
      valorUnitarioComercial: vUnCom,
      valorBruto: vProd,
      valorDesconto: vDesc,
      valorLiquido: vLiquido,
      baseICMS: icmsBase,
      basePIS: pisBase,
      baseCOFINS: cofinsBase,
    });
  });

  somaProdutos = money(somaProdutos);
  somaDescontos = money(somaDescontos);
  somaLiquidaItens = money(somaLiquidaItens);

  const valorFrete = money(
    nfe?._meta?.valorFrete ??
    nfe?.total?.valorFrete ??
    0,
  );

  const valorNotaCalculado = money(somaProdutos - somaDescontos + valorFrete);
  const valorNotaEsperado = money(
    nfe?._meta?.valorNotaEsperado ?? valorNotaCalculado,
  );

  const somaPagamentos = money(sum(pagamentos, (p) => p?.valor));
  const somaParcelas = money(sum(parcelas, (p) => p?.valor));

  if (!nearlyEqual(valorNotaCalculado, valorNotaEsperado)) {
    erros.push(
      `Total da nota inconsistente. calculado=${valorNotaCalculado} esperado=${valorNotaEsperado}.`,
    );
  }

  if (
    nfe?._meta?.generatesReceivable !== false &&
    pagamentos.length &&
    !nearlyEqual(somaPagamentos, valorNotaEsperado)
  ) {
    erros.push(
      `Soma dos pagamentos diverge do total da nota. pagamentos=${somaPagamentos} nota=${valorNotaEsperado}.`,
    );
  }

  if (parcelas.length && !nearlyEqual(somaParcelas, valorNotaEsperado)) {
    erros.push(
      `Soma das duplicatas diverge do total da nota. duplicatas=${somaParcelas} nota=${valorNotaEsperado}.`,
    );
  }

  if (nfe?.cobranca && !parcelas.length) {
    erros.push('Bloco de cobrança enviado sem parcelas.');
  }

  if (parcelas.length) {
    const numerosParcelas = new Set();

    parcelas.forEach((p, idx) => {
      const numero = String(p?.numero || '').trim();

      if (!numero) {
        erros.push(`Parcela ${idx + 1}: número da parcela não informado.`);
        return;
      }

      if (numerosParcelas.has(numero)) {
        erros.push(
          `Parcela ${idx + 1}: número da parcela duplicado (${numero}).`,
        );
        return;
      }

      numerosParcelas.add(numero);
    });
  }

  const todosPagamentosAVista =
    pagamentos.length > 0 && pagamentos.every((p) => p?.aVista === true);

  if (todosPagamentosAVista && nfe?.cobranca) {
    erros.push(
      'Pagamento à vista com bloco de cobrança presente. Remova a cobrança para evitar rejeição 853.',
    );
  }

  const resumo = {
    totalProdutos: somaProdutos,
    totalDesconto: somaDescontos,
    totalLiquidoItens: somaLiquidaItens,
    valorFrete,
    valorNotaCalculado,
    valorNotaEsperado,
    somaPagamentos,
    somaParcelas,
    quantidadeItens: itens.length,
  };

  return {
    ok: erros.length === 0,
    erros,
    avisos,
    resumo,
    logs,
  };
}
