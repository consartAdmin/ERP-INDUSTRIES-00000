// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ generateStockPositionPdf.js — PDF Posição de Estoque (Custo x Qtde)         ║
// ║ CONSART ERP — PDFKit: tabela com zebra, bordas, cabeçalho e totais          ║
// ║ Exporta: generateStockPositionPdf({ rows, filterText }) -> Buffer           ║
// ║ ✅ Atualização: adiciona coluna "Total" (Custo x Estoque)                    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');

function nowPtBr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function drawHeader(doc, { title, subtitle, filterText }) {
  const pageW = doc.page.width;
  const margin = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;

  const barH = 44;
  doc.save().rect(0, 0, pageW, barH).fill('#0f172a').restore();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(title, margin, 12, { width: right - margin, align: 'left' });

  const y0 = barH + 14;

  doc
    .fillColor('#0f172a')
    .font('Helvetica')
    .fontSize(11)
    .text(subtitle, margin, y0);

  doc.fillColor('#334155').fontSize(9).text(`Gerado em: ${nowPtBr()}`, margin, y0 + 16);

  if (filterText) {
    doc.fillColor('#334155').fontSize(9).text(`Filtro: ${filterText}`, margin, y0 + 30);
  }

  doc
    .save()
    .moveTo(margin, y0 + 48)
    .lineTo(right, y0 + 48)
    .lineWidth(1)
    .strokeColor('#e2e8f0')
    .stroke()
    .restore();

  return y0 + 62;
}

function drawTableHeader(doc, x, y, col, opts = {}) {
  const h = opts.headerH ?? 22;

  doc.save().rect(x, y, col.totalW, h).fill('#f1f5f9').restore();
  doc.save().rect(x, y, col.totalW, h).lineWidth(1).strokeColor('#cbd5e1').stroke().restore();

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);

  doc.text('ID', x + 6, y + 6, { width: col.wId - 12, align: 'left' });
  doc.text('Código', x + col.wId + 6, y + 6, { width: col.wCode - 12, align: 'left' });
  doc.text('Descrição', x + col.wId + col.wCode + 6, y + 6, { width: col.wDesc - 12, align: 'left' });
  doc.text('Custo', x + col.wId + col.wCode + col.wDesc + 6, y + 6, { width: col.wCost - 12, align: 'right' });
  doc.text('Estoque', x + col.wId + col.wCode + col.wDesc + col.wCost + 6, y + 6, { width: col.wStock - 12, align: 'right' });
  doc.text('Total', x + col.wId + col.wCode + col.wDesc + col.wCost + col.wStock + 6, y + 6, { width: col.wTotal - 12, align: 'right' });

  return y + h;
}

function drawRow(doc, x, y, col, r, idx, rowH = 20) {
  const zebra = idx % 2 === 1;
  if (zebra) doc.save().rect(x, y, col.totalW, rowH).fill('#fcfcfd').restore();

  doc
    .save()
    .moveTo(x, y + rowH)
    .lineTo(x + col.totalW, y + rowH)
    .lineWidth(1)
    .strokeColor('#eef2f7')
    .stroke()
    .restore();

  // grade vertical
  doc.save().lineWidth(1).strokeColor('#eef2f7');
  let vx = x;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wId;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wCode;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wDesc;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wCost;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wStock;
  doc.moveTo(vx, y).lineTo(vx, y + rowH).stroke(); vx += col.wTotal;
  doc.moveTo(x + col.totalW, y).lineTo(x + col.totalW, y + rowH).stroke();
  doc.restore();

  doc.fillColor('#0f172a').font('Helvetica').fontSize(9);

  const id = r.id ?? r.product_id ?? '';
  const code = r.code ?? r.product_code ?? '';
  const desc = r.description ?? r.descricao ?? '';

  const costNum = Number(r.cost ?? r.cost_price ?? 0) || 0;
  const stockNum = Number(r.stock ?? r.stock_qty ?? 0) || 0;
  const totalNum = costNum * stockNum;

  const cost = fmtMoney(costNum);
  const stock = fmtNum(stockNum);
  const total = fmtMoney(totalNum);

  doc.text(String(id), x + 6, y + 5, { width: col.wId - 12, align: 'left', ellipsis: true });
  doc.text(String(code), x + col.wId + 6, y + 5, { width: col.wCode - 12, align: 'left', ellipsis: true });
  doc.text(String(desc), x + col.wId + col.wCode + 6, y + 5, { width: col.wDesc - 12, align: 'left', ellipsis: true });
  doc.text(String(cost), x + col.wId + col.wCode + col.wDesc + 6, y + 5, { width: col.wCost - 12, align: 'right', ellipsis: true });
  doc.text(String(stock), x + col.wId + col.wCode + col.wDesc + col.wCost + 6, y + 5, { width: col.wStock - 12, align: 'right', ellipsis: true });
  doc.text(String(total), x + col.wId + col.wCode + col.wDesc + col.wCost + col.wStock + 6, y + 5, { width: col.wTotal - 12, align: 'right', ellipsis: true });

  return y + rowH;
}

