// /backend/reports/generationCustomersPdf.js
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ generationCustomersPdf.js — Relatório de Clientes (PDF | GRID | ESM)         ║
// ║ - A4 Paisagem (landscape)                                                    ║
// ║ - 1 cliente por linha (tabela “Excel” contínua)                              ║
// ║ - Colunas: ID | Nome Fantasia | CNPJ/CPF | E-mail | Telefone | Cidade | UF | ║
// ║           Vendedor | Segmento | Status | Situação                            ║
// ║ - ✅ Corrige “última coluna cortada” (ajuste de largura + rounding fix)      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

/* ─────────────────────────────────────────────────────────────
   🎨 Estilo
───────────────────────────────────────────────────────────── */
const COLORS = {
  headerBar: '#111827',
  headerText: '#ffffff',
  tableHeaderBg: '#f1f5f9',
  text: '#0f172a',
  muted: '#64748b',
  grid: '#111827',
  zebraAlt: '#fafafa',
};

const GRID_W = 1;
const PAD_X = 6;
const PAD_Y = 5;

// ✅ reserva de segurança na direita (evita “comer” a última coluna)
const TABLE_SAFE_RIGHT = 6;

/* ─────────────────────────────────────────────────────────────
   Utils
───────────────────────────────────────────────────────────── */
function safe(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (s === 'null' || s === 'undefined') return '';
  return s;
}
function fmtBool(v) {
  if (v === true) return 'Ativo';
  if (v === false) return 'Inativo';
  return '';
}
function normalizeFilters(filters = {}) {
  const q = (filters.q ?? '').toString().trim() || '';
  const is_active =
    filters.is_active === true ? true :
    filters.is_active === false ? false :
    null;
  return { q, is_active };
}
function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return null;
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function buildFileName() {
  return `relatorio_clientes_${nowStamp()}.pdf`;
}

/* ─────────────────────────────────────────────────────────────
   Texto “fit” (com reticências baseado em largura real do PDF)
───────────────────────────────────────────────────────────── */
function textFit(doc, text, maxWidth) {
  const s = String(text ?? '');
  if (!s) return '';
  if (doc.widthOfString(s) <= maxWidth) return s;

  let lo = 0;
  let hi = s.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const t = s.slice(0, mid) + '…';
    if (doc.widthOfString(t) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo) + '…';
}

/* ─────────────────────────────────────────────────────────────
   Header / Footer
───────────────────────────────────────────────────────────── */
function drawTopHeader(doc, { title, filters }) {
  const { q, is_active } = normalizeFilters(filters);

  const pageW = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;

  doc.save();
  doc.rect(0, 0, pageW, 54).fill(COLORS.headerBar);
  doc.restore();

  doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(14)
    .text('CONSART ERP', left, 14, { width: 260 });

  doc.font('Helvetica').fontSize(9)
    .text(new Date().toLocaleString('pt-BR'), left, 32, { width: 260 });

  doc.font('Helvetica-Bold').fontSize(13)
    .text(title, 0, 17, { align: 'center' });

  const filtroSit = is_active === null ? 'Todas' : (is_active ? 'Ativos' : 'Inativos');
  const filtroTxt = `Filtro: ${q || '—'}\nSituação: ${filtroSit}`;

  doc.font('Helvetica').fontSize(9)
    .text(filtroTxt, right - 360, 14, { width: 360, align: 'right' });

  doc.fillColor(COLORS.text);
  doc.y = doc.page.margins.top + 44;
}

function drawFooter(doc, pageNumber) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const bottomMargin = doc.page.margins.bottom;
  const y = doc.page.height - bottomMargin + 6;

  // O rodapé fica dentro da margem inferior: zera a margem enquanto escreve,
  // senão o pdfkit cria uma página nova (página em branco no relatório).
  doc.page.margins.bottom = 0;

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
    .text(`Página ${pageNumber}`, left, y, { width: right - left, align: 'right', lineBreak: false });

  doc.page.margins.bottom = bottomMargin;
  doc.fillColor(COLORS.text);
}

/* ─────────────────────────────────────────────────────────────
   Colunas
───────────────────────────────────────────────────────────── */
function getColumns() {
  return [
    { label: 'ID',            w: 6,  align: 'left',   value: (c) => safe(pick(c.customer_id, c.id)) },
    { label: 'Nome Fantasia', w: 20, align: 'left',   value: (c) => safe(pick(c.trade_name, c.nome_fantasia, c.fantasy_name)) },
    { label: 'CNPJ/CPF',      w: 12, align: 'left',   value: (c) => safe(pick(c.tax_id, c.cnpj_cpf, c.cnpjCpf, c.cpf_cnpj)) },
    { label: 'E-mail',        w: 18, align: 'left',   value: (c) => safe(pick(c.email, c.mail)) },
    { label: 'Telefone',      w: 12, align: 'left',   value: (c) => safe(pick(c.phone_number, c.phone, c.telefone, c.mobile_number, c.mobile)) },
    { label: 'Cidade',        w: 12, align: 'left',   value: (c) => safe(pick(c.city, c.cidade)) },
    { label: 'UF',            w: 5,  align: 'center', value: (c) => safe(pick(c.state, c.uf)) },
    { label: 'Vendedor',      w: 12, align: 'left',   value: (c) => safe(pick(c.salesperson, c.vendedor, c.seller_name)) },
    { label: 'Segmento',      w: 10, align: 'left',   value: (c) => safe(pick(c.business_segment, c.segmento)) },
    { label: 'Status',        w: 10, align: 'left',   value: (c) => safe(pick(c.status_name_pt, c.status_name, c.status_internal_code)) },
    // ✅ dá um pouco mais de “peso” na última coluna
    { label: 'Situação',      w: 10, align: 'center', value: (c) => fmtBool(pick(c.is_active)) },
  ];
}

