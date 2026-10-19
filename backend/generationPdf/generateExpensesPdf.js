// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generateExpensesPdf.js — Relatório PDF de Despesas (Expenses)        ║
// ║ Path: backend/generationPdf/generateExpensesPdf.js                   ║
// ║ CONSART ERP | ESM                                                    ║
// ║ - Gera PDF A4 Paisagem                                               ║
// ║ - Zebra table + header repetido a cada página                         ║
// ║ - Filtros: q, name, status, category, vendor, date_from, date_to     ║
// ║ - Ordenação compatível com o frontend (created_at_desc etc.)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import pool from '../config/db.js';

const TB = 'public."Expenses"'; // ajuste se seu schema/tabela for diferente

// pasta pública para download: backend/public (servida em /public pelo server.js).
// Relativo a este arquivo, não ao cwd — com cwd=backend o caminho virava backend/backend/public.
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT_DIR = path.join(PUBLIC_DIR, 'pdfs', 'expenses');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDateBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDateTimeBR(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function moneyBR(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusLabel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'PAID') return 'PAGO';
  if (v === 'CANCELLED') return 'CANCELADO';
  return 'PENDENTE';
}

function normalizeStr(s) {
  return String(s ?? '').trim();
}

/**
 * order_by keys (igual no frontend):
 * created_at_desc, created_at_asc,
 * due_date_asc, due_date_desc,
 * value_desc, value_asc,
 * name_asc, name_desc,
 * update_at_desc, update_at_asc  (frontend tem "update_at_*" (typo))
 */
function mapOrderBy(order_by) {
  const key = String(order_by || 'created_at_desc');
  switch (key) {
    case 'created_at_asc':  return `"created_at" ASC`;
    case 'created_at_desc': return `"created_at" DESC`;
    case 'due_date_asc':    return `"due_date" ASC NULLS LAST`;
    case 'due_date_desc':   return `"due_date" DESC NULLS LAST`;
    case 'value_asc':       return `"value" ASC NULLS LAST`;
    case 'value_desc':      return `"value" DESC NULLS LAST`;
    case 'name_asc':        return `"name" ASC NULLS LAST`;
    case 'name_desc':       return `"name" DESC NULLS LAST`;
    case 'update_at_asc':   return `"updated_at" ASC NULLS LAST`;
    case 'update_at_desc':  return `"updated_at" DESC NULLS LAST`;
    case 'updated_at_asc':  return `"updated_at" ASC NULLS LAST`;
    case 'updated_at_desc': return `"updated_at" DESC NULLS LAST`;
    default:                return `"created_at" DESC`;
  }
}

