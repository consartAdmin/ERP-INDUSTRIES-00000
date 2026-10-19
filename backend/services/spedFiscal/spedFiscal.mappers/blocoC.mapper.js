// ╔══════════════════════════════════════════════════════════════════════╗
// ║ blocoC.mapper.js — Mapeamento do Bloco C                           ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  line,
  formatDateDDMMYYYY,
  formatDecimal,
  onlyDigits,
  sanitizeText,
} from '../spedFiscal.generator.js';

export function mapBlocoC(ctx) {
  const documents = Array.isArray(ctx.documents) ? ctx.documents : [];
  const lines = [line('C001', documents.length ? '0' : '1')];

  for (const doc of documents) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    const isOwnIssuedNfe = String(doc.cod_mod || '55') === '55'
      && String(doc.ind_emit ?? '') === '0';

    lines.push(line(
      'C100',
      doc.ind_oper ?? '1',
      doc.ind_emit ?? '0',
      sanitizeText(doc.participante_codigo),
      doc.cod_mod || '55',
      doc.cod_sit || '00',
      sanitizeText(doc.serie),
      sanitizeText(doc.numero),
      onlyDigits(doc.chave),
      formatDateDDMMYYYY(doc.data_emissao),
      formatDateDDMMYYYY(doc.data_entrada_saida || doc.data_emissao),
      formatDecimal(doc.valor_total || 0),
      doc.ind_pgto || '0',
      formatDecimal(doc.valor_desconto || 0),
      formatDecimal(doc.abatimento || 0),
      formatDecimal(doc.valor_mercadorias || doc.valor_total || 0),
      doc.ind_frt || '9',
      formatDecimal(doc.valor_frete || 0),
      formatDecimal(doc.valor_seguro || 0),
      formatDecimal(doc.outras_despesas || 0),
      formatDecimal(doc.valor_bc_icms || 0),
      formatDecimal(doc.valor_icms || 0),
      formatDecimal(doc.valor_bc_icms_st || 0),
      formatDecimal(doc.valor_icms_st || 0),
      formatDecimal(doc.valor_ipi || 0),
      formatDecimal(doc.valor_pis || 0),
      formatDecimal(doc.valor_cofins || 0),
      formatDecimal(doc.valor_pis_st || 0),
      formatDecimal(doc.valor_cofins_st || 0),
    ));

    let itemNumber = 1;

    // Own-issued NF-e must be represented by C100/C190, without C170.
    for (const item of isOwnIssuedNfe ? [] : items) {
      lines.push(line(
        'C170',
        itemNumber++,
        item.codigo_produto || '',
        sanitizeText(item.descricao),
        formatDecimal(item.quantidade || 0, 3),
        sanitizeText(item.unidade),
        formatDecimal(item.valor_item || 0),
        formatDecimal(item.valor_desconto || 0),
        item.movimenta_estoque ?? '1',
        item.cst_icms || item.csosn || '',
        item.cfop || '',
        onlyDigits(item.codigo_natureza),
        formatDecimal(item.valor_bc_icms || 0),
        formatDecimal(item.aliq_icms || 0),
        formatDecimal(item.valor_icms || 0),
        formatDecimal(item.valor_bc_icms_st || 0),
        formatDecimal(item.aliq_st || 0),
        formatDecimal(item.valor_icms_st || 0),
        item.apuracao_ipi ?? '',
        item.cst_ipi ?? '',
        item.cod_enq || '',
        formatDecimal(item.valor_bc_ipi || 0),
        formatDecimal(item.aliq_ipi || 0),
        formatDecimal(item.valor_ipi || 0),
        item.cst_pis || '',
        formatDecimal(item.valor_bc_pis || 0),
        formatDecimal(item.aliq_pis || 0),
        formatDecimal(item.quant_bc_pis || 0),
        formatDecimal(item.aliq_pis_reais || 0),
        formatDecimal(item.valor_pis || 0),
        item.cst_cofins || '',
        formatDecimal(item.valor_bc_cofins || 0),
        formatDecimal(item.aliq_cofins || 0),
        formatDecimal(item.quant_bc_cofins || 0),
        formatDecimal(item.aliq_cofins_reais || 0),
        formatDecimal(item.valor_cofins || 0),
        item.cod_cta || '',
        formatDecimal(item.valor_abatimento_nao_tributado || item.valor_abat_nt || 0),
      ));
    }

    const c190Map = new Map();

    for (const item of items) {
      const key = [
        item.cst_icms || item.csosn || '',
        item.cfop || '',
        item.aliq_icms ?? 0,
      ].join('|');

      const group = c190Map.get(key) || {
        cst: item.cst_icms || item.csosn || '',
        cfop: item.cfop || '',
        aliq: Number(item.aliq_icms || 0),
        vlOpr: 0,
        vlBc: 0,
        vlIcms: 0,
        vlBcSt: 0,
        vlSt: 0,
        vlRedBc: 0,
        vlIpi: 0,
      };

      group.vlOpr += Number(item.valor_item || 0);
      group.vlBc += Number(item.valor_bc_icms || 0);
      group.vlIcms += Number(item.valor_icms || 0);
      group.vlBcSt += Number(item.valor_bc_icms_st || 0);
      group.vlSt += Number(item.valor_icms_st || 0);
      group.vlRedBc += Number(item.valor_reducao_bc || 0);
      group.vlIpi += Number(item.valor_ipi || 0);
      c190Map.set(key, group);
    }

    for (const group of c190Map.values()) {
      lines.push(line(
        'C190',
        group.cst,
        group.cfop,
        formatDecimal(group.aliq),
        formatDecimal(group.vlOpr),
        formatDecimal(group.vlBc),
        formatDecimal(group.vlIcms),
        formatDecimal(group.vlBcSt),
        formatDecimal(group.vlSt),
        formatDecimal(group.vlRedBc),
        formatDecimal(group.vlIpi),
        '',
      ));
    }
  }

  return lines;
}
