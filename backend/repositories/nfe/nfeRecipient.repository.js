// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeRecipient.repository.js — Destinatário NF-e                       ║
// ║ ✔ idIntegracao do pedido/orçamento                                   ║
// ║ ✔ Destinatário + observação/pagto do orçamento                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import customersApi from '../customers/customers.index.js';
import {
  round2,
  toUpperSafe,
  resolveCodigoCidadeIbge,
} from './nfe.utils.js';
import {
  splitPhone,
  sanitizeCep,
  montarLogradouroNfe,
  formatDateBR,
  formatMoneyBR,
} from './nfe.sanitizers.js';
import {
  resolveOrderIdForNfe,
} from './nfeNumbering.repository.js';

/* =========================================================================
 * 🧱 Helpers integração / destinatário / observação
 * ========================================================================= */
export function buildIdIntegracaoFromOrder(header = {}) {
  const orderId = resolveOrderIdForNfe(header);
  const budgetId = header.budget_id ?? null;
  const bonusId = header.bonus_id ?? null;
  const orderNumber =
    header.number ??
    header.order_number ??
    null;

  const nfeStatus = toUpperSafe(
    header.nfe_status ??
    header.nfeStatus,
  );

  if (
    orderId &&
    ['REJEITADA', 'REJEITADO'].includes(nfeStatus)
  ) {
    return `ORD-${orderId}-R${Date.now()}`;
  }

  if (orderId) {
    return `ORD-${orderId}`;
  }

  if (budgetId) {
    return `BUD-${budgetId}`;
  }

  if (bonusId) {
    return `BON-${bonusId}`;
  }

  if (orderNumber) {
    return `ORDNUM-${orderNumber}`;
  }

  return `ERP${Date.now()}`;
}

export async function buildDestinatarioFromOrderHeader(
  header,
  { docDest, ieRaw, isNaoContribuinte },
) {
  let customer = null;

  if (header.customer_id) {
    try {
      customer = await customersApi.getById(
        header.customer_id,
      );
    } catch (error) {
      console.error(
        '[NFE] Falha ao carregar customer via customersApi.getById:',
        error.message || error,
      );
    }
  }

  const c = customer || {};

  /*
   * Razão social:
   * 1. Legal name;
   * 2. Legal name saved in the order;
   * 3. Customer name saved in the order;
   * 4. Trade name only as fallback.
   */
  const razaoSocial = (
    c.legal_name ||
    header.customer_legal_name ||
    header.customer_name ||
    c.trade_name ||
    'CONSUMIDOR FINAL'
  )
    .toString()
    .trim()
    .toUpperCase();

  const ieDb = String(
    c.state_registration || '',
  ).trim();

  const ieFinalRaw = String(
    ieRaw || ieDb || '',
  ).trim();

  const ieValida =
    Boolean(ieFinalRaw) &&
    !/^ISENTO$/i.test(ieFinalRaw);

  const indicadorIEDestinatario = ieValida
    ? '1'
    : isNaoContribuinte
      ? '9'
      : '9';

  const tipoLogradouro =
    c.street_type ||
    c.address_type ||
    c.tipo_logradouro ||
    c.logradouro_tipo ||
    header.customer_street_type ||
    header.tipo_logradouro ||
    '';

  const nomeLogradouro =
    c.street_name ||
    c.address ||
    c.logradouro ||
    header.customer_street ||
    header.customer_address ||
    '';

  const logradouro =
    montarLogradouroNfe(
      tipoLogradouro,
      nomeLogradouro,
    ) || 'AVENIDA';

  const numero = String(
    c.street_number ||
    header.customer_number ||
    '0',
  )
    .trim()
    .toUpperCase();

  const bairro = String(
    c.neighborhood ||
    header.customer_neighborhood ||
    'CENTRO',
  )
    .trim()
    .toUpperCase();

  const cidade = String(
    c.city ||
    header.customer_city ||
    'BELO HORIZONTE',
  )
    .trim()
    .toUpperCase();

  const uf = String(
    c.state ||
    header.customer_state ||
    'MG',
  )
    .trim()
    .toUpperCase();

  const cep =
    sanitizeCep(
      c.postal_code ||
      header.customer_zip,
    ) || '30170012';

  const codigoCidade = resolveCodigoCidadeIbge(
    uf,
    cidade,
    c,
    header,
  );

  const telefoneSplit = splitPhone(
    c.mobile_number ||
    c.phone_number ||
    header.customer_mobile ||
    header.customer_phone ||
    '',
  );

  const destinatario = {
    cpfCnpj: docDest,
    razaoSocial,
    indicadorIEDestinatario,

    ...(ieValida
      ? {
        inscricaoEstadual:
          ieFinalRaw.replace(/\D/g, ''),
      }
      : {}),

    ...(telefoneSplit
      ? {
        telefone: telefoneSplit,
      }
      : {}),

    endereco: {
      logradouro,
      numero,
      bairro,
      codigoCidade,
      descricaoCidade: cidade,
      estado: uf,
      cep,
      codigoPais: '1058',
    },
  };

  /*
   * Diagnóstico temporário:
   * mostra a origem do nome e o destinatário montado
   * antes do envio para PlugNotas.
   */
  console.log(
    '[NFE][DESTINATARIO][ANTES DO ENVIO]',
    {
      customerId:
        header.customer_id ?? null,

      legalNameCadastro:
        c.legal_name ?? null,

      tradeNameCadastro:
        c.trade_name ?? null,

      legalNamePedido:
        header.customer_legal_name ?? null,

      customerNamePedido:
        header.customer_name ?? null,

      razaoSocialEnviada:
        destinatario.razaoSocial,

      cpfCnpjEnviado:
        destinatario.cpfCnpj,

      inscricaoEstadualEnviada:
        destinatario.inscricaoEstadual ?? null,

      ambiente:
        process.env.NODE_ENV ?? null,
    },
  );

  return destinatario;
}

