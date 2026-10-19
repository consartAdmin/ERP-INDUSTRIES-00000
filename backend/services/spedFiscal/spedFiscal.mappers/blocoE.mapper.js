// ╔══════════════════════════════════════════════════════════════════════╗
// ║ blocoE.mapper.js — Mapeamento do Bloco E                           ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  line,
  formatDateDDMMYYYY,
  formatDecimal,
} from '../spedFiscal.generator.js';

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function mapBlocoE(ctx) {
  const apuracao = ctx.apuracao || {};
  const documents = Array.isArray(ctx.documents) ? ctx.documents : [];
  const rawBalance = toNumber(apuracao.vl_sld_apurado);

  // E110/VL_SLD_APURADO represents tax payable and cannot be negative.
  const assessedBalance = Math.max(rawBalance, 0);

  // A negative calculated balance is a credit to carry forward.
  const informedCreditToCarry = Math.max(
    toNumber(apuracao.vl_sld_credor_transportar),
    0,
  );

  const creditToCarry = Math.max(
    informedCreditToCarry,
    rawBalance < 0 ? Math.abs(rawBalance) : 0,
  );

  const lines = [line('E001', '0')];

  lines.push(line(
    'E100',
    formatDateDDMMYYYY(ctx.period?.dateStart),
    formatDateDDMMYYYY(ctx.period?.dateEnd),
  ));

  lines.push(line(
    'E110',
    formatDecimal(apuracao.vl_tot_debitos || 0),
    formatDecimal(apuracao.vl_aj_debitos || 0),
    formatDecimal(apuracao.vl_tot_aj_debitos || 0),
    formatDecimal(apuracao.vl_estornos_cred || 0),
    formatDecimal(apuracao.vl_tot_creditos || 0),
    formatDecimal(apuracao.vl_aj_creditos || 0),
    formatDecimal(apuracao.vl_tot_aj_creditos || 0),
    formatDecimal(apuracao.vl_estornos_deb || 0),
    formatDecimal(apuracao.vl_sld_credor_ant || 0),
    formatDecimal(assessedBalance),
    formatDecimal(apuracao.vl_tot_ded || 0),
    formatDecimal(apuracao.vl_icms_recolher || 0),
    formatDecimal(creditToCarry),
    formatDecimal(apuracao.debitos_especiais || 0),
  ));

  const hasIcmsStMovement = documents.some(document => (
    toNumber(document.valor_bc_icms_st) > 0
    || toNumber(document.valor_icms_st) > 0
    || (Array.isArray(document.items) && document.items.some(item => (
      toNumber(item.valor_bc_icms_st) > 0
      || toNumber(item.valor_icms_st) > 0
    )))
  ));

  const inboundIcmsStCredit = documents
    .filter(document => String(document.ind_oper ?? '') === '0')
    .reduce((total, document) => (
      total + toNumber(document.valor_icms_st)
    ), 0);

  if (hasIcmsStMovement) {
    lines.push(line(
      'E200',
      String(ctx.company?.uf || '').trim().toUpperCase(),
      formatDateDDMMYYYY(ctx.period?.dateStart),
      formatDateDDMMYYYY(ctx.period?.dateEnd),
    ));

    // The imported ICMS-ST was retained by the suppliers. It creates movement
    // for the substituted taxpayer, but not an ICMS-ST debt to be collected.
    lines.push(line(
      'E210',
      '1',
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(inboundIcmsStCredit),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(0),
      formatDecimal(inboundIcmsStCredit),
      formatDecimal(0),
    ));
  }

  return lines;
}
