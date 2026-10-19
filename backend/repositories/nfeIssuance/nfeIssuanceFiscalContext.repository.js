// ╔══════════════════════════════════════════════════════════╗
// ║ nfeIssuanceFiscalContext.repository.js — contexto fiscal ║
// ║ modo de estoque, operação fiscal, cliente e emitente     ║
// ╚══════════════════════════════════════════════════════════╝

import { getBudgetObjectById } from '../../controllers/budgetsController.js';
import pool from '../../config/db.js';
import customersApi from '../../repositories/customers/customers.index.js';
import {
  resolveFeature,
} from '../appFeatures/appFeatures.index.js';
import { positiveInteger, digits, unwrapCustomer } from './nfeIssuance.utils.js';

export async function resolveActiveStockMode() {
  const feature = await resolveFeature({
    featureCode: 'PRODUCT_STOCK_MODE',
    scopeType: 'GLOBAL',
    scopeId: 1,
  });

  if (!feature) {
    throw new Error(
      '[BUDGET NFE] Feature PRODUCT_STOCK_MODE não cadastrada.'
    );
  }

  if (!feature.enabled) {
    throw new Error(
      '[BUDGET NFE] Feature PRODUCT_STOCK_MODE desativada.'
    );
  }

  const mode = String(
    feature.optionCode || ''
  )
    .trim()
    .toUpperCase();

  const isSimple =
    mode === 'STOCK_SIMPLE';

  const isWithLot =
    mode === 'STOCK_WITH_LOT';

  if (!isSimple && !isWithLot) {
    throw new Error(
      `[BUDGET NFE] PRODUCT_STOCK_MODE inválido: "${mode}".`
    );
  }

  return {
    mode,
    isSimple,
    isWithLot,
    requireLot: isWithLot,
    feature,
  };
}

async function getSelectedFiscalOperation(operationTypeId, customerState) {
  const id = positiveInteger(operationTypeId);
  if (!id) {
    const error = new Error('Selecione a operação fiscal do orçamento antes de emitir a NF-e.');
    error.status = 422;
    error.code = 'BUDGET_OPERATION_TYPE_REQUIRED';
    throw error;
  }

  const { rows } = await pool.query(
    `
      SELECT operation_type_id, code, name, nature_operation,
             cfop_internal, cfop_interstate,
             generates_receivable, moves_stock, active
      FROM public."nfeOperationTypes"
      WHERE operation_type_id = $1
        AND active = TRUE
      LIMIT 1
    `,
    [id],
  );

  const operation = rows[0];
  if (!operation) {
    const error = new Error('A operação fiscal selecionada não existe ou está inativa.');
    error.status = 422;
    error.code = 'BUDGET_OPERATION_TYPE_INVALID';
    throw error;
  }

  const issuerState = String(
    process.env.NFE_EMPRESA_UF || process.env.EMPRESA_UF || '',
  ).trim().toUpperCase();
  const destinationState = String(customerState || '').trim().toUpperCase();

  if (!issuerState) {
    const error = new Error('Configure NFE_EMPRESA_UF no .env para selecionar o CFOP da operação.');
    error.status = 500;
    error.code = 'NFE_ISSUER_STATE_NOT_CONFIGURED';
    throw error;
  }

  const isInternal = issuerState === destinationState;
  const cfop = isInternal ? operation.cfop_internal : operation.cfop_interstate;
  const code = String(operation.code || '').trim().toUpperCase();
  const forceCfop = ['BONUS', 'DEVOLUCAO', 'TRANSFERENCIA', 'REMESSA'].some(
    (prefix) => code === prefix || code.startsWith(`${prefix}_`),
  );

  if (forceCfop && !/^\d{4}$/.test(String(cfop || ''))) {
    const error = new Error(
      `A operação ${operation.code} não possui CFOP ${isInternal ? 'interno' : 'interestadual'} configurado.`,
    );
    error.status = 422;
    error.code = 'BUDGET_OPERATION_CFOP_MISSING';
    throw error;
  }

  return {
    operation_type_id: Number(operation.operation_type_id),
    code: operation.code,
    name: operation.name,
    nature_operation: operation.nature_operation,
    cfop: cfop || null,
    cfop_internal: operation.cfop_internal,
    cfop_interstate: operation.cfop_interstate,
    force_cfop: forceCfop,
    generates_receivable: Boolean(operation.generates_receivable),
    moves_stock: Boolean(operation.moves_stock),
  };
}

