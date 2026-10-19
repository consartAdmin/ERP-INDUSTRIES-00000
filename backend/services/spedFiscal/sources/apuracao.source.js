// ╔══════════════════════════════════════════════════════════════════════╗
// ║ apuracao.source.js                                                  ║
// ║ Fonte de apuração ICMS/IPI para o Bloco E                           ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getOutboundDocumentsSource } from './outboundDocuments.source.js';
import { getInboundDocumentsSource } from './inboundDocuments.source.js';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sumNumber(list = [], field) {
  return list.reduce((acc, item) => acc + toNumber(item?.[field]), 0);
}

export async function getApuracaoSource(params) {
  const [outboundDocs, inboundDocs] = await Promise.all([
    getOutboundDocumentsSource(params),
    getInboundDocumentsSource(params)
  ]);

  const totalDebitos = sumNumber(outboundDocs, 'valor_icms');
  const totalCreditos = sumNumber(inboundDocs, 'valor_icms');

  const result = {
    vl_tot_debitos: totalDebitos,
    vl_aj_debitos: 0,
    vl_tot_aj_debitos: 0,
    vl_estornos_cred: 0,

    vl_tot_creditos: totalCreditos,
    vl_aj_creditos: 0,
    vl_tot_aj_creditos: 0,
    vl_estornos_deb: 0,

    vl_sld_credor_ant: 0,
    vl_sld_apurado: 0,
    vl_tot_ded: 0,
    vl_icms_recolher: 0,
    vl_sld_credor_transportar: 0,
    debitos_especiais: 0,

    total_saidas: outboundDocs.length,
    total_entradas: inboundDocs.length,
    valor_saidas: sumNumber(outboundDocs, 'valor_total'),
    valor_entradas: sumNumber(inboundDocs, 'valor_total')
  };

  const saldo =
    result.vl_tot_debitos +
    result.vl_aj_debitos +
    result.vl_tot_aj_debitos -
    result.vl_estornos_cred -
    result.vl_tot_creditos -
    result.vl_aj_creditos -
    result.vl_tot_aj_creditos +
    result.vl_estornos_deb -
    result.vl_sld_credor_ant;

  result.vl_sld_apurado = saldo;

  if (saldo > 0) {
    result.vl_icms_recolher = saldo;
    result.vl_sld_credor_transportar = 0;
  } else {
    result.vl_icms_recolher = 0;
    result.vl_sld_credor_transportar = Math.abs(saldo);
  }

  console.log('[SPED Fiscal] apuracao:', {
    saidas: result.total_saidas,
    entradas: result.total_entradas,
    debitos: result.vl_tot_debitos,
    creditos: result.vl_tot_creditos,
    saldo: result.vl_icms_recolher
  });

  return result;
}

export default {
  getApuracaoSource
};