export async function loadBudgetObservation(budgetId) {
  if (!budgetId) return null;

  try {
    const { rows } = await pool.query(
      `
      SELECT COALESCE(notes, '') AS observation
      FROM public."budgets"
      WHERE budget_id = $1
      LIMIT 1
      `,
      [budgetId],
    );

    if (!rows.length) return null;

    const obs = String(rows[0].observation || '').trim();
    return obs || null;
  } catch (err) {
    console.error('[NFE] Erro ao buscar observação do orçamento:', err.message || err);
    return null;
  }
}

export async function loadBudgetPaymentDescription(budgetId) {
  if (!budgetId) return null;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        bp.budget_payment_id,
        bp.amount,
        bp.notes,
        pm.name AS payment_method_name,
        pm.type AS payment_method_type,
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

      if (!grouped.has(paymentId)) {
        grouped.set(paymentId, {
          methodName: String(
            row.payment_method_name ||
            row.payment_method_type ||
            'FORMA NÃO INFORMADA',
          ).trim(),
          amount: round2(row.amount || 0),
          notes: String(row.notes || '').trim(),
          installments: [],
        });
      }

      if (
        row.installment_number != null ||
        row.due_date != null ||
        row.installment_amount != null
      ) {
        grouped.get(paymentId).installments.push({
          installment_number:
            row.installment_number != null
              ? Number(row.installment_number)
              : null,
          due_date: row.due_date,
          amount: round2(row.installment_amount || 0),
        });
      }
    }

    const paymentHeaders = [];
    const installmentLines = [];

    for (const [, payment] of grouped) {
      let header = `${payment.methodName} - ${formatMoneyBR(payment.amount)}`;

      if (payment.notes) {
        header += ` (${payment.notes})`;
      }

      paymentHeaders.push(header);

      for (const inst of payment.installments) {
        const parcela = String(inst.installment_number || 1).padStart(3, '0');
        const venc = formatDateBR(inst.due_date);
        const valor = formatMoneyBR(inst.amount || 0);

        installmentLines.push(
          `PARCELA ${parcela}${venc ? ` - VENC.: ${venc}` : ''} - VALOR: ${valor}`,
        );
      }
    }

    const partes = [];

    if (paymentHeaders.length) {
      partes.push(`FORMA DE PAGAMENTO: ${paymentHeaders.join(' | ')}`);
    }

    if (installmentLines.length) {
      partes.push(`DUPLICATAS: ${installmentLines.join(' | ')}`);
    }

    return partes.join(' | ');
  } catch (err) {
    console.error(
      '[NFE] Erro ao buscar descrição dos pagamentos do orçamento:',
      err.message || err,
    );
    return null;
  }
}