/**
 * ✅ Aqui é onde corrigimos “última coluna cortada”:
 * - Calcula px por proporção
 * - Depois ajusta o ÚLTIMO px para fechar EXATAMENTE tableW
 */
function computeColumnWidths(columns, tableW) {
  const totalW = columns.reduce((sum, c) => sum + (c.w || 1), 0);

  const cols = columns.map((c) => ({
    ...c,
    px: Math.max(52, Math.floor((tableW * (c.w || 1)) / totalW)),
  }));

  // ✅ ajuste de rounding: soma exata = tableW
  const sum = cols.reduce((s, c) => s + c.px, 0);
  const diff = tableW - sum; // pode ser positivo/negativo

  // joga toda diferença no último item (Situação)
  cols[cols.length - 1].px = Math.max(52, cols[cols.length - 1].px + diff);

  return cols;
}

/* ─────────────────────────────────────────────────────────────
   Grid
───────────────────────────────────────────────────────────── */
function drawHeaderRow(doc, columns, x, y, rowH) {
  doc.save();
  doc.lineWidth(GRID_W).strokeColor(COLORS.grid);

  let cx = x;
  for (const col of columns) {
    doc.save();
    doc.rect(cx, y, col.px, rowH).fill(COLORS.tableHeaderBg);
    doc.restore();

    doc.rect(cx, y, col.px, rowH).stroke();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
    const maxW = col.px - (PAD_X * 2);
    const label = textFit(doc, col.label, maxW);

    doc.text(label, cx + PAD_X, y + PAD_Y, {
      width: maxW,
      align: col.align || 'left',
      lineBreak: false,
    });

    cx += col.px;
  }

  doc.restore();
}

function drawDataRow(doc, columns, row, x, y, rowH, zebra = false) {
  doc.save();
  doc.lineWidth(GRID_W).strokeColor(COLORS.grid);

  let cx = x;
  for (const col of columns) {
    if (zebra) {
      doc.save();
      doc.rect(cx, y, col.px, rowH).fill(COLORS.zebraAlt);
      doc.restore();
    }

    doc.rect(cx, y, col.px, rowH).stroke();

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    const raw = col.value ? col.value(row) : safe(row?.[col.key]);
    const maxW = col.px - (PAD_X * 2);
    const txt = textFit(doc, raw, maxW);

    doc.text(txt, cx + PAD_X, y + PAD_Y, {
      width: maxW,
      align: col.align || 'left',
      lineBreak: false,
    });

    cx += col.px;
  }

  doc.restore();
}

/* ─────────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────────── */
/**
 * @param {Object} params
 * @param {import('express').Request} params.req
 * @param {import('express').Response} params.res
 * @param {Array<Object>} params.rows
 * @param {Object} params.filters
 */
export async function generateCustomersPdf({ req, res, rows = [], filters = {} } = {}) {
  const filename = buildFileName();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 18, left: 18, right: 18, bottom: 22 },
    autoFirstPage: true,
    bufferPages: false,
  });

  doc.pipe(res);

  const title = 'Relatório de Clientes';

  const tableX = doc.page.margins.left;

  // ✅ reduz a largura do “tableW” um pouquinho pra garantir respiro à direita
  const rawTableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const tableW = rawTableW - TABLE_SAFE_RIGHT;

  const columns = computeColumnWidths(getColumns(), tableW);

  const headerH = 24;
  const rowH = 24;

  let pageNumber = 1;

  const redrawPage = () => {
    drawTopHeader(doc, { title, filters });

    const y0 = doc.y + 10;

    drawHeaderRow(doc, columns, tableX, y0, headerH);
    doc.y = y0 + headerH;
  };

  redrawPage();

  const data = Array.isArray(rows) ? rows : [];

  if (!data.length) {
    doc.font('Helvetica').fontSize(12).fillColor(COLORS.text)
      .text('Nenhum cliente encontrado para os filtros informados.', tableX, doc.y + 18);
    drawFooter(doc, pageNumber);
    doc.end();
    return;
  }

  let zebra = false;

  for (const row of data) {
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 18;

    if (doc.y + rowH > bottomLimit) {
      drawFooter(doc, pageNumber);
      doc.addPage();
      pageNumber += 1;
      redrawPage();
    }

    // doc.text() move o doc.y; parte sempre do topo da linha
    const rowY = doc.y;
    drawDataRow(doc, columns, row, tableX, rowY, rowH, zebra);
    doc.y = rowY + rowH;
    zebra = !zebra;
  }

  drawFooter(doc, pageNumber);
  doc.end();
}

export default { generateCustomersPdf };
