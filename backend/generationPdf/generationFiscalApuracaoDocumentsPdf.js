// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationFiscalApuracaoDocumentsPdf.js                        ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ CONSART ERP                                                          ║
// ║ PDF GENERATOR                                                        ║
// ║ UPDATE: relatório profissional de documentos importados              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ======================================================================
   DEFAULTS
====================================================================== */

const DEFAULT_COMPANY = {
  name: 'CONSART ERP',
  taxId: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  email: ''
};

const PAGE = {
  size: 'A4',
  layout: 'landscape',
  margin: 26
};

const COLORS = {
  text: '#0f172a',
  muted: '#64748b',
  border: '#cbd5e1',
  borderStrong: '#94a3b8',
  headerBg: '#e8f0ff',
  zebra: '#f8fafc',
  accent: '#1d4ed8',
  accentSoft: '#dbeafe',
  success: '#15803d',
  danger: '#b91c1c'
};

const FONTS = {
  title: 15,
  subtitle: 10,
  metaLabel: 8,
  metaValue: 9,
  tableHeader: 7,
  tableBody: 7,
  footer: 7
};

const TABLE_COLUMNS = [
  { key: 'direction', label: 'DIR', width: 42, align: 'center' },
  { key: 'id', label: 'ID', width: 36, align: 'center' },
  { key: 'tipo', label: 'TIPO', width: 54, align: 'left' },
  { key: 'modelo', label: 'MOD', width: 42, align: 'center' },
  { key: 'numero', label: 'NÚMERO', width: 56, align: 'center' },
  { key: 'data', label: 'DATA', width: 56, align: 'center' },
  { key: 'parceiro', label: 'PARCEIRO', width: 178, align: 'left' },
  { key: 'total_nf', label: 'TOTAL NF', width: 72, align: 'right' },
  { key: 'icms', label: 'ICMS', width: 58, align: 'right' },
  { key: 'icms_st', label: 'ICMS ST', width: 62, align: 'right' },
  { key: 'pis', label: 'PIS', width: 50, align: 'right' },
  { key: 'cofins', label: 'COFINS', width: 58, align: 'right' },
  { key: 'ipi', label: 'IPI', width: 48, align: 'right' }
];

/* ======================================================================
   HELPERS
====================================================================== */

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function dateBR(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function safeText(value, fallback = '-') {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildReferenceFromPeriod(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return 'SEM_PERIODO';
  const from = safeText(dateFrom, '').replaceAll('-', '');
  const to = safeText(dateTo, '').replaceAll('-', '');
  return `${from || 'SEM_INICIO'}_${to || 'SEM_FIM'}`;
}

function buildOutputPath(outputPath, apuracao = {}) {
  if (outputPath) return outputPath;

  const outDir = path.resolve(__dirname, '../../public/pdfs/fiscal-apuracao');
  ensureDir(outDir);

  const ref = buildReferenceFromPeriod(apuracao.date_from, apuracao.date_to);
  const id = apuracao.fiscal_apuracao_id || 'sem_id';
  return path.join(outDir, `fiscal_apuracao_documentos_${id}_${ref}.pdf`);
}

function normalizeDocument(direction, row = {}) {
  return {
    direction,
    id: row.fiscal_apuracao_document_id ?? row.id ?? '',
    tipo: safeText(row.document_type || row.tipo || direction),
    modelo: safeText(row.model || row.modelo),
    numero: safeText(row.number || row.numero),
    data: dateBR(row.issue_date || row.data),
    parceiro: safeText(row.partner_name || row.parceiro),
    total_nf: toNumber(row.total_nfe_value ?? row.total_nf),
    icms: toNumber(row.total_icms_value ?? row.icms),
    icms_st: toNumber(row.total_icms_st_value ?? row.icms_st),
    pis: toNumber(row.total_pis_value ?? row.pis),
    cofins: toNumber(row.total_cofins_value ?? row.cofins),
    ipi: toNumber(row.total_ipi_value ?? row.ipi)
  };
}

function normalizeDocuments(documentsEntrada = [], documentsSaida = []) {
  const entrada = (Array.isArray(documentsEntrada) ? documentsEntrada : [])
    .map(row => normalizeDocument('ENT', row));

  const saida = (Array.isArray(documentsSaida) ? documentsSaida : [])
    .map(row => normalizeDocument('SAI', row));

  return [...entrada, ...saida].sort((a, b) => {
    const da = new Date(a.data.split('/').reverse().join('-')).getTime() || 0;
    const db = new Date(b.data.split('/').reverse().join('-')).getTime() || 0;
    if (da !== db) return da - db;
    return String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true });
  });
}

function calculateTotals(rows = []) {
  return rows.reduce((acc, row) => {
    acc.count += 1;
    acc.total_nf += toNumber(row.total_nf);
    acc.icms += toNumber(row.icms);
    acc.icms_st += toNumber(row.icms_st);
    acc.pis += toNumber(row.pis);
    acc.cofins += toNumber(row.cofins);
    acc.ipi += toNumber(row.ipi);
    return acc;
  }, {
    count: 0,
    total_nf: 0,
    icms: 0,
    icms_st: 0,
    pis: 0,
    cofins: 0,
    ipi: 0
  });
}

