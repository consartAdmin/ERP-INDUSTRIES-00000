// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalApuracaoService.js                                       ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ CONSART ERP                                                          ║
// ║ SERVICE LAYER                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';

import {
  insertFiscalApuracao,
  updateFiscalApuracaoStatus,
  getFiscalApuracaoByPeriod,
  getFiscalApuracaoHeaderById,
  listFiscalApuracoes,
  listFiscalApuracaoDocuments,
  listFiscalApuracaoItems,
  upsertFiscalApuracaoSummary,
  getFiscalApuracaoSummaryByApuracaoId,
  listFiscalApuracaoReconciliation,
  deleteFiscalApuracaoById
} from '../repositories/fiscalApuracao/fiscalApuracao.index.js';


/* ======================================================================
   HELPERS
   ====================================================================== */

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildReferenceFromPeriod(dateFrom) {
  const d = new Date(`${dateFrom}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date_from');
  }

  return {
    reference_month: d.getMonth() + 1,
    reference_year: d.getFullYear()
  };
}

function isValidId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0;
}

async function safeRollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    console.error('fiscalApuracaoService rollback error:', rollbackError);
  }
}

function getItemDirection(item) {
  const taxRole = String(item?.tax_role || '').trim().toUpperCase();
  const sourceType = String(item?.source_type || '').trim().toUpperCase();
  const cfop = String(item?.cfop || '').trim();

  if (taxRole === 'DEBIT') return 'OUT';
  if (taxRole === 'CREDIT') return 'IN';

  if (sourceType.includes('SAIDA')) return 'OUT';
  if (sourceType.includes('ENTRADA')) return 'IN';

  if (/^(5|6|7)/.test(cfop)) return 'OUT';
  if (/^(1|2|3)/.test(cfop)) return 'IN';

  return 'UNKNOWN';
}

function isOutputItem(item) {
  return getItemDirection(item) === 'OUT';
}

function isInputItem(item) {
  return getItemDirection(item) === 'IN';
}

function allowsIcmsCredit(item) {
  if (!isInputItem(item)) return false;

  const cst = String(item?.icms_cst || '').trim();
  const csosn = String(item?.icms_csosn || '').trim();

  if (csosn) {
    return false;
  }

  return ['00', '20'].includes(cst);
}

function allowsPisCredit(item) {
  if (!isInputItem(item)) return false;

  const cst = String(item?.pis_cst || '').trim();
  if (!cst) return false;

  return [
    '50', '51', '52', '53', '54', '55', '56',
    '60', '61', '62', '63', '64', '65', '66'
  ].includes(cst);
}

function allowsCofinsCredit(item) {
  if (!isInputItem(item)) return false;

  const cst = String(item?.cofins_cst || '').trim();
  if (!cst) return false;

  return [
    '50', '51', '52', '53', '54', '55', '56',
    '60', '61', '62', '63', '64', '65', '66'
  ].includes(cst);
}

function allowsIpiCredit(item) {
  if (!isInputItem(item)) return false;

  const cst = String(item?.ipi_cst || '').trim();

  if (!cst) return true;

  return !['02', '03', '04', '05', '52', '53', '54', '55'].includes(cst);
}

function computeSummaryMetrics({ items = [], documents = [] } = {}) {
  let icmsDebitTotal = 0;
  let icmsCreditTotal = 0;
  let icmsStTotal = 0;

  let pisDebitTotal = 0;
  let pisCreditTotal = 0;

  let cofinsDebitTotal = 0;
  let cofinsCreditTotal = 0;

  let ipiDebitTotal = 0;
  let ipiCreditTotal = 0;

  let fcpTotal = 0;

  let icmsDebitBase = 0;
  let icmsCreditBase = 0;
  let icmsStBase = 0;

  let pisDebitBase = 0;
  let pisCreditBase = 0;

  let cofinsDebitBase = 0;
  let cofinsCreditBase = 0;

  let ipiDebitBase = 0;
  let ipiCreditBase = 0;

  let fcpBase = 0;

  for (const item of items) {
    const isOutput = isOutputItem(item);
    const isInput = isInputItem(item);

    const canCreditIcms = isInput && allowsIcmsCredit(item);
    const canCreditPis = isInput && allowsPisCredit(item);
    const canCreditCofins = isInput && allowsCofinsCredit(item);
    const canCreditIpi = isInput && allowsIpiCredit(item);

    const icmsValue = toNumber(item.icms_value);
    const icmsBase = toNumber(item.icms_base);

    const icmsStValue = toNumber(item.icms_st_value);
    const icmsStBaseValue = toNumber(item.icms_st_base);

    const pisValue = toNumber(item.pis_value);
    const pisBase = toNumber(item.pis_base);

    const cofinsValue = toNumber(item.cofins_value);
    const cofinsBase = toNumber(item.cofins_base);

    const ipiValue = toNumber(item.ipi_value);
    const ipiBase = toNumber(item.ipi_base);

    const fcpValue = toNumber(item.fcp_value);
    const fcpBaseValue = toNumber(item.fcp_base);

    if (isOutput) {
      icmsDebitTotal += icmsValue;
      icmsDebitBase += icmsBase;

      pisDebitTotal += pisValue;
      pisDebitBase += pisBase;

      cofinsDebitTotal += cofinsValue;
      cofinsDebitBase += cofinsBase;

      ipiDebitTotal += ipiValue;
      ipiDebitBase += ipiBase;
    }

    if (canCreditIcms) {
      icmsCreditTotal += icmsValue;
      icmsCreditBase += icmsBase;
    }

    if (canCreditPis) {
      pisCreditTotal += pisValue;
      pisCreditBase += pisBase;
    }

    if (canCreditCofins) {
      cofinsCreditTotal += cofinsValue;
      cofinsCreditBase += cofinsBase;
    }

    if (canCreditIpi) {
      ipiCreditTotal += ipiValue;
      ipiCreditBase += ipiBase;
    }

    icmsStTotal += icmsStValue;
    icmsStBase += icmsStBaseValue;

    fcpTotal += fcpValue;
    fcpBase += fcpBaseValue;
  }

  const outgoingDocumentsTotal = documents
    .filter(doc => String(doc.document_type || '').toUpperCase() === 'SAIDA')
    .reduce((sum, doc) => sum + toNumber(doc.total_nfe_value), 0);

  const incomingDocumentsTotal = documents
    .filter(doc => String(doc.document_type || '').toUpperCase() === 'ENTRADA')
    .reduce((sum, doc) => sum + toNumber(doc.total_nfe_value), 0);

  const grossDocumentsTotal = documents
    .reduce((sum, doc) => sum + toNumber(doc.total_nfe_value), 0);

  const icmsBalance = icmsDebitTotal - icmsCreditTotal;
  const pisBalance = pisDebitTotal - pisCreditTotal;
  const cofinsBalance = cofinsDebitTotal - cofinsCreditTotal;
  const ipiBalance = ipiDebitTotal - ipiCreditTotal;

  return {
    icms_debit_total: icmsDebitTotal,
    icms_credit_total: icmsCreditTotal,
    icms_st_total: icmsStTotal,
    icms_payable_total: icmsBalance,

    pis_debit_total: pisDebitTotal,
    pis_credit_total: pisCreditTotal,
    pis_payable_total: pisBalance,

    cofins_debit_total: cofinsDebitTotal,
    cofins_credit_total: cofinsCreditTotal,
    cofins_payable_total: cofinsBalance,

    ipi_debit_total: ipiDebitTotal,
    ipi_credit_total: ipiCreditTotal,
    ipi_payable_total: ipiBalance,

    fcp_total: fcpTotal,

    gross_documents_total: grossDocumentsTotal,
    outgoing_documents_total: outgoingDocumentsTotal,
    incoming_documents_total: incomingDocumentsTotal,

    icms_debit_base: icmsDebitBase,
    icms_credit_base: icmsCreditBase,
    icms_st_base: icmsStBase,

    pis_debit_base: pisDebitBase,
    pis_credit_base: pisCreditBase,

    cofins_debit_base: cofinsDebitBase,
    cofins_credit_base: cofinsCreditBase,

    ipi_debit_base: ipiDebitBase,
    ipi_credit_base: ipiCreditBase,

    fcp_base: fcpBase,

    pis_base: pisDebitBase,
    cofins_base: cofinsDebitBase,
    ipi_base: ipiDebitBase,

    icms_balance_total: icmsBalance,
    pis_balance_total: pisBalance,
    cofins_balance_total: cofinsBalance,
    ipi_balance_total: ipiBalance
  };
}

function mergeSummaryWithComputed(summaryRow, computedMetrics) {
  return {
    ...(summaryRow || {}),
    ...computedMetrics
  };
}


/* ======================================================================
   CREATE APURACAO
   ====================================================================== */

export async function createFiscalApuracaoByPeriod({
  date_from,
  date_to,
  regime_type = 'LUCRO_REAL',
  notes = null
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!date_from || !date_to) {
      throw new Error('date_from and date_to are required');
    }

    if (date_from > date_to) {
      throw new Error('date_from cannot be greater than date_to');
    }

    const { reference_month, reference_year } = buildReferenceFromPeriod(date_from);

    const existing = await getFiscalApuracaoByPeriod(
      reference_year,
      reference_month,
      regime_type,
      client
    );

    if (existing) {
      await client.query('COMMIT');
      return {
        success: true,
        created: false,
        data: existing
      };
    }

    const header = await insertFiscalApuracao({
      reference_month,
      reference_year,
      date_from,
      date_to,
      regime_type,
      status: 'OPEN',
      notes
    }, client);

    await upsertFiscalApuracaoSummary({
      fiscal_apuracao_id: header.fiscal_apuracao_id,

      icms_debit_total: 0,
      icms_credit_total: 0,
      icms_st_total: 0,
      icms_payable_total: 0,

      pis_debit_total: 0,
      pis_credit_total: 0,
      pis_payable_total: 0,

      cofins_debit_total: 0,
      cofins_credit_total: 0,
      cofins_payable_total: 0,

      ipi_debit_total: 0,
      ipi_credit_total: 0,
      ipi_payable_total: 0,

      fcp_total: 0,

      gross_documents_total: 0,
      outgoing_documents_total: 0,
      incoming_documents_total: 0,

      icms_debit_base: 0,
      icms_credit_base: 0,
      icms_st_base: 0,

      pis_debit_base: 0,
      pis_credit_base: 0,

      cofins_debit_base: 0,
      cofins_credit_base: 0,

      ipi_debit_base: 0,
      ipi_credit_base: 0,

      fcp_base: 0
    }, client);

    await client.query('COMMIT');

    return {
      success: true,
      created: true,
      data: header
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}


/* ======================================================================
   RECALCULATE SUMMARY FROM ITEMS
   ====================================================================== */

export async function rebuildFiscalApuracaoSummary(fiscalApuracaoId) {
  const client = await pool.connect();

  try {
    if (!isValidId(fiscalApuracaoId)) {
      throw new Error('Invalid fiscal apuração ID');
    }

    await client.query('BEGIN');

    const header = await getFiscalApuracaoHeaderById(fiscalApuracaoId, client);

    if (!header) {
      throw new Error('Fiscal apuração not found');
    }

    const documents = await listFiscalApuracaoDocuments(fiscalApuracaoId, client);
    const items = await listFiscalApuracaoItems(fiscalApuracaoId, client);

    const computed = computeSummaryMetrics({
      items,
      documents
    });

    const summaryRow = await upsertFiscalApuracaoSummary({
      fiscal_apuracao_id: fiscalApuracaoId,

      icms_debit_total: computed.icms_debit_total,
      icms_credit_total: computed.icms_credit_total,
      icms_st_total: computed.icms_st_total,
      icms_payable_total: computed.icms_payable_total,

      pis_debit_total: computed.pis_debit_total,
      pis_credit_total: computed.pis_credit_total,
      pis_payable_total: computed.pis_payable_total,

      cofins_debit_total: computed.cofins_debit_total,
      cofins_credit_total: computed.cofins_credit_total,
      cofins_payable_total: computed.cofins_payable_total,

      ipi_debit_total: computed.ipi_debit_total,
      ipi_credit_total: computed.ipi_credit_total,
      ipi_payable_total: computed.ipi_payable_total,

      fcp_total: computed.fcp_total,

      gross_documents_total: computed.gross_documents_total,
      outgoing_documents_total: computed.outgoing_documents_total,
      incoming_documents_total: computed.incoming_documents_total,

      icms_debit_base: computed.icms_debit_base,
      icms_credit_base: computed.icms_credit_base,
      icms_st_base: computed.icms_st_base,

      pis_debit_base: computed.pis_debit_base,
      pis_credit_base: computed.pis_credit_base,

      cofins_debit_base: computed.cofins_debit_base,
      cofins_credit_base: computed.cofins_credit_base,

      ipi_debit_base: computed.ipi_debit_base,
      ipi_credit_base: computed.ipi_credit_base,

      fcp_base: computed.fcp_base
    }, client);

    await client.query('COMMIT');

    return {
      success: true,
      data: mergeSummaryWithComputed(summaryRow, computed)
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}


/* ======================================================================
   GET FULL APURACAO
   ====================================================================== */

export async function getFiscalApuracaoById(fiscalApuracaoId) {
  if (!isValidId(fiscalApuracaoId)) {
    throw new Error('Invalid fiscal apuração ID');
  }

  const [header, summary, documents, items, reconciliation] = await Promise.all([
    getFiscalApuracaoHeaderById(fiscalApuracaoId),
    getFiscalApuracaoSummaryByApuracaoId(fiscalApuracaoId),
    listFiscalApuracaoDocuments(fiscalApuracaoId),
    listFiscalApuracaoItems(fiscalApuracaoId),
    listFiscalApuracaoReconciliation(fiscalApuracaoId)
  ]);

  if (!header) {
    return null;
  }

  const computed = computeSummaryMetrics({
    items,
    documents
  });

  return {
    header,
    summary: mergeSummaryWithComputed(summary, computed),
    documents,
    items,
    reconciliation
  };
}


/* ======================================================================
   LIST
   ====================================================================== */

export async function listFiscalApuracaoHeaders(filters = {}) {
  return listFiscalApuracoes(filters);
}


/* ======================================================================
   OPEN / CLOSE
   ====================================================================== */

export async function closeFiscalApuracao(fiscalApuracaoId) {
  if (!isValidId(fiscalApuracaoId)) {
    throw new Error('Invalid fiscal apuração ID');
  }

  const row = await updateFiscalApuracaoStatus(
    fiscalApuracaoId,
    'CLOSED'
  );

  if (!row) {
    throw new Error('Fiscal apuração not found');
  }

  return {
    success: true,
    data: row
  };
}

export async function reopenFiscalApuracao(fiscalApuracaoId) {
  if (!isValidId(fiscalApuracaoId)) {
    throw new Error('Invalid fiscal apuração ID');
  }

  const row = await updateFiscalApuracaoStatus(
    fiscalApuracaoId,
    'OPEN'
  );

  if (!row) {
    throw new Error('Fiscal apuração not found');
  }

  return {
    success: true,
    data: row
  };
}


/* ======================================================================
   DELETE
   ====================================================================== */

export async function removeFiscalApuracao(fiscalApuracaoId) {
  if (!isValidId(fiscalApuracaoId)) {
    throw new Error('Invalid fiscal apuração ID');
  }

  const row = await deleteFiscalApuracaoById(fiscalApuracaoId);

  if (!row) {
    throw new Error('Fiscal apuração not found');
  }

  return {
    success: true,
    data: row
  };
}