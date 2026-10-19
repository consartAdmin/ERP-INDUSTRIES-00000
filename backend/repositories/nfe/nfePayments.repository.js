// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfePayments.repository.js — Pagamentos / Cobrança                    ║
// ║ ✔ tPag, meios de pagamento, parcelas                                 ║
// ║ ✔ Pagamentos reais do orçamento                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import paymentMethodsApi from '../paymentMethods/paymentMethods.index.js';
import {
  round2,
  sum,
} from './nfe.utils.js';
import {
  formatLocalISODate,
  isValidDateObj,
  parseDateOrNull,
  addDays,
  formatDateBR,
  formatMoneyBR,
} from './nfe.sanitizers.js';

/* =========================================================================
 * 💳 Pagamentos
 * ========================================================================= */
export function normalizePaymentType(type) {
  if (!type) return '';
  return type
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

export function deriveTpagFromMethodAndHeader({ metodo }) {
  const code = String(metodo?.nfe_tpag || '').padStart(2, '0');

  if (code && code !== '00' && code !== 'NaN') {
    return code;
  }

  console.warn('[NFE] nfe_tpag inválido, fallback para 99:', metodo);
  return '99';
}

export function getDescricaoPadraoMeio(meio) {
  switch (String(meio || '')) {
    case '01':
      return 'DINHEIRO';
    case '02':
      return 'CHEQUE';
    case '03':
      return 'CARTÃO DE CRÉDITO';
    case '04':
      return 'CARTÃO DE DÉBITO';
    case '05':
      return 'CRÉDITO LOJA';
    case '10':
      return 'VALE ALIMENTAÇÃO';
    case '11':
      return 'VALE REFEIÇÃO';
    case '12':
      return 'VALE PRESENTE';
    case '13':
      return 'VALE COMBUSTÍVEL';
    case '15':
      return 'BOLETO BANCÁRIO';
    case '16':
      return 'DEPÓSITO BANCÁRIO';
    case '17':
      return 'PIX';
    case '18':
      return 'TRANSFERÊNCIA BANCÁRIA';
    case '19':
      return 'PROGRAMA FIDELIDADE';
    case '90':
      return 'SEM PAGAMENTO';
    default:
      return 'OUTROS MEIOS DE PAGAMENTO';
  }
}

export const paymentMethodsCache = new Map();

export async function getPaymentMethodByIdCached(termId) {
  const id = Number(termId || 0);
  if (!Number.isFinite(id) || id <= 0) return null;

  if (paymentMethodsCache.has(id)) {
    return paymentMethodsCache.get(id);
  }

  try {
    const metodo = await paymentMethodsApi.getById(id);
    if (metodo) {
      paymentMethodsCache.set(id, metodo);
    }
    return metodo;
  } catch (e) {
    console.error(
      '[NFE] Falha ao carregar paymentMethods via API:',
      e.message || e,
    );
    return null;
  }
}

export async function buildPagamentosFromOrderHeader(
  header,
  valorNotaCalculado,
  totalFaturaOverride,
) {
  const totalHeader = Number(header.total_amount ?? NaN);

  const valorTotal = Number.isFinite(totalFaturaOverride)
    ? Number(totalFaturaOverride)
    : Number.isFinite(totalHeader)
      ? totalHeader
      : Number(valorNotaCalculado || 0);

  let metodo = null;
  if (header.payment_term_id) {
    metodo = await getPaymentMethodByIdCached(header.payment_term_id);
  }

  const meio = deriveTpagFromMethodAndHeader({ metodo, header });

  const rawType = (metodo?.type || '').toString();
  const normType = normalizePaymentType(rawType);
  const aVista =
    normType === 'AVISTA' ||
    String(meio) === '90';

  let descricaoMeio = (
    metodo?.name ||
    metodo?.description ||
    metodo?.title ||
    metodo?.label ||
    header.payment_description ||
    header.payment_method_name ||
    header.payment_form_name ||
    header.payment_term_name ||
    ''
  )
    .toString()
    .trim();

  if (!descricaoMeio) {
    descricaoMeio = getDescricaoPadraoMeio(meio);
  }

  const pagamento = {
    aVista,
    meio,
    valor: round2(valorTotal),
  };

  if (descricaoMeio && meio === '99') {
    pagamento.descricaoMeio = descricaoMeio;
  }

  return [pagamento];
}

/* =========================================================================
 * 💳 Cobrança / Duplicatas
 * ========================================================================= */
export function isBoletoManual(metodo) {
  if (!metodo) return false;
  const name = (metodo.name || metodo.nome || '').toString().toUpperCase();
  return name.includes('BOLETO MANUAL');
}

export function pickManualDueDateFromHeader(header = {}) {
  return (
    parseDateOrNull(header.manual_due_date) ||
    parseDateOrNull(header.manualDueDate) ||
    parseDateOrNull(header.due_date) ||
    parseDateOrNull(header.dueDate) ||
    parseDateOrNull(header.first_due_date) ||
    parseDateOrNull(header.firstDueDate) ||
    parseDateOrNull(header.data_vencimento) ||
    parseDateOrNull(header.dataVencimento) ||
    parseDateOrNull(header.vencimento) ||
    parseDateOrNull(header.payment_due_date)
  );
}

export function normalizeInstallmentNumber(v, fallback = 1) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function normalizeDueIso(v) {
  const d = parseDateOrNull(v);
  return d ? formatLocalISODate(d) : null;
}

export function normalizeCobrancaToTotal(cobranca, total) {
  if (!cobranca) return null;

  const totalFinal = round2(Number(total || 0));
  if (!Number.isFinite(totalFinal) || totalFinal <= 0) return null;

  const parcelasOriginais = Array.isArray(cobranca.parcelas)
    ? cobranca.parcelas
    : [];

  if (!parcelasOriginais.length) {
    return {
      ...cobranca,
      valorTotal: totalFinal,
      valorLiquido: totalFinal,
      parcelas: [],
    };
  }

  const parcelas = parcelasOriginais.map((p, idx) => ({
    ...p,
    numero: String(p?.numero || idx + 1).padStart(3, '0'),
    valor: round2(Number(p?.valor || 0)),
  }));

  const parcelasBalanceadas = rebalanceParcelasToTotal(parcelas, totalFinal);

  return {
    ...cobranca,
    valorTotal: totalFinal,
    valorLiquido: totalFinal,
    parcelas: parcelasBalanceadas,
  };
}

export function rebalanceParcelasToTotal(parcelas = [], total = 0) {
  if (!Array.isArray(parcelas) || !parcelas.length) return [];

  const cloned = parcelas.map((p) => ({
    ...p,
    valor: round2(Number(p.valor || 0)),
  }));

  const totalTarget = round2(total);
  const somaAtual = round2(cloned.reduce((s, p) => s + Number(p.valor || 0), 0));
  const diff = round2(totalTarget - somaAtual);

  if (Math.abs(diff) >= 0.01) {
    const last = cloned[cloned.length - 1];
    last.valor = round2(Number(last.valor || 0) + diff);
  }

  return cloned;
}

export function isMeioAVistaByTpag(meio) {
  return ['01', '02', '03', '04', '17'].includes(String(meio || ''));
  // 01 dinheiro
  // 02 cheque
  // 03 cartão crédito
  // 04 cartão débito
  // 17 PIX
}

export function isMetodoAVista(metodo) {
  if (!metodo) return false;

  const typeNorm = normalizePaymentType(metodo.type || '');
  const meio = deriveTpagFromMethodAndHeader({ metodo });

  const installments = Math.max(1, Number(metodo.installments || 1));

  if (typeNorm === 'AVISTA') return true;
  if (String(meio) === '90') return true; // sem pagamento
  if (installments <= 1 && isMeioAVistaByTpag(meio)) return true;

  return false;
}

export function shouldGenerateCobranca({ metodo, parcelas = [] } = {}) {
  if (Array.isArray(parcelas) && parcelas.length > 1) return true;

  if (Array.isArray(parcelas) && parcelas.length === 1) {
    const p = parcelas[0];
    if (p?.dataVencimento) return true;
  }

  if (!metodo) return false;

  if (isMetodoAVista(metodo)) return false;

  const installments = Math.max(1, Number(metodo.installments || 1));
  if (installments > 1) return true;

  return isBoletoManual(metodo);
}

export async function buildCobrancaFromOrderHeader(header, totalFallback, emissaoDateObj) {
  const totalHeader = Number(header.total_amount ?? NaN);
  const total = Number.isFinite(totalHeader)
    ? totalHeader
    : Number(totalFallback || 0);

  if (!Number.isFinite(total) || total <= 0) return null;

  const emissao = emissaoDateObj || new Date();

  let metodo = null;
  if (header.payment_term_id) {
    metodo = await getPaymentMethodByIdCached(header.payment_term_id);
  }

  // ✅ NOVO: não gerar cobrança para pagamento à vista
  if (!shouldGenerateCobranca({ metodo })) {
    return null;
  }

  const numeroFatura = String(header.order_id || header.number || '').padStart(3, '0');

  if (metodo && isBoletoManual(metodo)) {
    const dueFromHeader = pickManualDueDateFromHeader(header);

    if (!dueFromHeader) {
      console.warn(
        '[NFE] BOLETO MANUAL sem data de vencimento no header — usando fallback D+10.',
      );
    }

    const venc = dueFromHeader || addDays(emissao, 10);

    if (!isValidDateObj(venc)) {
      throw new Error(
        `[NFE] Vencimento inválido para BOLETO MANUAL. manual_due_date=${JSON.stringify(
          header.manual_due_date ||
          header.manualDueDate ||
          header.due_date ||
          header.dueDate ||
          header.first_due_date ||
          header.firstDueDate ||
          header.data_vencimento ||
          header.dataVencimento ||
          header.vencimento ||
          header.payment_due_date,
        )}`,
      );
    }

    return {
      numero: numeroFatura,
      valorTotal: round2(total),
      valorLiquido: round2(total),
      parcelas: [
        {
          numero: '001',
          dataVencimento: formatLocalISODate(venc),
          valor: round2(total),
        },
      ],
    };
  }

  if (!metodo) {
    // ✅ Sem método: por segurança, não monta cobrança automática
    return null;
  }

  const installments = Math.max(1, Number(metodo.installments || 1));

  const g1 = Number(metodo.gap_one || 0);
  const g2 = Number(metodo.gap_two || 0);
  const g3 = Number(metodo.gap_three || 0);
  const g4 = Number(metodo.gap_four || 0);

  const gapsConfigurados = [g1, g2, g3, g4].filter((d) => d > 0);
  const parcelasDias = [];

  if (!gapsConfigurados.length) {
    for (let i = 0; i < installments; i++) parcelasDias.push(0);
  } else if (gapsConfigurados.length >= installments) {
    for (let i = 0; i < installments; i++) parcelasDias.push(gapsConfigurados[i]);
  } else if (gapsConfigurados.length === 1) {
    const base = gapsConfigurados[0];
    for (let i = 1; i <= installments; i++) parcelasDias.push(base * i);
  } else {
    const last = gapsConfigurados[gapsConfigurados.length - 1];
    for (let i = 0; i < installments; i++) {
      parcelasDias.push(gapsConfigurados[i] ?? last);
    }
  }

  const parcelas = [];
  let soma = 0;
  const baseParcela = round2(total / installments);

  parcelasDias.forEach((dias, idx) => {
    const venc = addDays(emissao, dias);
    let valor = baseParcela;

    if (!isValidDateObj(venc)) {
      throw new Error(
        `[NFE] Data de vencimento inválida na parcela ${idx + 1}. emissao=${JSON.stringify(
          emissao instanceof Date ? emissao.toISOString?.() || String(emissao) : emissao,
        )}, dias=${JSON.stringify(dias)}, payment_term_id=${JSON.stringify(
          header.payment_term_id,
        )}`,
      );
    }

    const numero = String(idx + 1).padStart(3, '0');
    parcelas.push({
      numero,
      dataVencimento: formatLocalISODate(venc),
      valor,
    });
    soma += valor;
  });

  const diff = round2(total - soma);
  if (Math.abs(diff) >= 0.01) {
    const last = parcelas[parcelas.length - 1];
    last.valor = round2(last.valor + diff);
  }

  return {
    numero: numeroFatura,
    valorTotal: round2(total),
    valorLiquido: round2(total),
    parcelas,
  };
}

/* =========================================================================
 * 💳 Pagamentos reais do orçamento
 * ========================================================================= */
export async function loadBudgetPaymentsForNfe(
  budgetId,
  totalFallback = 0,
  realIssueDateObj,
) {
  if (!budgetId) return null;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        bp.budget_payment_id,
        bp.payment_method_id,
        bp.amount,
        bp.notes,
        pm.name AS payment_method_name,
        pm.type AS payment_method_type,
        pm.nfe_tpag AS payment_method_nfe_tpag,
        pm.installments AS payment_method_installments,
        pm.gap_one,
        pm.gap_two,
        pm.gap_three,
        pm.gap_four,
        bpi.installment_number,
        bpi.amount AS installment_amount,
        bpi.due_date
      FROM public."budgetsPayments" bp
      LEFT JOIN public."paymentMethods" pm
        ON pm."paymentMethods_id" = bp.payment_method_id
      LEFT JOIN public."budgetsPaymentInstallments" bpi
        ON bpi.budget_payment_id = bp.budget_payment_id
      WHERE bp.budget_id = $1
      ORDER BY
        bp.budget_payment_id ASC,
        bpi.installment_number ASC NULLS LAST,
        bpi.due_date ASC NULLS LAST
      `,
      [budgetId],
    );

    if (!rows.length) return null;

    const grouped = new Map();

    for (const row of rows) {
      const paymentId = Number(row.budget_payment_id);

      if (!Number.isFinite(paymentId) || paymentId <= 0) continue;

      if (!grouped.has(paymentId)) {
        grouped.set(paymentId, {
          budget_payment_id: paymentId,
          payment_method_id: row.payment_method_id,
          payment_method_name: String(
            row.payment_method_name ||
            row.payment_method_type ||
            'FORMA NÃO INFORMADA',
          ).trim(),
          payment_method_type: String(row.payment_method_type || '').trim(),
          payment_method_nfe_tpag: row.payment_method_nfe_tpag,
          amount: round2(row.amount || 0),
          notes: String(row.notes || '').trim(),
          installments_expected: Math.max(
            0,
            Number(row.payment_method_installments || 0),
          ),
          gap_one: Number(row.gap_one || 0),
          gap_two: Number(row.gap_two || 0),
          gap_three: Number(row.gap_three || 0),
          gap_four: Number(row.gap_four || 0),
          installments: [],
        });
      }

      if (
        row.installment_number != null ||
        row.due_date != null ||
        row.installment_amount != null
      ) {
        grouped.get(paymentId).installments.push({
          installment_number: normalizeInstallmentNumber(
            row.installment_number,
            grouped.get(paymentId).installments.length + 1,
          ),
          due_date: row.due_date,
          amount: round2(row.installment_amount || 0),
        });
      }
    }

    const pagamentos = [];
    const parcelas = [];

    for (const [, payment] of grouped) {
      const metodoVirtual = {
        name: payment.payment_method_name,
        type: payment.payment_method_type,
        nfe_tpag: payment.payment_method_nfe_tpag,
        installments: payment.installments_expected,
        gap_one: payment.gap_one,
        gap_two: payment.gap_two,
        gap_three: payment.gap_three,
        gap_four: payment.gap_four,
      };

      const meio = deriveTpagFromMethodAndHeader({
        metodo: metodoVirtual,
        header: {},
      });

      const installmentsCount = Array.isArray(payment.installments)
        ? payment.installments.length
        : 0;

      const typeNorm = normalizePaymentType(payment.payment_method_type);
      const aVista =
        typeNorm === 'AVISTA' ||
        String(meio) === '90';

      const pagamento = {
        aVista,
        meio,
        valor: round2(payment.amount || 0),
      };

      if (meio === '99' && payment.payment_method_name) {
        pagamento.descricaoMeio = payment.payment_method_name;
      }

      pagamentos.push(pagamento);

      /* ---------------------------------------------------------------
       * Parcelas reais gravadas no orçamento
       * Regra: se a parcela já tem due_date no banco, usa EXATAMENTE ela.
       * Não recalcula em função de "hoje".
       * --------------------------------------------------------------- */
      if (installmentsCount > 0) {
        for (const inst of payment.installments) {
          const dueIso = normalizeDueIso(inst.due_date);

          parcelas.push({
            numero: '000', // será renumerado depois
            ...(dueIso ? { dataVencimento: dueIso } : {}),
            valor: round2(inst.amount || 0),
          });
        }
        continue;
      }

      /* ---------------------------------------------------------------
       * Fallback: pagamento a prazo sem parcelas salvas
       * Monta com base na configuração do método de pagamento
       * --------------------------------------------------------------- */
      const shouldCreateFallbackInstallments =
        !aVista &&
        Math.max(1, Number(payment.installments_expected || 0)) > 1;

      if (shouldCreateFallbackInstallments) {
        const installmentsExpected = Math.max(
          1,
          Number(payment.installments_expected || 1),
        );

        const gapsConfigurados = [
          Number(payment.gap_one || 0),
          Number(payment.gap_two || 0),
          Number(payment.gap_three || 0),
          Number(payment.gap_four || 0),
        ].filter((d) => d > 0);

        const parcelasDias = [];

        if (!gapsConfigurados.length) {
          for (let i = 0; i < installmentsExpected; i++) {
            parcelasDias.push(0);
          }
        } else if (gapsConfigurados.length >= installmentsExpected) {
          for (let i = 0; i < installmentsExpected; i++) {
            parcelasDias.push(gapsConfigurados[i]);
          }
        } else if (gapsConfigurados.length === 1) {
          const base = gapsConfigurados[0];
          for (let i = 1; i <= installmentsExpected; i++) {
            parcelasDias.push(base * i);
          }
        } else {
          const last = gapsConfigurados[gapsConfigurados.length - 1];
          for (let i = 0; i < installmentsExpected; i++) {
            parcelasDias.push(gapsConfigurados[i] ?? last);
          }
        }

        let somaParcelasFallback = 0;
        const valorBase = round2(payment.amount / installmentsExpected);

        parcelasDias.forEach((dias, idx) => {
          const venc = addDays(realIssueDateObj, dias);
          let valorParcela = valorBase;

          if (idx === installmentsExpected - 1) {
            valorParcela = round2(payment.amount - somaParcelasFallback);
          }

          somaParcelasFallback = round2(somaParcelasFallback + valorParcela);

          parcelas.push({
            numero: '000',
            ...(venc ? { dataVencimento: formatLocalISODate(venc) } : {}),
            valor: round2(valorParcela),
          });
        });
      }
    }

    const totalFallbackFinal = round2(totalFallback);
    const totalPagamentos = round2(sum(pagamentos, (p) => p.valor));

    const totalRef =
      totalFallbackFinal > 0
        ? totalFallbackFinal
        : totalPagamentos > 0
          ? totalPagamentos
          : 0;

    const existePagamentoAPrazo = pagamentos.some((p) => p?.aVista === false);

    let cobranca = null;

    if (parcelas.length && existePagamentoAPrazo) {
      const parcelasSequenciais = parcelas.map((p, index) => ({
        ...p,
        numero: String(index + 1).padStart(3, '0'),
        valor: round2(p.valor || 0),
      }));

      const parcelasBalanced = rebalanceParcelasToTotal(
        parcelasSequenciais,
        totalRef,
      );

      cobranca = {
        numero: String(budgetId).padStart(3, '0'),
        valorTotal: round2(totalRef),
        valorLiquido: round2(totalRef),
        parcelas: parcelasBalanced,
      };
    }

    if (pagamentos.length && totalRef > 0) {
      const somaPag = round2(sum(pagamentos, (p) => p.valor));
      const diffPag = round2(totalRef - somaPag);

      if (Math.abs(diffPag) >= 0.01) {
        pagamentos[pagamentos.length - 1].valor = round2(
          Number(pagamentos[pagamentos.length - 1].valor || 0) + diffPag,
        );
      }
    }

    return {
      pagamentos,
      cobranca,
    };
  } catch (err) {
    console.error(
      '[NFE] Erro ao carregar pagamentos reais do orçamento:',
      err.message || err,
    );
    return null;
  }
}

export function buildPaymentDescriptionFromPayload(pagamentos = [], cobranca = null) {
  const partes = [];

  if (Array.isArray(pagamentos) && pagamentos.length) {
    const headers = pagamentos.map((p) => {
      const desc = p.descricaoMeio || getDescricaoPadraoMeio(p.meio);
      return `${desc} - ${formatMoneyBR(p.valor || 0)}`;
    });

    if (headers.length) {
      partes.push(`FORMA DE PAGAMENTO: ${headers.join(' | ')}`);
    }
  }

  const parcelas = Array.isArray(cobranca?.parcelas) ? cobranca.parcelas : [];
  if (parcelas.length) {
    const linhas = parcelas.map((p, idx) => {
      const parcela = String(p.numero || idx + 1).padStart(3, '0');
      const venc = formatDateBR(p.dataVencimento);
      const valor = formatMoneyBR(p.valor || 0);
      return `PARCELA ${parcela}${venc ? ` - VENC.: ${venc}` : ''} - VALOR: ${valor}`;
    });

    partes.push(`DUPLICATAS: ${linhas.join(' | ')}`);
  }

  return partes.join(' | ');
}

export function sameIsoDate(a, b) {
  const da = String(a || '').slice(0, 10);
  const db = String(b || '').slice(0, 10);
  return !!da && !!db && da === db;
}

export function getParcelasFromCobranca(cobranca) {
  return Array.isArray(cobranca?.parcelas) ? cobranca.parcelas : [];
}

export function isPagamentoAVistaReal(cobranca, emissaoISO) {
  const parcelas = getParcelasFromCobranca(cobranca);

  if (!parcelas.length) return true;

  if (parcelas.length === 1) {
    const venc = parcelas[0]?.dataVencimento || '';
    if (sameIsoDate(venc, emissaoISO)) return true;
  }

  return false;
}