function drawBox(doc, x, y, w, h, fill = '#ffffff', stroke = COLORS.border) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(fill, stroke);
  doc.restore();
}

function drawText(doc, text, x, y, options = {}) {
  doc.text(String(text ?? ''), x, y, options);
}

function fitText(doc, text, maxWidth) {
  const value = safeText(text, '');
  if (!value) return '';
  if (doc.widthOfString(value) <= maxWidth) return value;

  let result = value;
  while (result.length > 1 && doc.widthOfString(`${result}…`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/* ======================================================================
   PDF LAYOUT
====================================================================== */

function createDoc() {
  return new PDFDocument({
    size: PAGE.size,
    layout: PAGE.layout,
    margin: PAGE.margin,
    bufferPages: true,
    autoFirstPage: true
  });
}

function getPageMetrics(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  return {
    pageWidth,
    pageHeight,
    left: PAGE.margin,
    right: pageWidth - PAGE.margin,
    top: PAGE.margin,
    bottom: pageHeight - PAGE.margin,
    contentWidth: pageWidth - (PAGE.margin * 2)
  };
}

function drawHeader(doc, context) {
  const { company, apuracao, rows } = context;
  const m = getPageMetrics(doc);

  const headerH = 72;
  drawBox(doc, m.left, m.top, m.contentWidth, headerH, '#ffffff', COLORS.borderStrong);

  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(FONTS.title);
  drawText(doc, 'RELATÓRIO DE DOCUMENTOS IMPORTADOS', m.left + 16, m.top + 12, {
    width: 360,
    lineBreak: false
  });

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(FONTS.subtitle);
  drawText(doc, safeText(company.name, DEFAULT_COMPANY.name), m.left + 16, m.top + 34, {
    width: 300,
    lineBreak: false
  });

  const metaX = m.left + 370;
  const metaY = m.top + 12;
  const lineGap = 12;

  const periodText = `${dateBR(apuracao.date_from)} até ${dateBR(apuracao.date_to)}`;
  const apuracaoId = safeText(apuracao.fiscal_apuracao_id, '-');
  const regimeType = safeText(apuracao.regime_type, '-');
  const status = safeText(apuracao.status, '-');

  doc.font('Helvetica-Bold').fontSize(FONTS.metaLabel).fillColor(COLORS.muted);
  drawText(doc, 'APURAÇÃO:', metaX, metaY);
  drawText(doc, 'PERÍODO:', metaX, metaY + lineGap);
  drawText(doc, 'REGIME:', metaX, metaY + (lineGap * 2));
  drawText(doc, 'STATUS:', metaX, metaY + (lineGap * 3));

  doc.font('Helvetica').fontSize(FONTS.metaValue).fillColor(COLORS.text);
  drawText(doc, apuracaoId, metaX + 64, metaY);
  drawText(doc, periodText, metaX + 64, metaY + lineGap);
  drawText(doc, regimeType, metaX + 64, metaY + (lineGap * 2));
  drawText(doc, status, metaX + 64, metaY + (lineGap * 3));

  const totals = calculateTotals(rows);
  const cardY = m.top + headerH + 10;
  const cardH = 42;
  const gap = 8;
  const cardW = Math.floor((m.contentWidth - (gap * 4)) / 5);

  const cards = [
    { label: 'DOCUMENTOS', value: String(totals.count), accent: COLORS.accentSoft },
    { label: 'TOTAL NF', value: moneyBR(totals.total_nf), accent: '#ecfeff' },
    { label: 'ICMS', value: moneyBR(totals.icms), accent: '#f0fdf4' },
    { label: 'ICMS ST', value: moneyBR(totals.icms_st), accent: '#fff7ed' },
    { label: 'PIS/COFINS/IPI', value: `${moneyBR(totals.pis)} / ${moneyBR(totals.cofins)} / ${moneyBR(totals.ipi)}`, accent: '#f8fafc' }
  ];

  cards.forEach((card, index) => {
    const x = m.left + ((cardW + gap) * index);
    drawBox(doc, x, cardY, cardW, cardH, card.accent, COLORS.border);

    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted);
    drawText(doc, card.label, x + 10, cardY + 8, { width: cardW - 20, lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
    drawText(doc, fitText(doc, card.value, cardW - 20), x + 10, cardY + 20, {
      width: cardW - 20,
      lineBreak: false
    });
  });

  return cardY + cardH + 14;
}

function drawTableHeader(doc, y) {
  const m = getPageMetrics(doc);
  let x = m.left;

  doc.save();
  doc.rect(m.left, y, m.contentWidth, 20).fill(COLORS.headerBg);
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(FONTS.tableHeader).fillColor(COLORS.accent);

  for (const col of TABLE_COLUMNS) {
    drawText(doc, col.label, x + 3, y + 6, {
      width: col.width - 6,
      align: col.align || 'left',
      lineBreak: false
    });
    x += col.width;
  }

  doc.save();
  doc.lineWidth(0.8).strokeColor(COLORS.borderStrong);
  doc.rect(m.left, y, m.contentWidth, 20).stroke();
  doc.restore();

  return y + 20;
}

function getRowHeight(doc, row) {
  const baseHeight = 18;
  const partnerCol = TABLE_COLUMNS.find(col => col.key === 'parceiro');
  if (!partnerCol) return baseHeight;

  doc.font('Helvetica').fontSize(FONTS.tableBody);
  const partnerHeight = doc.heightOfString(safeText(row.parceiro), {
    width: partnerCol.width - 6,
    align: 'left'
  });

  return Math.max(baseHeight, Math.ceil(partnerHeight) + 6);
}

function drawRow(doc, row, y, index) {
  const m = getPageMetrics(doc);
  const rowHeight = getRowHeight(doc, row);
  let x = m.left;

  if (index % 2 !== 0) {
    doc.save();
    doc.rect(m.left, y, m.contentWidth, rowHeight).fill(COLORS.zebra);
    doc.restore();
  }

  doc.font('Helvetica').fontSize(FONTS.tableBody).fillColor(COLORS.text);

  for (const col of TABLE_COLUMNS) {
    let value = row[col.key];

    if (['total_nf', 'icms', 'icms_st', 'pis', 'cofins', 'ipi'].includes(col.key)) {
      value = moneyBR(value);
    } else {
      value = safeText(value, '');
    }

    drawText(doc, value, x + 3, y + 5, {
      width: col.width - 6,
      align: col.align || 'left',
      lineBreak: false,
      ellipsis: true,
      height: rowHeight - 8
    });

    doc.save();
    doc.moveTo(x, y).lineTo(x, y + rowHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.restore();

    x += col.width;
  }

  doc.save();
  doc.moveTo(m.left, y + rowHeight).lineTo(m.left + m.contentWidth, y + rowHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.moveTo(m.left + m.contentWidth, y).lineTo(m.left + m.contentWidth, y + rowHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.restore();

  return y + rowHeight;
}

function drawFooter(doc, context) {
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);

    const m = getPageMetrics(doc);
    const footerY = m.bottom - 10;
    const current = i + 1;
    const total = range.count;

    doc.font('Helvetica').fontSize(FONTS.footer).fillColor(COLORS.muted);
    drawText(doc, safeText(context.company.name, DEFAULT_COMPANY.name), m.left, footerY, {
      width: 220,
      lineBreak: false
    });

    drawText(
      doc,
      `Gerado em ${new Date().toLocaleString('pt-BR')}  |  Página ${current}/${total}`,
      m.left + 220,
      footerY,
      {
        width: m.contentWidth - 220,
        align: 'right',
        lineBreak: false
      }
    );
  }
}

/* ======================================================================
   MAIN GENERATOR
====================================================================== */

export async function generateFiscalApuracaoDocumentsPdf({
  apuracao = {},
  documentsEntrada = [],
  documentsSaida = [],
  outputPath = null,
  company = {},
  logoPath = null
} = {}) {
  const normalizedCompany = {
    ...DEFAULT_COMPANY,
    ...(company || {})
  };

  const rows = normalizeDocuments(documentsEntrada, documentsSaida);
  const finalOutputPath = buildOutputPath(outputPath, apuracao);
  ensureDir(path.dirname(finalOutputPath));

  return await new Promise((resolve, reject) => {
    const doc = createDoc();
    const stream = fs.createWriteStream(finalOutputPath);

    stream.on('finish', () => resolve(finalOutputPath));
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);

    try {
      if (logoPath && fs.existsSync(logoPath)) {
        const m = getPageMetrics(doc);
        doc.image(logoPath, m.right - 86, m.top + 10, {
          fit: [60, 40],
          align: 'right',
          valign: 'top'
        });
      }

      let cursorY = drawHeader(doc, {
        company: normalizedCompany,
        apuracao,
        rows
      });

      cursorY = drawTableHeader(doc, cursorY);

      const m = getPageMetrics(doc);
      const tableBottomLimit = m.bottom - 24;

      rows.forEach((row, index) => {
        const nextHeight = getRowHeight(doc, row);

        if ((cursorY + nextHeight) > tableBottomLimit) {
          doc.addPage();
          cursorY = drawHeader(doc, {
            company: normalizedCompany,
            apuracao,
            rows
          });
          cursorY = drawTableHeader(doc, cursorY);
        }

        cursorY = drawRow(doc, row, cursorY, index);
      });

      if (!rows.length) {
        drawBox(doc, m.left, cursorY, m.contentWidth, 24, '#ffffff', COLORS.border);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
        drawText(doc, 'Nenhum documento encontrado para esta apuração.', m.left + 8, cursorY + 7, {
          width: m.contentWidth - 16,
          align: 'center'
        });
      }

      drawFooter(doc, {
        company: normalizedCompany
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default generateFiscalApuracaoDocumentsPdf;