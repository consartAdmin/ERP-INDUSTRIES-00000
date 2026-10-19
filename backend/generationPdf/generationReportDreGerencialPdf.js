// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationReportDreGerencialPdf.js — PDF DRE Gerencial              ║
// ║ CONSART ERP | PDFKit | ESM                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

function num(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function moneyBR(value) {
  return num(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function percentBR(value) {
  return `${num(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function dateBR(value) {
  if (!value) return '-';

  const clean = String(value).slice(0, 10);
  const [y, m, d] = clean.split('-');

  if (!y || !m || !d) return clean;

  return `${d}/${m}/${y}`;
}

function text(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function isTrue(value) {
  return (
    value === true ||
    value === 'true' ||
    value === 't' ||
    value === 1 ||
    value === '1'
  );
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function getTipoDre(row = {}) {
  const subcategoria = normalizeText(row.subcategoria);
  const dreTipo = normalizeText(row.dre_tipo);

  if (
    dreTipo === 'CMV' ||
    subcategoria === 'C.M.V' ||
    subcategoria === 'CMV'
  ) {
    return 'C.M.V';
  }

  return isTrue(row.is_deductible_final)
    ? 'Despesa Dedutível'
    : 'Despesa Não Dedutível';
}

function ensureSpace(doc, minHeight = 60) {
  if (doc.y + minHeight <= 780) return;

  doc.addPage();
  doc.y = 42;
}

function drawHeader(doc, { title, subtitle }) {
  doc
    .rect(0, 0, 595.28, 92)
    .fill('#f8fafc');

  doc
    .font('Helvetica-Bold')
    .fontSize(19)
    .fillColor('#0f172a')
    .text(title, 36, 30, { width: 523, align: 'center' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(subtitle, 36, 56, { width: 523, align: 'center' });

  doc
    .moveTo(36, 82)
    .lineTo(559, 82)
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .stroke();

  doc.y = 105;
}

function drawFooter(doc) {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        `CONSART ERP • DRE Gerencial • Página ${i + 1} de ${range.count}`,
        36,
        805,
        { width: 523, align: 'center' }
      );
  }
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 38);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#0f172a')
    .text(title, 36, doc.y);

  doc.moveDown(0.45);
}

function drawSimpleRows(doc, rows = []) {
  rows.forEach((row, index) => {
    const {
      label,
      value,
      helper = '',
      bold = false,
      bg = index % 2 === 0 ? '#ffffff' : '#f8fafc',
      valueColor = '#0f172a',
    } = row;

    ensureSpace(doc, 25);

    const y = doc.y;

    doc
      .rect(36, y - 3, 523, 22)
      .fill(bg);

    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor('#0f172a')
      .text(label, 45, y + 3, { width: 280 });

    if (helper) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#64748b')
        .text(helper, 300, y + 4, { width: 115 });
    }

    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(valueColor)
      .text(moneyBR(value), 420, y + 3, {
        width: 120,
        align: 'right',
      });

    doc.y = y + 23;
  });

  doc.moveDown(0.7);
}

function drawResumoTable(doc, resumo = {}) {
  drawSectionTitle(doc, 'Resumo DRE');

  drawSimpleRows(doc, [
    {
      label: 'Receita Bruta',
      value: resumo.receita_bruta,
    },
    {
      label: '(-) Impostos Venda',
      value: resumo.impostos_venda?.total,
    },
    {
      label: '(=) Receita Líquida',
      value: resumo.receita_liquida,
      bold: true,
      bg: '#eff6ff',
    },
    {
      label: '(-) C.M.V',
      value: resumo.cmv,
      bg: '#fff7ed',
    },
    {
      label: '(=) Lucro Bruto',
      value: resumo.lucro_bruto,
      bold: true,
      bg: '#ecfdf5',
    },
    {
      label: '(-) Despesas Dedutíveis',
      value: resumo.despesas?.dedutiveis,
    },
    {
      label: '(-) Despesas Não Dedutíveis',
      value: resumo.despesas?.nao_dedutiveis,
    },
    {
      label: '(-) Total Despesas Operacionais',
      value: resumo.despesas?.total,
      bold: true,
      bg: '#fff7ed',
    },
    {
      label: '(=) Resultado Operacional',
      value: resumo.resultado_antes_irpj_csll,
      bold: true,
      bg: '#eff6ff',
    },
    {
      label: '(-) IRPJ',
      value: resumo.irpj_csll?.irpj,
    },
    {
      label: '(-) CSLL',
      value: resumo.irpj_csll?.csll,
    },
    {
      label: '(=) Lucro Líquido Estimado',
      value: resumo.lucro_liquido_estimado,
      bold: true,
      bg: '#fef3c7',
    },
  ]);
}

function drawImpostosVenda(doc, resumo = {}) {
  drawSectionTitle(doc, 'Cálculo dos Impostos sobre Venda');

  const receitaBruta = num(resumo.receita_bruta);
  const icms = num(resumo.impostos_venda?.icms);
  const pis = num(resumo.impostos_venda?.pis);
  const cofins = num(resumo.impostos_venda?.cofins);
  const total = num(resumo.impostos_venda?.total);

  const calcPercent = (value) => (
    receitaBruta > 0 ? percentBR((num(value) / receitaBruta) * 100) : '0,00%'
  );

  drawSimpleRows(doc, [
    {
      label: 'Base de cálculo — Receita Bruta',
      value: receitaBruta,
      bold: true,
      bg: '#f8fafc',
    },
    {
      label: 'ICMS sobre venda',
      helper: calcPercent(icms),
      value: icms,
    },
    {
      label: 'PIS sobre venda',
      helper: calcPercent(pis),
      value: pis,
    },
    {
      label: 'COFINS sobre venda',
      helper: calcPercent(cofins),
      value: cofins,
    },
    {
      label: 'Total Impostos sobre Venda',
      helper: calcPercent(total),
      value: total,
      bold: true,
      bg: '#eff6ff',
    },
  ]);
}

function drawIrpjCsll(doc, resumo = {}) {
  drawSectionTitle(doc, 'Cálculo IRPJ / CSLL');

  const resultadoOperacional = num(resumo.resultado_antes_irpj_csll);
  const despesasNaoDedutiveis = num(resumo.despesas?.nao_dedutiveis);
  const baseFiscal = Math.max(0, resultadoOperacional + despesasNaoDedutiveis);

  const irpj = num(resumo.irpj_csll?.irpj);
  const csll = num(resumo.irpj_csll?.csll);
  const total = num(resumo.irpj_csll?.total);

  drawSimpleRows(doc, [
    {
      label: 'Resultado Operacional',
      value: resultadoOperacional,
    },
    {
      label: '(+) Despesas Não Dedutíveis',
      value: despesasNaoDedutiveis,
    },
    {
      label: '(=) Base Fiscal Estimada',
      value: baseFiscal,
      bold: true,
      bg: '#eff6ff',
    },
    {
      label: 'IRPJ Estimado',
      helper: '15% + adicional se aplicável',
      value: irpj,
    },
    {
      label: 'CSLL Estimada',
      helper: '9%',
      value: csll,
    },
    {
      label: 'Total IRPJ + CSLL',
      value: total,
      bold: true,
      bg: '#fef3c7',
    },
  ]);
}

function drawIndicadores(doc, resumo = {}) {
  drawSectionTitle(doc, 'Indicadores');

  const margemBruta = resumo.margens?.margem_bruta_percent ?? 0;
  const margemLiquida = resumo.margens?.margem_liquida_percent ?? 0;

  ensureSpace(doc, 45);

  const y = doc.y;

  const cards = [
    ['Margem Bruta', percentBR(margemBruta)],
    ['Margem Líquida', percentBR(margemLiquida)],
    ['Receita Líquida', moneyBR(resumo.receita_liquida)],
  ];

  cards.forEach(([label, value], index) => {
    const x = 36 + index * 176;

    doc
      .rect(x, y, 165, 40)
      .fill('#f8fafc')
      .strokeColor('#e2e8f0')
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#64748b')
      .text(label, x + 10, y + 9, { width: 145 });

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(value, x + 10, y + 22, { width: 145 });
  });

  doc.y = y + 54;
}

function drawLancamentosHeader(doc) {
  ensureSpace(doc, 35);

  const y = doc.y;

  doc
    .rect(36, y, 523, 22)
    .fill('#e2e8f0');

  doc
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .fillColor('#0f172a')
    .text('Descrição', 42, y + 7, { width: 140 })
    .text('Tipo DRE', 185, y + 7, { width: 82 })
    .text('Categoria', 270, y + 7, { width: 82 })
    .text('Subcategoria', 355, y + 7, { width: 76 })
    .text('Valor', 434, y + 7, { width: 58, align: 'right' })
    .text('Data', 499, y + 7, { width: 46 })
    .text('Status', 545, y + 7, { width: 45 });

  doc.y = y + 26;
}

function drawLancamentosTable(doc, despesas = [], titulo = 'Lançamentos da DRE') {
  drawSectionTitle(doc, titulo);

  const total = despesas.reduce((acc, row) => acc + num(row.amount ?? row.valor), 0);

  ensureSpace(doc, 25);

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#334155')
    .text(`Total de lançamentos: ${despesas.length} • Total: ${moneyBR(total)}`, 36, doc.y, {
      width: 523,
      align: 'right',
    });

  doc.moveDown(0.45);

  drawLancamentosHeader(doc);

  if (!despesas.length) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748b')
      .text('Nenhum lançamento encontrado para este grupo.', 36, doc.y + 8, {
        width: 523,
        align: 'center',
      });

    doc.moveDown(2);
    return;
  }

  despesas.forEach((row, index) => {
    ensureSpace(doc, 31);

    if (doc.y < 70) drawLancamentosHeader(doc);

    const y = doc.y;
    const tipo = getTipoDre(row);

    doc
      .rect(36, y - 2, 523, 26)
      .fill(index % 2 === 0 ? '#ffffff' : '#f8fafc');

    doc
      .font('Helvetica')
      .fontSize(6.8)
      .fillColor('#0f172a')
      .text(text(row.description), 42, y + 4, { width: 140, height: 18 })
      .text(tipo, 185, y + 4, { width: 82, height: 18 })
      .text(text(row.category), 270, y + 4, { width: 82, height: 18 })
      .text(text(row.subcategoria), 355, y + 4, { width: 76, height: 18 })
      .text(moneyBR(row.amount ?? row.valor), 434, y + 4, { width: 58, align: 'right' })
      .text(dateBR(row.due_date || row.paid_date || row.data_hora), 499, y + 4, { width: 46 })
      .text(text(row.status), 545, y + 4, { width: 45 });

    doc.y = y + 27;
  });

  doc.moveDown(0.8);
}

function splitDespesas(despesas = []) {
  const cmv = [];
  const dedutiveis = [];
  const naoDedutiveis = [];

  despesas.forEach((row) => {
    const tipo = getTipoDre(row);

    if (tipo === 'C.M.V') {
      cmv.push(row);
      return;
    }

    if (tipo === 'Despesa Não Dedutível') {
      naoDedutiveis.push(row);
      return;
    }

    dedutiveis.push(row);
  });

  return {
    cmv,
    dedutiveis,
    naoDedutiveis,
  };
}

export function generateReportDreGerencialPdfStream({
  resumo = {},
  despesas = [],
  month = '',
} = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    bufferPages: true,
  });

  const periodo = resumo.periodo
    ? `${dateBR(resumo.periodo.start)} até ${dateBR(resumo.periodo.end)}`
    : month;

  const grupos = splitDespesas(despesas);

  drawHeader(doc, {
    title: 'DRE Gerencial',
    subtitle: `Demonstrativo de Resultado em Tempo Real • Período: ${periodo}`,
  });

  drawResumoTable(doc, resumo);
  drawImpostosVenda(doc, resumo);
  drawIrpjCsll(doc, resumo);
  drawIndicadores(doc, resumo);

  drawLancamentosTable(doc, grupos.cmv, 'Lançamentos de C.M.V');
  drawLancamentosTable(doc, grupos.dedutiveis, 'Despesas Dedutíveis');
  drawLancamentosTable(doc, grupos.naoDedutiveis, 'Despesas Não Dedutíveis');

  drawFooter(doc);

  doc.end();

  return doc;
}

export default generateReportDreGerencialPdfStream;