function buildWhereAndParams(filters = {}) {
  const params = [];
  const where = [];

  const q = normalizeStr(filters.q);
  const name = normalizeStr(filters.name);
  const status = normalizeStr(filters.status);
  const category = normalizeStr(filters.category);
  const vendor = normalizeStr(filters.vendor);
  const date_from = normalizeStr(filters.date_from);
  const date_to = normalizeStr(filters.date_to);

  // busca ampla
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    where.push(`(
      COALESCE("name",'') ILIKE ${p} OR
      COALESCE("description",'') ILIKE ${p} OR
      COALESCE("vendor",'') ILIKE ${p} OR
      COALESCE("category",'') ILIKE ${p}
    )`);
  }

  if (name) {
    params.push(`%${name}%`);
    where.push(`COALESCE("name",'') ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status.toUpperCase());
    where.push(`UPPER(COALESCE("status",'')) = $${params.length}`);
  }

  if (category) {
    params.push(`%${category}%`);
    where.push(`COALESCE("category",'') ILIKE $${params.length}`);
  }

  if (vendor) {
    params.push(`%${vendor}%`);
    where.push(`COALESCE("vendor",'') ILIKE $${params.length}`);
  }

  // período (pelo due_date)
  if (date_from) {
    params.push(date_from);
    where.push(`"due_date" >= $${params.length}::date`);
  }

  if (date_to) {
    params.push(date_to);
    where.push(`"due_date" <= $${params.length}::date`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function fetchExpensesForPdf({
  q, name, status, category, vendor,
  date_from, date_to,
  order_by = 'created_at_desc',
  limit = 2000, // limite de segurança (pdf não deve explodir)
} = {}) {
  const { whereSql, params } = buildWhereAndParams({
    q, name, status, category, vendor, date_from, date_to,
  });

  const orderSql = mapOrderBy(order_by);

  // total + soma (mesmos filtros)
  const sqlAgg = `
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(COALESCE("value",0)),0)::numeric AS total_value
    FROM ${TB}
    ${whereSql}
  `;

  const agg = await pool.query(sqlAgg, params);
  const total = agg.rows?.[0]?.total || 0;
  const total_value = agg.rows?.[0]?.total_value || 0;

  // linhas
  const params2 = [...params];
  params2.push(Number(limit));
  const pLimit = `$${params2.length}`;

  const sqlRows = `
    SELECT
      "id",
      "name",
      "category",
      "vendor",
      "value",
      "due_date",
      "status",
      "created_at",
      "updated_at"
    FROM ${TB}
    ${whereSql}
    ORDER BY ${orderSql}
    LIMIT ${pLimit}
  `;

  const rows = await pool.query(sqlRows, params2);
  return { total, total_value, rows: rows.rows || [] };
}

/* ──────────────────────────────────────────────────────────────
   PDF Layout helpers
────────────────────────────────────────────────────────────── */
function drawHeader(doc, meta) {
  const {
    title = 'RELATÓRIO DE DESPESAS',
    subtitle = '',
    filtersText = '',
    totalsText = '',
    generatedAt = '',
  } = meta || {};

  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const top = doc.page.margins.top;

  // header bar
  const barH = 54;
  doc.save();
  doc
    .rect(0, 0, pageW, barH)
    .fill('#f3f4f6');
  doc.restore();

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#0f172a')
    .text(title, margin, 16, { continued: false });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(subtitle, margin, 34);

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#475569')
    .text(generatedAt, 0, 18, { align: 'right' });

  // filters line
  const boxY = top + 16;
  if (filtersText || totalsText) {
    doc.save();
    doc
      .roundedRect(margin, boxY, pageW - margin * 2, 34, 8)
      .lineWidth(0.8)
      .strokeColor('#e5e7eb')
      .fillColor('#ffffff')
      .fillAndStroke();
    doc.restore();

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#334155')
      .text(filtersText || 'Filtros: (nenhum)', margin + 10, boxY + 8, {
        width: pageW - margin * 2 - 20,
        ellipsis: true,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#0f172a')
      .text(totalsText || '', margin + 10, boxY + 20, {
        width: pageW - margin * 2 - 20,
        ellipsis: true,
      });
  }

  // return y start for table
  return (filtersText || totalsText) ? (boxY + 48) : (top + 8);
}

function drawTableHeader(doc, x, y, cols) {
  doc.save();
  doc
    .rect(x, y, cols.totalW, cols.h)
    .fill('#f3f4f6');
  doc.restore();

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');

  for (const c of cols.items) {
    doc.text(c.label, c.x, y + 7, { width: c.w, align: c.align || 'left' });
  }

  doc
    .moveTo(x, y + cols.h)
    .lineTo(x + cols.totalW, y + cols.h)
    .lineWidth(0.8)
    .strokeColor('#e5e7eb')
    .stroke();

  return y + cols.h;
}

function drawRow(doc, x, y, cols, row, zebra) {
  const h = cols.rowH;

  // zebra bg
  doc.save();
  doc
    .rect(x, y, cols.totalW, h)
    .fill(zebra ? '#ffffff' : '#fafafa');
  doc.restore();

  doc.font('Helvetica').fontSize(9).fillColor('#0f172a');

  const cells = {
    id: String(row.expense_id || row.id || ''),
    name: String(row.name || ''),
    category: String(row.category || ''),
    vendor: String(row.vendor || ''),
    value: moneyBR(row.value),
    due: fmtDateBR(row.due_date),
    status: statusLabel(row.status),
    created: fmtDateTimeBR(row.created_at),
  };

  for (const c of cols.items) {
    let text = '';
    if (c.key === 'id') text = cells.id;
    if (c.key === 'name') text = cells.name;
    if (c.key === 'category') text = cells.category;
    if (c.key === 'vendor') text = cells.vendor;
    if (c.key === 'value') text = cells.value;
    if (c.key === 'due') text = cells.due;
    if (c.key === 'status') text = cells.status;
    if (c.key === 'created') text = cells.created;

    doc.text(text, c.x, y + 7, { width: c.w, align: c.align || 'left', ellipsis: true });
  }

  // row bottom line
  doc
    .moveTo(x, y + h)
    .lineTo(x + cols.totalW, y + h)
    .lineWidth(0.4)
    .strokeColor('#e5e7eb')
    .stroke();

  return y + h;
}

function drawFooter(doc, meta) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const margin = doc.page.margins.left;

  doc.save();
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(meta?.footerLeft || 'CONSART ERP • Despesas', margin, pageH - 26);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748b')
    .text(`Página ${doc.page.pageNumber}`, 0, pageH - 26, { align: 'right' });
  doc.restore();
}

function buildFiltersText(f = {}) {
  const parts = [];
  if (f.q) parts.push(`Busca="${f.q}"`);
  if (f.name) parts.push(`Nome="${f.name}"`);
  if (f.status) parts.push(`Status=${String(f.status).toUpperCase()}`);
  if (f.category) parts.push(`Categoria="${f.category}"`);
  if (f.vendor) parts.push(`Fornecedor="${f.vendor}"`);
  if (f.date_from) parts.push(`De=${fmtDateBR(f.date_from)}`);
  if (f.date_to) parts.push(`Até=${fmtDateBR(f.date_to)}`);
  if (f.order_by) parts.push(`Order=${f.order_by}`);
  return parts.length ? `Filtros: ${parts.join(' • ')}` : 'Filtros: (nenhum)';
}

/* ──────────────────────────────────────────────────────────────
   MAIN: generateExpensesPdf()
────────────────────────────────────────────────────────────── */
/**
 * @param {object} options
 * @param {object} options.filters
 * @param {string} options.baseUrl  (ex: http://localhost:8080) -> para montar url pública
 * @returns {Promise<{ ok:true, filePath:string, publicUrl:string, filename:string, total:number, total_value:number }>}
 */
export async function generateExpensesPdf({ filters = {}, baseUrl = '' } = {}) {
  ensureDirSync(OUT_DIR);

  // 1) fetch data
  const { total, total_value, rows } = await fetchExpensesForPdf({
    q: filters.q,
    name: filters.name,
    status: filters.status,
    category: filters.category,
    vendor: filters.vendor,
    date_from: filters.date_from,
    date_to: filters.date_to,
    order_by: filters.order_by || 'created_at_desc',
    limit: filters.limit || 2000,
  });

  // 2) output file
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  const filename = `expenses_${stamp}.pdf`;
  const filePath = path.join(OUT_DIR, filename);

  // 3) create PDF
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 70, left: 28, right: 28, bottom: 36 },
    autoFirstPage: true,
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // columns layout (A4 landscape)
  const margin = doc.page.margins.left;
  const pageW = doc.page.width;
  const tableW = pageW - margin * 2;

  const cols = {
    h: 26,
    rowH: 24,
    totalW: tableW,
    items: [],
  };

  // define columns (ajuste se quiser)
  const colDefs = [
    { key: 'id',      label: 'ID',          w: 50,  align: 'left' },
    { key: 'name',    label: 'Nome',        w: 180, align: 'left' },
    { key: 'category',label: 'Categoria',   w: 200, align: 'left' },
    { key: 'vendor',  label: 'Fornecedor',  w: 150, align: 'left' },
    { key: 'value',   label: 'Valor',       w: 95,  align: 'left' },
    { key: 'due',     label: 'Venc.',       w: 85,  align: 'left' },
    { key: 'status',  label: 'Status',      w: 90,  align: 'left' },
    { key: 'created', label: 'Criado em',   w: 150, align: 'left' },
  ];

  // fit columns to table width (scale if needed)
  const sumW = colDefs.reduce((a, c) => a + c.w, 0);
  const scale = sumW > tableW ? (tableW / sumW) : 1;

  let xCursor = margin;
  cols.items = colDefs.map(c => {
    const w = Math.floor(c.w * scale);
    const col = { ...c, x: xCursor, w };
    xCursor += w;
    return col;
  });

  // meta header
  const filtersText = buildFiltersText({
    q: filters.q,
    name: filters.name,
    status: filters.status,
    category: filters.category,
    vendor: filters.vendor,
    date_from: filters.date_from,
    date_to: filters.date_to,
    order_by: filters.order_by || 'created_at_desc',
  });

  const totalsText = `Total registros: ${total} • Soma valores: ${moneyBR(total_value)}`;
  const generatedAt = `Gerado em: ${fmtDateTimeBR(now.toISOString())}`;

  const headerMeta = {
    title: 'RELATÓRIO DE DESPESAS',
    subtitle: 'CONSART ERP • Financeiro',
    filtersText,
    totalsText,
    generatedAt,
    footerLeft: 'CONSART ERP • Despesas',
  };

  // header on first page
  let y = drawHeader(doc, headerMeta);

  // table header
  y = drawTableHeader(doc, margin, y, cols);

  // available height
  const pageH = doc.page.height;
  const bottomLimit = pageH - doc.page.margins.bottom - 10;

  // handle new pages
  const newPage = () => {
    doc.addPage();
    let yy = drawHeader(doc, headerMeta);
    yy = drawTableHeader(doc, margin, yy, cols);
    return yy;
  };

  // rows
  let zebra = true;
  for (let i = 0; i < rows.length; i++) {
    if (y + cols.rowH > bottomLimit) {
      drawFooter(doc, headerMeta);
      y = newPage();
    }
    y = drawRow(doc, margin, y, cols, rows[i], zebra);
    zebra = !zebra;
  }

  // footer last page
  drawFooter(doc, headerMeta);

  // finish
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // public url
  // arquivo salvo em: backend/public/pdfs/expenses/<file>
  const publicPath = `/public/pdfs/expenses/${filename}`;
  const publicUrl = baseUrl ? `${String(baseUrl).replace(/\/$/, '')}${publicPath}` : publicPath;

  return {
    ok: true,
    filename,
    filePath,
    publicUrl,
    total,
    total_value: Number(total_value || 0),
  };
}