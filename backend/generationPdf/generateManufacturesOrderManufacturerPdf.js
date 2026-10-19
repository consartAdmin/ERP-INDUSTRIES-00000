// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generateManufacturesOrderManufacturerPdf.js                   ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ DESCRIPTION: PDF PARA ENVIO AO FABRICANTE - LANDSCAPE               ║
// ║ CONSART ERP | PDFKIT                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const LOGO_BH3_PATHS = [
  path.join(ROOT_DIR, 'public', 'imagens', 'logoBH3.png'),
  path.join(ROOT_DIR, 'public', 'imagens', 'bh3.png'),
  path.join(ROOT_DIR, 'public', 'imagens', 'logo-bh3.png'),
];

const LOGO_CONSART_PATHS = [
  path.join(ROOT_DIR, 'public', 'imagens', 'logoConsart3D.png'),
];

const COMPANY = {
  name: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
  cnpj: 'CNPJ: 34.363.337/0001-85',
  address1: 'Rua Alcântara, 126',
  address2: 'Nova Granada - Belo Horizonte/MG',
  cep: 'CEP: 30.431-315',
  phone: 'Telefone: (31) 9 8467-6552',
  email: 'contato@bh3distribuidora.com.br',
};

function findFirstExisting(paths = []) {
  return paths.find(filePath => fs.existsSync(filePath)) || null;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dateBR(value) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

function statusLabel(status = '') {
  const map = {
    OPEN: 'ABERTO',
    IN_PROGRESS: 'EM PRODUÇÃO',
    FINISHED: 'FINALIZADO',
    CANCELLED: 'CANCELADO',
  };

  return map[status] || status || '-';
}

function safe(value, fallback = '-') {
  if (value === null || value === undefined) return fallback;

  const text = String(value).trim();

  return text || fallback;
}

function sanitizeFilename(value = 'pedido') {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getManufacturesOrderManufacturerPdfFilename(order = {}) {
  const number =
    order.order_number ||
    order.manufacture_order_id ||
    order.id ||
    'pedido';

  return sanitizeFilename(`pedido-fabricante-${number}.pdf`);
}

function drawCompanyInfo(doc) {
  const x = 245;
  const y = 22;
  const w = 330;

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(COMPANY.name, x, y, {
      width: w,
      align: 'center',
    });

  doc
    .font('Helvetica')
    .fillColor('#475569')
    .fontSize(7.7)
    .text(COMPANY.cnpj, x, y + 16, {
      width: w,
      align: 'center',
    })
    .text(COMPANY.address1, x, y + 28, {
      width: w,
      align: 'center',
    })
    .text(COMPANY.address2, x, y + 40, {
      width: w,
      align: 'center',
    })
    .text(COMPANY.cep, x, y + 52, {
      width: w,
      align: 'center',
    })
    .text(COMPANY.phone, x, y + 64, {
      width: w,
      align: 'center',
    })
    .text(COMPANY.email, x, y + 76, {
      width: w,
      align: 'center',
    });
}

function drawHeader(doc, order = {}) {
  const logoBh3 = findFirstExisting(LOGO_BH3_PATHS);

  const logoX = 28;
  const logoY = 12;
  const logoW = 190;
  const logoH = 92;

  doc.rect(0, 0, doc.page.width, 118).fill('#ffffff');
  doc.rect(0, 118, doc.page.width, 2).fill('#1e293b');

  if (logoBh3) {
    try {
      doc.image(logoBh3, logoX, logoY, {
        fit: [logoW, logoH],
        align: 'center',
        valign: 'center',
      });
    } catch {
      doc
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('BH3', logoX + 62, logoY + 35);
    }
  } else {
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('BH3', logoX + 62, logoY + 35);
  }

  drawCompanyInfo(doc);

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(17)
    .text('PEDIDO PARA FABRICANTE', 585, 24, {
      width: 230,
      align: 'right',
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(`Pedido Nº: ${safe(order.order_number)}`, 585, 50, {
      width: 230,
      align: 'right',
    })
    .text(`Data: ${dateBR(order.created_at)}`, 585, 65, {
      width: 230,
      align: 'right',
    })
    .text(`Fabricante: ${safe(order.manufacturer_name)}`, 585, 80, {
      width: 230,
      align: 'right',
    });
}

function drawFooter(doc) {
  const logoConsart = findFirstExisting(LOGO_CONSART_PATHS);

  const footerY = doc.page.height - 96;
  const logoW = 190;
  const logoH = 50;
  const logoX = (doc.page.width / 2) - (logoW / 2);
  const logoY = footerY + 28;

  doc
    .rect(28, footerY - 12, doc.page.width - 56, 1)
    .fill('#e2e8f0');

  doc
    .fillColor('#64748b')
    .font('Helvetica')
    .fontSize(8)
    .text('Pedido gerado pelo CONSART ERP', 28, footerY, {
      width: doc.page.width - 56,
      align: 'center',
    });

  if (logoConsart) {
    try {
      doc.image(logoConsart, logoX, logoY, {
        fit: [logoW, logoH],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // não interrompe o PDF
    }
  }
}

function drawInfoBox(doc, order = {}, startY = 132) {
  const x = 28;
  const w = doc.page.width - 56;
  const h = 76;

  doc
    .roundedRect(x, startY, w, h, 8)
    .strokeColor('#dbe4f0')
    .lineWidth(1)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#334155')
    .text('Número Pedido', x + 14, startY + 12)
    .text('Fabricante', x + 210, startY + 12)
    .text('Status', x + 560, startY + 12)
    .text('Data', x + 680, startY + 12);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#0f172a')
    .text(safe(order.order_number), x + 14, startY + 30, { width: 170 })
    .text(safe(order.manufacturer_name), x + 210, startY + 30, { width: 325 })
    .text(statusLabel(order.status), x + 560, startY + 30, { width: 100 })
    .text(dateBR(order.created_at), x + 680, startY + 30, { width: 110 });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#334155')
    .text('Observações', x + 14, startY + 54);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#0f172a')
    .text(safe(order.notes, ''), x + 92, startY + 54, {
      width: w - 110,
      height: 18,
      ellipsis: true,
    });

  return startY + h + 18;
}

function drawTableHeader(doc, y) {
  const x = 28;
  const w = doc.page.width - 56;

  doc.rect(x, y, w, 24).fill('#1e293b');

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('SKU', x + 8, y + 8, { width: 80 })
    .text('DESCRIÇÃO', x + 96, y + 8, { width: 390 })
    .text('U.M', x + 500, y + 8, { width: 45, align: 'center' })
    .text('QTDE', x + 550, y + 8, { width: 55, align: 'right' })
    .text('UNITÁRIO', x + 620, y + 8, { width: 80, align: 'right' })
    .text('TOTAL', x + 710, y + 8, { width: 80, align: 'right' });

  return y + 24;
}

function drawTableRow(doc, item, y, index) {
  const x = 28;
  const w = doc.page.width - 56;
  const rowH = 25;

  const qty = Number(item.quantity || 0);
  const cost = Number(item.cost_price || item.cost || 0);
  const total = qty * cost;

  if (index % 2 === 0) {
    doc.rect(x, y, w, rowH).fill('#f8fafc');
  }

  doc
    .rect(x, y, w, rowH)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke();

  doc
    .fillColor('#0f172a')
    .font('Helvetica')
    .fontSize(8)
    .text(safe(item.sku || item.product_code), x + 8, y + 8, { width: 80 })
    .text(safe(item.description), x + 96, y + 8, { width: 390, ellipsis: true })
    .text(safe(item.unit || item.um || item.unidade, 'UN'), x + 500, y + 8, { width: 45, align: 'center' })
    .text(String(qty), x + 550, y + 8, { width: 55, align: 'right' })
    .text(money(cost), x + 620, y + 8, { width: 80, align: 'right' })
    .text(money(total), x + 710, y + 8, { width: 80, align: 'right' });

  return {
    nextY: y + rowH,
    total,
  };
}

function drawTotalBox(doc, y, total) {
  const boxW = 230;
  const boxH = 42;
  const x = doc.page.width - 28 - boxW;

  doc.roundedRect(x, y, boxW, boxH, 8).fill('#1e293b');

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('TOTAL GERAL', x + 14, y + 8);

  doc
    .fontSize(15)
    .text(money(total), x + 14, y + 22, {
      width: boxW - 28,
      align: 'right',
    });
}

function addNewPage(doc, order) {
  drawFooter(doc);
  doc.addPage();
  drawHeader(doc, order);
  return drawTableHeader(doc, 132);
}

export function buildManufacturesOrderManufacturerPdf(order = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 28,
    bufferPages: true,
  });

  const items = Array.isArray(order.items) ? order.items : [];

  drawHeader(doc, order);

  let y = drawInfoBox(doc, order, 132);
  y = drawTableHeader(doc, y);

  let grandTotal = 0;

  items.forEach((item, index) => {
    if (y > doc.page.height - 120) {
      y = addNewPage(doc, order);
    }

    const result = drawTableRow(doc, item, y, index);

    y = result.nextY;
    grandTotal += result.total;
  });

  if (y > doc.page.height - 125) {
    y = addNewPage(doc, order);
  }

  y += 18;

  drawTotalBox(doc, y, grandTotal);
  drawFooter(doc);

  return doc;
}

export default buildManufacturesOrderManufacturerPdf;