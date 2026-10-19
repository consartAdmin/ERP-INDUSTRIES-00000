// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bloco1.mapper.js                                                    ║
// ║ Descrição: Mapeamento do Bloco 1                                    ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { line } from '../spedFiscal.generator.js';

function indicator(value, fallback = 'N') {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  return normalized === 'S' ? 'S' : 'N';
}

export function mapBloco1(ctx = {}) {
  const obligations = ctx.block1Obligations || ctx.obrigacoesBloco1 || {};

  return [
    line('1001', '0'),
    line(
      '1010',
      indicator(obligations.ind_exp),
      indicator(obligations.ind_ccrf),
      indicator(obligations.ind_comb),
      indicator(obligations.ind_usina),
      indicator(obligations.ind_va),
      indicator(obligations.ind_ee),
      indicator(obligations.ind_cart),
      indicator(obligations.ind_form),
      indicator(obligations.ind_aer),
      indicator(obligations.ind_giaf1),
      indicator(obligations.ind_giaf3),
      indicator(obligations.ind_giaf4),
      indicator(obligations.ind_rest_ressarc_compl_icms),
    ),
  ];
}