function findIbgeCode(...sources) {
  const keys = [
    'ibge_city_code',
    'city_ibge_code',
    'ibge_code',
    'codigo_ibge',
    'code_ibge',
    'city_ibge',
    'municipio_ibge',
    'ibge',
  ];

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;

    for (const key of keys) {
      const code = digits(source[key]);
      if (code.length === 7) return code;
    }
  }

  return null;
}

async function getCustomerFiscalData(customerId) {
  const id = positiveInteger(customerId);
  if (!id) return {};

  let customer = {};

  try {
    customer = unwrapCustomer(await customersApi.getById(id));
  } catch (error) {
    console.warn('[nfeIssuanceApi][budgetCustomer]', error?.message || error);
  }

  let ibgeData = {};

  try {
    const { rows } = await pool.query(
      `
        SELECT to_jsonb(ci) AS data
          FROM public."customersIbge" ci
         WHERE ci.customer_id = $1
         LIMIT 1
      `,
      [id],
    );
    ibgeData = rows[0]?.data || {};
  } catch (error) {
    // Some installations return IBGE directly from customersApi and do not
    // have the auxiliary table. In that case the API result remains valid.
    if (error?.code !== '42P01') {
      console.warn('[nfeIssuanceApi][budgetCustomerIbge]', error?.message || error);
    }
  }

  const ibgeCode = findIbgeCode(customer, ibgeData);

  return {
    customer_id: id,
    customer_legal_name: customer.legal_name || null,
    customer_name: customer.legal_name || customer.trade_name || null,
    customer_tax_id: customer.tax_id || null,
    customer_email: customer.email || null,
    customer_phone: customer.mobile_number || customer.phone_number || null,
    customer_mobile: customer.mobile_number || null,
    customer_zip: customer.postal_code || null,
    customer_street_type: customer.street_type || null,
    customer_street: customer.street_name || null,
    customer_number: customer.street_number || null,
    customer_complement: customer.address_complement || null,
    customer_neighborhood: customer.neighborhood || null,
    customer_city: customer.city || null,
    customer_state: customer.state || null,
    state_registration: customer.state_registration || null,
    ibge_code: ibgeCode,
    customer_ibge_code: ibgeCode,
    ibge_city_code: ibgeCode,
  };
}

export async function getBudgetIssuedData(budgetId) {
  const id = positiveInteger(budgetId);

  if (!id) {
    const error = new Error('ID de orçamento inválido.');
    error.status = 400;
    throw error;
  }

  const budget = await getBudgetObjectById(id);

  if (!budget) {
    const error = new Error('Orçamento não encontrado.');
    error.status = 404;
    throw error;
  }

  const customer = await getCustomerFiscalData(budget.customer_id);
  const operation = await getSelectedFiscalOperation(
    budget.operation_type_id,
    customer.customer_state || budget.customer_state,
  );

  return {
    ...budget,
    ...Object.fromEntries(
      Object.entries(customer).filter(([, value]) => value !== null && value !== ''),
    ),
    budget_id: Number(budget.budget_id ?? budget.id ?? id),
    operation_type_id: operation.operation_type_id,
    fiscal_operation: operation,
    operation_cfop: operation.cfop,
    nature_operation: operation.nature_operation,
    generates_receivable: operation.generates_receivable,
    moves_stock: operation.moves_stock,
    items: Array.isArray(budget.items) ? budget.items : [],
    payments: Array.isArray(budget.payments) ? budget.payments : [],
    payment_installments: Array.isArray(budget.payment_installments)
      ? budget.payment_installments
      : [],
    shipping: budget.shipping || null,
  };
}
