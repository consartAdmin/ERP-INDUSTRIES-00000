// ╔══════════════════════════════════════════════════════════════════════╗
// ║ blocoH.mapper.js                                                    ║
// ║ Descrição: Mapeamento do Bloco H                                    ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { line, formatDateDDMMYYYY, formatDecimal } from '../spedFiscal.generator.js';

export function mapBlocoH(ctx) {
  const inventory = Array.isArray(ctx.inventory) ? ctx.inventory : [];
  const lines = [];

  lines.push(line('H001', inventory.length ? '0' : '1'));

  if (!inventory.length) return lines;

  const total = inventory.reduce((acc, item) => {
    return acc + Number(item.valor_total || 0);
  }, 0);

  lines.push(
    line(
      'H005',
      formatDateDDMMYYYY(ctx.period?.dateEnd),
      formatDecimal(total),
      ctx.inventoryMotivo || '01'
    )
  );

  for (const item of inventory) {
    lines.push(
      line(
        'H010',
        item.codigo_produto || '',
        item.unidade || '',
        formatDecimal(item.quantidade || 0, 3),
        formatDecimal(item.valor_unitario || 0),
        formatDecimal(item.valor_total || 0),
        item.ind_prop || '0',
        item.cod_part || '',
        item.txt_compl || '',
        item.cod_cta || '',
        formatDecimal(item.valor_item_ir ?? item.vl_item_ir ?? '')
      )
    );
  }

  return lines;
}
