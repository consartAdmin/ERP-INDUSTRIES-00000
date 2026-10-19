'use strict';

import PDFDocument from 'pdfkit';

const MAX_ROWS = 20000;
const PAGE = { size: 'A4', layout: 'landscape', margin: 28 };
const COLORS = {
  black: '#111827', gray: '#6B7280', light: '#F3F4F6',
  border: '#D1D5DB', green: '#166534', amber: '#92400E', white: '#FFFFFF',
};

const STATUS_LABELS = Object.freeze({
  PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado', CANCELED: 'Cancelado', PARTIAL: 'Parcial',
});

const OPEN_STATUSES = new Set(['PENDING', 'OVERDUE', 'PARTIAL']);

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateBR(value) {
  if (!value) return '-';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${value.getUTCFullYear()}`;
  }

  const source = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(source);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(source);
  if (brMatch) return `${brMatch[1]}/${brMatch[2]}/${brMatch[3]}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parsed);
}

function text(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function statusLabel(value) {
  const key = String(value ?? '').trim().toUpperCase();
  return STATUS_LABELS[key] || text(value);
}

function truncate(doc, value, width) {
  const source = text(value);
  if (doc.widthOfString(source) <= width) return source;
  let output = source;
  while (output.length > 1 && doc.widthOfString(`${output}…`) > width) output = output.slice(0, -1);
  return `${output}…`;
}

function filterDescription(filters = {}) {
  const parts = [];
  if (filters.search) parts.push(`Busca: ${filters.search}`);
  if (filters.status) parts.push(`Status: ${statusLabel(filters.status)}`);

  const dateType = String(filters.dateType || '').toLowerCase() === 'issue_date'
    ? 'issue_date'
    : 'due_date';
  const fromDate = filters.fromDate || (
    dateType === 'issue_date' ? filters.fromIssueDate : filters.fromDueDate
  );
  const toDate = filters.toDate || (
    dateType === 'issue_date' ? filters.toIssueDate : filters.toDueDate
  );

  if (fromDate || toDate) {
    parts.push(`${dateType === 'issue_date' ? 'Emissão' : 'Vencimento'}: ${dateBR(fromDate)} até ${dateBR(toDate)}`);
  }
  return parts.length ? parts.join('  |  ') : 'Filtros: todos os registros';
}

const COLUMNS = [
  { key: 'id', label: 'ID', x: 28, width: 38, align: 'left' },
  { key: 'customer_name', label: 'Cliente', x: 70, width: 176, align: 'left' },
  { key: 'invoice_number', label: 'Nº Fatura', x: 250, width: 68, align: 'left' },
  { key: 'issue_date', label: 'Emissão', x: 322, width: 66, align: 'left' },
  { key: 'due_date', label: 'Vencimento', x: 392, width: 70, align: 'left' },
  { key: 'status', label: 'Status', x: 466, width: 64, align: 'left' },
  { key: 'value', label: 'Total', x: 534, width: 78, align: 'right' },
  { key: 'paid_value', label: 'Recebido', x: 616, width: 78, align: 'right' },
  { key: 'balance', label: 'Saldo', x: 698, width: 86, align: 'right' },
];

function addHeader(doc, filters, rowsCount) {
  doc.fillColor(COLORS.black).font('Helvetica-Bold').fontSize(14)
    .text('CONSART ERP — CONTAS A RECEBER', 28, 24, { align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.gray)
    .text(filterDescription(filters), 28, 45, { width: 756, align: 'left' })
    .text(`${rowsCount} registro(s)`, 28, 45, { width: 756, align: 'right' });
  doc.moveTo(28, 59).lineTo(784, 59).strokeColor(COLORS.border).lineWidth(0.6).stroke();
  return 66;
}

function addTableHeader(doc, y) {
  doc.rect(28, y, 756, 18).fill(COLORS.black);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.white);
  for (const column of COLUMNS) {
    doc.text(column.label, column.x + 3, y + 5, {
      width: column.width - 6, align: column.align, lineBreak: false,
    });
  }
  return y + 18;
}

function rowValue(row, key) {
  if (key === 'issue_date') return dateBR(row.issue_date ?? row.emissao);
  if (key === 'due_date') return dateBR(row.due_date ?? row.vencimento);
  if (key === 'status') return statusLabel(row[key]);
  if (key === 'value' || key === 'paid_value') return money(row[key]);
  if (key === 'balance') return money(number(row.value) - number(row.paid_value));
  return text(row[key]);
}

function addRow(doc, row, y, index) {
  const height = 16;
  if (index % 2) doc.rect(28, y, 756, height).fill(COLORS.light);
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.black);
  for (const column of COLUMNS) {
    const value = truncate(doc, rowValue(row, column.key), column.width - 6);
    doc.text(value, column.x + 3, y + 4.5, {
      width: column.width - 6, align: column.align, lineBreak: false,
    });
  }
  doc.moveTo(28, y + height).lineTo(784, y + height)
    .strokeColor(COLORS.border).lineWidth(0.25).stroke();
  return y + height;
}

function addTotals(doc, rows, y) {
  const totals = rows.reduce((acc, row) => {
    const total = number(row.value);
    const paid = number(row.paid_value);
    const balance = Math.max(0, total - paid);
    const status = String(row.status ?? '').trim().toUpperCase();
    acc.total += total;
    acc.paid += paid;
    if (OPEN_STATUSES.has(status)) acc.balance += balance;
    return acc;
  }, { total: 0, paid: 0, balance: 0 });

  doc.rect(28, y, 756, 25).fill(COLORS.light);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.black)
    .text(`TOTAL: ${money(totals.total)}`, 300, y + 8, { width: 150, align: 'right' })
    .fillColor(COLORS.green)
    .text(`PAGO: ${money(totals.paid)}`, 456, y + 8, { width: 150, align: 'right' })
    .fillColor(COLORS.amber)
    .text(`ABERTO: ${money(totals.balance)}`, 612, y + 8, { width: 166, align: 'right' });
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.gray)
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')}  •  Página ${i + 1} de ${range.count}`,
        28, 565, { width: 756, align: 'center', lineBreak: false });
  }
}

export function generateAccountsReceivablePdf({ rows = [], filters = {} } = {}) {
  return new Promise((resolve, reject) => {
    const safeRows = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
    const doc = new PDFDocument({
      ...PAGE,
      bufferPages: true,
      info: { Title: 'CONSART ERP — Contas a Receber', Author: 'CONSART ERP' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    let y = addHeader(doc, filters, safeRows.length);
    y = addTableHeader(doc, y);
    safeRows.forEach((row, index) => {
      if (y + 16 > 552) {
        doc.addPage();
        y = addHeader(doc, filters, safeRows.length);
        y = addTableHeader(doc, y);
      }
      y = addRow(doc, row, y, index);
    });

    if (y + 25 > 552) {
      doc.addPage();
      y = addHeader(doc, filters, safeRows.length);
    }
    addTotals(doc, safeRows, y + 4);
    addFooters(doc);
    doc.end();
  });
}

export default generateAccountsReceivablePdf;
