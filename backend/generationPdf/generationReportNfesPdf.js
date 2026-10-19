// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationReportNfesPdf.js                                    ║
// ║ MODULE: PDF - Relatório de NF-es                                    ║
// ║ CONSART ERP                                                         ║
// ║ Gera PDF com resumo e listagem detalhada das NF-es filtradas        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE = {
  size: 'A4',
  layout: 'landscape',
  margin: 24,
};

const COLORS = {
  text: '#1f2937',
  muted: '#6b7280',
  line: '#d1d5db',
  headerBg: '#eef2f7',
  zebra: '#f8fafc',
  success: '#dcfce7',
  successText: '#166534',
  danger: '#fee2e2',
  dangerText: '#991b1b',
  warning: '#fef3c7',
  warningText: '#92400e',
  info: '#dbeafe',
  infoText: '#1d4ed8',
  white: '#ffffff',
  black: '#000000',
};

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTimeBR(value) {
  if (!value) return '';
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
      const [ymd, hm] = raw.split('T');
      const [y, m, da] = ymd.split('-');
      return `${da}/${m}/${y} ${hm.slice(0, 5)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, da] = raw.slice(0, 10).split('-');
      return `${da}/${m}/${y}`;
    }
    return raw;
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function onlyDateBR(value) {
  if (!value) return '';
  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, da] = raw.slice(0, 10).split('-');
      return `${da}/${m}/${y}`;
    }
    return raw;
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function getStatusLabel(status) {
  const s = normalizeStatus(status);
  if (!s) return 'SEM STATUS';
  if (s === 'CONCLUIDO' || s === 'CONCLUÍDO') return 'CONCLUÍDO';
  return s;
}

function getStatusColors(status) {
  const s = normalizeStatus(status);

  if (s === 'AUTORIZADA' || s === 'CONCLUIDO' || s === 'CONCLUÍDO') {
    return { bg: COLORS.success, text: COLORS.successText };
  }

  if (s.includes('CANCEL')) {
    return { bg: COLORS.info, text: COLORS.infoText };
  }

  if (s.includes('REJEIT')) {
    return { bg: COLORS.danger, text: COLORS.dangerText };
  }

  if (s.includes('PROCESS')) {
    return { bg: COLORS.warning, text: COLORS.warningText };
  }

  return { bg: COLORS.headerBg, text: COLORS.text };
}

function resolveLogoPath() {
  const candidates = [
    path.resolve(__dirname, '../public/imagens/brasaoConsartInfinity.png'),
    path.resolve(__dirname, '../../backend/public/imagens/brasaoConsartInfinity.png'),
    path.resolve(process.cwd(), 'backend/public/imagens/brasaoConsartInfinity.png'),
    path.resolve(process.cwd(), 'public/imagens/brasaoConsartInfinity.png'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

function drawText(doc, text, x, y, width, options = {}) {
  doc.text(String(text ?? ''), x, y, {
    width,
    ...options,
  });
}

function drawBox(doc, x, y, w, h, options = {}) {
  const {
    fill = null,
    stroke = COLORS.line,
    lineWidth = 0.6,
    radius = 4,
  } = options;

  doc.save();

  if (fill) {
    doc.roundedRect(x, y, w, h, radius).fill(fill);
  }

  if (stroke) {
    doc.lineWidth(lineWidth).strokeColor(stroke);
    doc.roundedRect(x, y, w, h, radius).stroke();
  }

  doc.restore();
}

function ensurePage(doc, neededHeight = 0, footerSpace = 28) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - footerSpace;
  if (doc.y + neededHeight <= bottomLimit) return false;
  doc.addPage();
  return true;
}

function drawHeader(doc, options = {}) {
  const margin = doc.page.margins.left;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const logoPath = resolveLogoPath();
  const topY = 20;
  const headerH = 54;

  drawBox(doc, margin, topY, pageWidth, headerH, {
    fill: COLORS.headerBg,
    stroke: COLORS.line,
    radius: 6,
  });

  if (logoPath) {
    try {
      doc.image(logoPath, margin + 10, topY + 7, { fit: [42, 40], align: 'center', valign: 'center' });
    } catch {
      // ignora erro de imagem
    }
  }

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(16);
  doc.text('RELATÓRIO DE NF-e', margin + 62, topY + 10);

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9);
  doc.text(
    options.subtitle || 'Conferência de notas fiscais para revisão contábil',
    margin + 62,
    topY + 30,
  );

  doc.fillColor(COLORS.text).font('Helvetica').fontSize(8);
  doc.text(
    `Gerado em: ${dateTimeBR(new Date())}`,
    margin + pageWidth - 170,
    topY + 12,
    { width: 160, align: 'right' },
  );

  doc.y = topY + headerH + 10;
}

function drawFiltersBlock(doc, filters = {}) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const h = 42;

  drawBox(doc, x, y, w, h, {
    fill: COLORS.white,
    stroke: COLORS.line,
    radius: 6,
  });

  const q = filters.q || 'Todos';
  const status = filters.status || 'Todos';
  const dataIni = filters.dataIni ? onlyDateBR(filters.dataIni) : '—';
  const dataFim = filters.dataFim ? onlyDateBR(filters.dataFim) : '—';
  const sortBy = filters.sortBy || 'pedido';
  const sortOrder = (filters.sortOrder || 'desc').toUpperCase();

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9);
  doc.text('Filtros aplicados', x + 10, y + 7);

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
  doc.text(`Busca: ${q}`, x + 10, y + 21, { width: 280 });
  doc.text(`Status: ${status}`, x + 300, y + 21, { width: 120 });
  doc.text(`Período: ${dataIni} até ${dataFim}`, x + 420, y + 21, { width: 170 });
  doc.text(`Ordem: ${sortBy} / ${sortOrder}`, x + 595, y + 21, { width: 140 });

  doc.y = y + h + 10;
}

function buildSummary(rows = []) {
  const summary = {
    totalNotas: rows.length,
    valorTotal: 0,
    concluidas: 0,
    canceladas: 0,
    rejeitadas: 0,
    processando: 0,
    outras: 0,
  };

  for (const row of rows) {
    const status = normalizeStatus(row.nfe_status);
    const total = Number(row.total_amount || 0);

    summary.valorTotal += total;

    if (status === 'AUTORIZADA' || status === 'CONCLUIDO' || status === 'CONCLUÍDO') {
      summary.concluidas += 1;
      continue;
    }
    if (status.includes('CANCEL')) {
      summary.canceladas += 1;
      continue;
    }
    if (status.includes('REJEIT')) {
      summary.rejeitadas += 1;
      continue;
    }
    if (status.includes('PROCESS')) {
      summary.processando += 1;
      continue;
    }
    summary.outras += 1;
  }

  return summary;
}

function drawSummaryCards(doc, summary) {
  const x = doc.page.margins.left;
  const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 8;
  const cardW = (totalWidth - gap * 4) / 5;
  const y = doc.y;
  const cardH = 56;

  const cards = [
    { title: 'Total NF-es', value: String(summary.totalNotas), bg: COLORS.headerBg, color: COLORS.text },
    { title: 'Valor Total', value: `R$ ${moneyBR(summary.valorTotal)}`, bg: COLORS.headerBg, color: COLORS.text },
    { title: 'Concluídas', value: String(summary.concluidas), bg: COLORS.success, color: COLORS.successText },
    { title: 'Canceladas', value: String(summary.canceladas), bg: COLORS.info, color: COLORS.infoText },
    { title: 'Rejeitadas', value: String(summary.rejeitadas), bg: COLORS.danger, color: COLORS.dangerText },
  ];

  cards.forEach((card, i) => {
    const left = x + i * (cardW + gap);

    drawBox(doc, left, y, cardW, cardH, {
      fill: card.bg,
      stroke: COLORS.line,
      radius: 6,
    });

    doc.fillColor(card.color).font('Helvetica-Bold').fontSize(9);
    doc.text(card.title, left + 10, y + 10, { width: cardW - 20 });

    doc.fillColor(card.color).font('Helvetica-Bold').fontSize(15);
    doc.text(card.value, left + 10, y + 27, { width: cardW - 20 });
  });

  doc.y = y + cardH + 14;
}

function drawTableHeader(doc, cols) {
  const y = doc.y;
  const x = doc.page.margins.left;
  const h = 22;

  drawBox(doc, x, y, cols.reduce((acc, c) => acc + c.w, 0), h, {
    fill: COLORS.headerBg,
    stroke: COLORS.line,
    radius: 0,
  });

  let left = x;
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(8);

  for (const col of cols) {
    drawText(doc, col.label, left + 4, y + 7, col.w - 8, {
      align: col.align || 'left',
      lineBreak: false,
    });
    left += col.w;
  }

  doc.y = y + h;
}

function drawTableRow(doc, cols, row, rowIndex) {
  const x = doc.page.margins.left;
  const values = cols.map((col) => {
    const v = typeof col.getter === 'function' ? col.getter(row) : row[col.key];
    return String(v ?? '');
  });

  const lineHeights = values.map((value, idx) => {
    const col = cols[idx];
    return doc.heightOfString(value, {
      width: col.w - 8,
      align: col.align || 'left',
    });
  });

  const h = Math.max(22, Math.ceil(Math.max(...lineHeights)) + 8);
  ensurePage(doc, h + 4);

  const y = doc.y;
  const totalW = cols.reduce((acc, c) => acc + c.w, 0);

  if (rowIndex % 2 === 0) {
    drawBox(doc, x, y, totalW, h, {
      fill: COLORS.zebra,
      stroke: COLORS.line,
      radius: 0,
    });
  } else {
    drawBox(doc, x, y, totalW, h, {
      fill: COLORS.white,
      stroke: COLORS.line,
      radius: 0,
    });
  }

  let left = x;

  cols.forEach((col, idx) => {
    if (col.key === 'nfe_status') {
      const colors = getStatusColors(values[idx]);
      const badgeW = Math.min(col.w - 12, Math.max(46, doc.widthOfString(values[idx], { font: 'Helvetica-Bold', size: 7 }) + 18));
      const badgeH = 13;
      const bx = left + 4;
      const by = y + (h - badgeH) / 2;

      drawBox(doc, bx, by, badgeW, badgeH, {
        fill: colors.bg,
        stroke: null,
        radius: 6,
      });

      doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(7);
      doc.text(values[idx], bx, by + 3, {
        width: badgeW,
        align: 'center',
        lineBreak: false,
      });
    } else {
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(7.5);
      drawText(doc, values[idx], left + 4, y + 4, col.w - 8, {
        align: col.align || 'left',
      });
    }

    left += col.w;
  });

  doc.y = y + h;
}

function drawFooter(doc) {
  const bottomY = doc.page.height - 18;
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.save();
  doc.strokeColor(COLORS.line).lineWidth(0.5);
  doc.moveTo(left, bottomY - 6).lineTo(right, bottomY - 6).stroke();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7);
  doc.text(
    `CONSART ERP • Página ${doc.page.number}`,
    left,
    bottomY - 2,
    { width: right - left, align: 'right' },
  );
  doc.restore();
}

function attachFooterOnPages(doc) {
  const originalAddPage = doc.addPage.bind(doc);

  doc.addPage = (...args) => {
    const result = originalAddPage(...args);
    drawFooter(doc);
    return result;
  };

  drawFooter(doc);
}

function getColumns() {
  return [
    {
      key: 'order_number',
      label: 'Pedido',
      w: 46,
      align: 'center',
      getter: (r) => r.order_number || r.order_id || '',
    },
    {
      key: 'issue_date',
      label: 'Emissão',
      w: 68,
      getter: (r) => onlyDateBR(r.issue_date || r.created_at || ''),
    },
    {
      key: 'nfe_number',
      label: 'Nº NF-e',
      w: 50,
      align: 'center',
      getter: (r) => r.nfe_number || '',
    },
    {
      key: 'serie',
      label: 'Série',
      w: 38,
      align: 'center',
      getter: (r) => r.serie || '',
    },
    {
      key: 'customer_name',
      label: 'Cliente',
      w: 160,
      getter: (r) => r.customer_name || '',
    },
    {
      key: 'customer_tax_id',
      label: 'CNPJ/CPF',
      w: 86,
      align: 'center',
      getter: (r) => r.customer_tax_id || '',
    },
    {
      key: 'nfe_key',
      label: 'Chave de Acesso',
      w: 168,
      getter: (r) => r.nfe_key || '',
    },
    {
      key: 'total_amount',
      label: 'Total (R$)',
      w: 62,
      align: 'right',
      getter: (r) => moneyBR(r.total_amount || 0),
    },
    {
      key: 'nfe_status',
      label: 'Status',
      w: 72,
      getter: (r) => getStatusLabel(r.nfe_status),
    },
    {
      key: 'nfe_environment',
      label: 'Ambiente',
      w: 62,
      align: 'center',
      getter: (r) => {
        const env = String(r.nfe_environment || r.environment || '').toUpperCase();
        if (env.startsWith('PROD')) return 'PRODUÇÃO';
        if (env.startsWith('HOM')) return 'HOMOLOG.';
        return env || 'N/D';
      },
    },
    {
      key: 'protocol',
      label: 'Protocolo',
      w: 84,
      getter: (r) => r.protocol || '',
    },
  ];
}

function pipeToTarget(doc, output) {
  if (output?.type === 'response' && output.res) {
    doc.pipe(output.res);
    return;
  }

  if (output?.type === 'stream' && output.stream) {
    doc.pipe(output.stream);
    return;
  }

  if (output?.type === 'file' && output.filePath) {
    fs.mkdirSync(path.dirname(output.filePath), { recursive: true });
    doc.pipe(fs.createWriteStream(output.filePath));
    return;
  }

  throw new Error('Saída PDF inválida. Use response, stream ou file.');
}

/**
 * Gera relatório PDF de NF-es.
 *
 * @param {Object} params
 * @param {Array<Object>} params.rows
 * @param {Object} [params.filters]
 * @param {Object} params.output
 * @param {'response'|'stream'|'file'} params.output.type
 * @param {import('express').Response} [params.output.res]
 * @param {import('stream').Writable} [params.output.stream]
 * @param {string} [params.output.filePath]
 */
export async function generateReportNfesPdf({
  rows = [],
  filters = {},
  output,
} = {}) {
  const doc = new PDFDocument({
    size: PAGE.size,
    layout: PAGE.layout,
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    bufferPages: false,
  });

  pipeToTarget(doc, output);
  attachFooterOnPages(doc);

  drawHeader(doc, {
    subtitle: 'Relação completa das NF-es para conferência antes do envio à contabilidade',
  });

  drawFiltersBlock(doc, filters);

  const summary = buildSummary(rows);
  drawSummaryCards(doc, summary);

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(11);
  doc.text('Listagem detalhada das NF-es', doc.page.margins.left, doc.y);

  doc.moveDown(0.5);

  const cols = getColumns();
  drawTableHeader(doc, cols);

  rows.forEach((row, index) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 48) {
      doc.addPage();
      drawTableHeader(doc, cols);
    }
    drawTableRow(doc, cols, row, index);
  });

  if (!rows.length) {
    doc.moveDown(1);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10);
    doc.text('Nenhuma NF-e encontrada para os filtros informados.', doc.page.margins.left, doc.y);
  }

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });
}

export default generateReportNfesPdf;