function drawTotals(doc, { totalStock, totalCost }) {
  const margin = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  const y = doc.y + 18;
  const cardH = 46;
  const gap = 10;
  const cardW = Math.floor((right - margin - gap) / 2);

  doc.save().roundedRect(margin, y, cardW, cardH, 10).fill('#f8fafc').restore();
  doc.save().roundedRect(margin, y, cardW, cardH, 10).lineWidth(1).strokeColor('#e2e8f0').stroke().restore();

  doc.fillColor('#334155').font('Helvetica').fontSize(9).text('TOTAL ESTOQUE', margin + 12, y + 10);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(fmtNum(totalStock), margin + 12, y + 24);

  const x2 = margin + cardW + gap;

  doc.save().roundedRect(x2, y, cardW, cardH, 10).fill('#f8fafc').restore();
  doc.save().roundedRect(x2, y, cardW, cardH, 10).lineWidth(1).strokeColor('#e2e8f0').stroke().restore();

  doc.fillColor('#334155').font('Helvetica').fontSize(9).text('TOTAL (CUSTO)', x2 + 12, y + 10);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(fmtMoney(totalCost), x2 + 12, y + 24);

  doc.moveDown(4);
}

export async function generateStockPositionPdf({ rows = [], filterText = '' } = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape', // ✅ LANDSCAPE
    margins: { top: 56, left: 36, right: 36, bottom: 42 },
    bufferPages: true,
  });

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const title = 'CONSART ERP';
  const subtitle = 'Relatório: Posição de Estoque (Custo x Quantidade)';

  const margin = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalW = right - margin;

  // ✅ Agora com coluna TOTAL
  const col = {
    wId: 58,
    wCode: 110,
    wCost: 100,
    wStock: 90,
    wTotal: 120, // ✅ NOVO
  };
  col.wDesc = totalW - (col.wId + col.wCode + col.wCost + col.wStock + col.wTotal);
  col.totalW = totalW;

  let y = drawHeader(doc, { title, subtitle, filterText });

  const headerH = 22;
  const rowH = 20;

  y = drawTableHeader(doc, margin, y, col, { headerH });

  let totalStock = 0;
  let totalCost = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const stock = Number(r.stock ?? r.stock_qty ?? 0) || 0;
    const cost = Number(r.cost ?? r.cost_price ?? 0) || 0;

    totalStock += stock;
    totalCost += cost * stock;

    const bottomLimit = doc.page.height - doc.page.margins.bottom - 80;
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawHeader(doc, { title, subtitle, filterText });
      y = drawTableHeader(doc, margin, y, col, { headerH });
    }

    y = drawRow(doc, margin, y, col, r, i, rowH);
    doc.y = y;
  }

  const bottomLimit2 = doc.page.height - doc.page.margins.bottom - 70;
  if (doc.y + 70 > bottomLimit2) doc.addPage();

  drawTotals(doc, { totalStock, totalCost });

  doc.end();

  return await new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}