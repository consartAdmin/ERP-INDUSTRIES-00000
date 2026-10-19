// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationCashMovimentsPdf.js — Relatório de Caixa (A4 landscape)           ║
// ║ CONSART ERP — PDFKit                                                ║
// ║ ✅ Categoria/Subcategoria removidas                                  ║
// ║ ✅ Plano de Contas exibido no lugar                                  ║
// ║ ✅ Dashboard por Plano de Contas                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import moment from 'moment';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import enterpriseApi from '../repositories/enterprise/enterprise.index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Helpers de formatação
const moneyBR = (n) => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');

const cleanText = (value) => String(value ?? '').trim();

function formatCnpj(value) {
  const digits = cleanText(value).replace(/\D+/g, '');
  if (digits.length !== 14) return cleanText(value);
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatZipCode(value) {
  const digits = cleanText(value).replace(/\D+/g, '');
  if (digits.length !== 8) return cleanText(value);
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

function joinNonEmpty(values, separator = ', ') {
  return values.map(cleanText).filter(Boolean).join(separator);
}

async function resolveLogoSource(value) {
  const source = cleanText(value);
  if (!source) return caminhoLogoDefault();

  if (/^https?:\/\//i.test(source)) {
    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.warn('[PDF Caixa] Não foi possível carregar logo_url:', error.message);
      return caminhoLogoDefault();
    }
  }

  if (source.startsWith('file://')) return fileURLToPath(source);
  return path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
}

function canUseImage(source) {
  return Buffer.isBuffer(source) || (typeof source === 'string' && fs.existsSync(source));
}

function buildCompanyHeader(enterprise = {}, legacyCompany = {}) {
  const street = joinNonEmpty([enterprise.address, enterprise.address_number]);
  const cityState = joinNonEmpty([enterprise.city, enterprise.state], ' - ');
  const zipCode = formatZipCode(enterprise.zip_code);
  const address = joinNonEmpty([
    street,
    enterprise.address_complement,
    enterprise.district,
    cityState,
    zipCode ? `CEP ${zipCode}` : '',
  ]);

  const phoneParts = [];
  if (cleanText(enterprise.phone)) phoneParts.push(`Telefone: ${cleanText(enterprise.phone)}`);
  if (cleanText(enterprise.whatsapp)) phoneParts.push(`WhatsApp: ${cleanText(enterprise.whatsapp)}`);

  const digitalParts = [];
  if (cleanText(enterprise.email)) digitalParts.push(`E-mail: ${cleanText(enterprise.email)}`);
  if (cleanText(enterprise.website)) digitalParts.push(`Site: ${cleanText(enterprise.website)}`);

  return {
    name: cleanText(enterprise.trade_name)
      || cleanText(enterprise.corporate_name)
      || cleanText(legacyCompany.name)
      || 'Empresa não informada',
    corporateName: cleanText(enterprise.corporate_name),
    cnpj: formatCnpj(enterprise.cnpj) || cleanText(legacyCompany.cnpj),
    stateRegistration: cleanText(enterprise.state_registration),
    address: address || cleanText(legacyCompany.address),
    contacts: phoneParts.join(' | ') || cleanText(legacyCompany.contacts),
    site: digitalParts.join(' | ') || cleanText(legacyCompany.site),
    footer: cleanText(enterprise.pdf_footer),
    paperclipPath: legacyCompany.paperclipPath || null,
    logoPath: cleanText(enterprise.logo_url) || legacyCompany.logoPath || caminhoLogoDefault(),
  };
}

// Tamanhos (pt)
const BASE_FONT_SIZE = 6;
const HEADER_FONT_SIZE = 8;
const PLAN_FONT_SIZE = 6;

// Ícone
const PAPERCLIP_W = 9;
const PAPERCLIP_H = 9;
const GUTTER_INSET = 4;

const ID_TEXT_PADDINGY = 3;

// Caminhos default de imagens
const caminhoLogoDefault = () => path.resolve(__dirname, '../../public/imagens/logoconsart.png');
const caminhoPaperclipDefault = () =>
  path.resolve(__dirname, '../public/imagens/paperclip.png');

const vCenter = (y, h, fontSize) => y + (h - fontSize) / 2 - 0.5;

function drawCell(doc, text, x, y, w, h, opts = {}) {
  const { align = 'left', fontSize = BASE_FONT_SIZE, border = true, padding = 3 } = opts;

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    console.warn('[PDF Caixa] drawCell ignorado por medida inválida:', { text, x, y, w, h });
    return;
  }

  if (border) doc.rect(x, y, w, h).stroke();

  doc.fontSize(fontSize).text(String(text ?? ''), x + padding, y + ID_TEXT_PADDINGY, {
    width: Math.max(1, w - padding * 2),
    height: Math.max(1, h - ID_TEXT_PADDINGY * 2),
    align,
  });
}

function headerBand(doc, x, y, w, h) {
  doc.save();
  doc.fillColor('#eef2ff').rect(x, y, w, h).fill();
  doc.restore();
}

// ==== Ícones de clipe ========================================================
function drawPaperclipPng(doc, xCenter, yCenter, paperclipPath) {
  const file = paperclipPath || caminhoPaperclipDefault();
  if (!fs.existsSync(file)) return false;

  doc.save();
  doc.image(file, xCenter - PAPERCLIP_W / 2, yCenter - PAPERCLIP_H / 2, {
    width: PAPERCLIP_W,
    height: PAPERCLIP_H
  });
  doc.restore();

  return true;
}

function drawPaperclipVector(doc, xCenter, yCenter) {
  const size = Math.max(PAPERCLIP_W, PAPERCLIP_H);
  const w = size * 0.78;
  const h = size * 1.20;
  const r = Math.min(w, h) * 0.35;
  const gap = Math.max(0.9, Math.min(w, h) * 0.22);

  doc.save();
  doc.lineWidth(1.2);
  doc.lineCap('round');
  doc.strokeColor('#111');
  doc.translate(xCenter, yCenter);

  doc.roundedRect(-w / 2, -h / 2, w, h, r).stroke();
  doc.roundedRect(
    -w / 2 + gap,
    -h / 2 + gap,
    w - 2 * gap,
    h - 2 * gap,
    Math.max(1, r - gap)
  ).stroke();

  doc.rect(w / 2 - gap * 0.8 - w / 2, -h / 2, gap * 1.6, h * 0.35).fill('#ffffff');
  doc.restore();
}

function applyWatermark(doc, logoPath) {
  try {
    if (!canUseImage(logoPath)) return;

    const largura = 360;
    const x = (doc.page.width - largura) / 2;
    const y = (doc.page.height - largura) / 2;

    doc.save()
      .opacity(0.07)
      .image(logoPath, x, y, { width: largura })
      .opacity(1)
      .restore();
  } catch { }
}

function getPlanoContas(r = {}) {
  return (
    r.plano_contas ||
    r.plano_de_contas ||
    r.chart_account_name ||
    r.chart_account_title ||
    r.chart_account_description ||
    r.conta_contabil ||
    r.conta_plano ||
    r.account_plan ||
    r.account_name ||
    'Não Informado'
  );
}

// ============================================================================
// API principal
export async function generateCaixaPdf(payload = {}, options = {}) {
  const {
    rows = [],
    company = {},
    title = 'Relatório de Movimentações de Caixa',
    periodLabel = '',
    filtersLabel = '',
  } = payload;

  const {
    output = 'response',
    res = null,
    filename = `relatorio_caixa_${moment().format('DD-MM-YYYY')}.pdf`,
    dir = path.resolve(__dirname, '../../public/pdfs'),
  } = options;

  const enterprise = await enterpriseApi.findForPdf({
    enterpriseId: payload.enterpriseId ?? company.enterpriseId ?? company.id ?? null,
  });

  if (!enterprise) {
    throw new Error('Nenhuma empresa ativa foi encontrada para gerar o cabeçalho do PDF.');
  }

  const resolvedLogo = await resolveLogoSource(
    enterprise.logo_url || company.logoPath || caminhoLogoDefault()
  );

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
  });

  let fileStream = null;
  const buffers = [];

  if (output === 'response' && res) {
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename.replace(/["\r\n]/g, '')}"`,
        'Content-Length': pdfData.length
      });
      res.end(pdfData);
    });
  } else if (output === 'file') {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, filename);
    fileStream = fs.createWriteStream(full);
    doc.pipe(fileStream);
  } else if (output === 'buffer') {
    doc.on('data', buffers.push.bind(buffers));
  }

  const startX = doc.page.margins.left;
  const endX = doc.page.width - doc.page.margins.right;
  const tableWidth = endX - startX;

  const comp = buildCompanyHeader(enterprise, company);
  comp.logoPath = resolvedLogo;

  applyWatermark(doc, comp.logoPath);

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ Card do cabeçalho                                            ║
  // ╚══════════════════════════════════════════════════════════════╝
  const headerCardX = startX;
  const headerCardY = doc.y;
  const headerCardW = tableWidth;
  const headerCardH = 90;

  doc.save();
  doc.lineWidth(0.8)
    .fillColor('#f8fafc')
    .strokeColor('#cbd5e1')
    .roundedRect(headerCardX, headerCardY, headerCardW, headerCardH, 6)
    .fillAndStroke();
  doc.restore();

  doc.x = headerCardX;
  doc.y = headerCardY + 8;

  doc.fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(comp.name, headerCardX, doc.y, {
      align: 'center',
      width: headerCardW,
    });

  doc.font('Helvetica')
    .fontSize(10)
    .text(joinNonEmpty([
      comp.cnpj ? `CNPJ: ${comp.cnpj}` : '',
      comp.stateRegistration ? `IE: ${comp.stateRegistration}` : '',
      comp.corporateName && comp.corporateName !== comp.name
        ? `Razão Social: ${comp.corporateName}`
        : '',
    ], ' | '), headerCardX, doc.y + 2, {
      align: 'center',
      width: headerCardW,
    })
    .text(comp.address, {
      align: 'center',
      width: headerCardW,
    })
    .text(comp.contacts, {
      align: 'center',
      width: headerCardW,
    })
    .text(comp.site, {
      align: 'center',
      width: headerCardW,
    });

  doc.font('Helvetica-Bold')
    .fontSize(12)
    .text(title, headerCardX, doc.y + 4, {
      align: 'center',
      width: headerCardW,
    });

  doc.y = headerCardY + headerCardH + 8;

  // ╔══════ Cards de período + filtros ══════╗
  {
    const cardsY = doc.y;
    const gap = 10;
    const leftW = 260;
    const rightW = tableWidth - leftW - gap;
    const boxH = 24;

    if (periodLabel) {
      const xInfo = startX;
      const yInfo = cardsY;

      doc.save();
      doc.lineWidth(0.5)
        .fillColor('#f8fafc')
        .strokeColor('#cbd5e1')
        .roundedRect(xInfo, yInfo, leftW, boxH, 4)
        .fillAndStroke();

      const fontSizeInfo = 9;
      const textY = yInfo + (boxH - fontSizeInfo) / 2 - 0.5;

      doc.fillColor('#111827')
        .font('Helvetica')
        .fontSize(fontSizeInfo)
        .text(periodLabel, xInfo + 8, textY, {
          width: leftW - 16,
          align: 'left',
          lineBreak: false,
        });

      doc.restore();
    }

    if (filtersLabel) {
      const xFiltros = startX + leftW + gap;
      const yFiltros = cardsY;

      doc.save();
      doc.lineWidth(0.5)
        .fillColor('#f8fafc')
        .strokeColor('#cbd5e1')
        .roundedRect(xFiltros, yFiltros, rightW, boxH, 4)
        .fillAndStroke();

      const fontSizeFiltros = 8;
      const textY2 = yFiltros + (boxH - fontSizeFiltros) / 2 - 0.5;

      doc.fillColor('#111827')
        .font('Helvetica')
        .fontSize(fontSizeFiltros)
        .text(filtersLabel, xFiltros + 8, textY2, {
          width: rightW - 16,
          align: 'left',
        });

      doc.restore();
    }

    doc.y = cardsY + boxH + 8;
  }

  // ---------- Tabela ----------
  const headers = [
    'ID', 'Data', 'Tipo', 'Conta', 'Tipo Doc', 'Nº Doc',
    'Plano de Contas', 'Fornecedor', 'Observação',
    'Valor', 'Multa', 'Juros', 'Encargos', 'Total'
  ];

  const weights = [6, 6, 4, 5, 4, 5, 14, 11, 10, 5, 4, 4, 5, 6];

  const sumW = weights.reduce((a, b) => a + b, 0);
  const colWidths = weights.map(w => Math.floor((w / sumW) * tableWidth));

  colWidths[colWidths.length - 1] += tableWidth - colWidths.reduce((a, b) => a + b, 0);

  const rowHeight = 20;
  const headerHeight = rowHeight;
  let y = doc.y + 8;

  function drawHeader() {
    let x = startX;

    headerBand(doc, x, y, tableWidth, headerHeight);

    doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE);

    headers.forEach((h, i) => {
      drawCell(doc, h, x, y, colWidths[i], headerHeight, {
        fontSize: HEADER_FONT_SIZE,
        align: 'left'
      });
      x += colWidths[i];
    });

    y += headerHeight;
    doc.font('Helvetica').fontSize(BASE_FONT_SIZE);
  }

  drawHeader();

  // Totais
  let totalGeral = 0;
  let totalJuros = 0;
  let totalMulta = 0;

  const totaisPorPlanoContas = {};

  for (const r of rows) {
    const valor = Number(r.valor || 0);
    const multa = Number(r.multa || 0);
    const juros = Number(r.juros || 0);
    const encargos = Number(r.encargos || 0);
    const total = valor + multa + juros + encargos;

    totalGeral += total;
    totalJuros += juros;
    totalMulta += multa;

    const planoContas = getPlanoContas(r);
    totaisPorPlanoContas[planoContas] = (totaisPorPlanoContas[planoContas] || 0) + total;

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      applyWatermark(doc, comp.logoPath);
      y = doc.y + 8;
      drawHeader();
    }

    let x = startX;

    // ID
    doc.rect(x, y, colWidths[0], rowHeight).stroke();

    let idTextX = x + 3;

    if (r.tem_anexo) {
      const clipX = x + 3;
      const clipY = y + (rowHeight - PAPERCLIP_H) / 2;

      if (!drawPaperclipPng(doc, clipX + PAPERCLIP_W / 2, clipY + PAPERCLIP_H / 2, comp.paperclipPath)) {
        drawPaperclipVector(doc, clipX + PAPERCLIP_W / 2, clipY + PAPERCLIP_H / 2);
      }

      idTextX = clipX + PAPERCLIP_W + 3;
    }

    doc.fontSize(BASE_FONT_SIZE).text(String(r.id ?? ''), idTextX, y + ID_TEXT_PADDINGY, {
      width: Math.max(1, colWidths[0] - (idTextX - x) - 3),
      height: rowHeight - ID_TEXT_PADDINGY * 2,
      align: 'left',
    });

    x += colWidths[0];

    const antes = [
      r.data_hora ? moment(r.data_hora).format('DD/MM/YYYY') : '',
      r.tipo_movimentacao || '',
      r.conta_caixa || '',
      r.tipo_documento || '',
      r.numero_documento || '',
    ];

    antes.forEach((val, i) => {
      drawCell(doc, val, x, y, colWidths[i + 1], rowHeight, {
        fontSize: BASE_FONT_SIZE,
        align: 'left'
      });
      x += colWidths[i + 1];
    });

    drawCell(doc, planoContas, x, y, colWidths[6], rowHeight, {
      fontSize: PLAN_FONT_SIZE,
      align: 'left'
    });
    x += colWidths[6];

    [r.fornecedor || '', r.observacao || ''].forEach((val, idx) => {
      drawCell(doc, val, x, y, colWidths[7 + idx], rowHeight, {
        fontSize: BASE_FONT_SIZE,
        align: 'left'
      });
      x += colWidths[7 + idx];
    });

    [
      moneyBR(valor),
      moneyBR(multa),
      moneyBR(juros),
      moneyBR(encargos),
      moneyBR(total)
    ].forEach((val, idx) => {
      drawCell(doc, val, x, y, colWidths[9 + idx], rowHeight, {
        fontSize: BASE_FONT_SIZE,
        align: 'right'
      });
      x += colWidths[9 + idx];
    });

    y += rowHeight;
  }

  // ================= Rodapé =================
  {
    const marginT = doc.page.margins.top;
    const marginR = doc.page.margins.right;
    const marginB = doc.page.margins.bottom;
    const pageW = doc.page.width;
    const pageH = doc.page.height;

    const boxW = 220;
    const boxH = 26;
    const gapY = 6;
    const padX = 8;
    const padY = 6;

    const totalStackH = (boxH * 3) + (gapY * 2);

    let yStart = y + 10;

    if (yStart + totalStackH + marginB > pageH) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      applyWatermark(doc, comp.logoPath);
      yStart = marginT;
    }

    const xBox = pageW - marginR - boxW;

    const boxes = [
      { label: 'Total De Movimentações:', value: totalGeral },
      { label: 'Total Juros:', value: totalJuros },
      { label: 'Total Multa:', value: totalMulta },
    ];

    boxes.forEach((item, idx) => {
      const yBox = yStart + (idx * (boxH + gapY));
      const valStr = moneyBR(item.value);

      doc.lineWidth(0.5).roundedRect(xBox, yBox, boxW, boxH, 4).stroke();

      doc.font('Helvetica-Bold').fontSize(11);

      const valueW = doc.widthOfString(valStr);
      const xLabel = xBox + padX;
      const xVal = xBox + boxW - padX - valueW;

      doc.text(item.label, xLabel, yBox + padY, { lineBreak: false });
      doc.text(valStr, xVal, yBox + padY, { lineBreak: false });
    });
  }

  // ================= Dashboard por Plano de Contas =================
  doc.addPage({ size: 'A4', layout: 'landscape' });
  applyWatermark(doc, comp.logoPath);

  const titleY = 40;

  doc.font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#111827')
    .text('Totais por Plano de Contas - Dashboard Visual', startX, titleY);

  let yDash = titleY + 24;

  const planoOrd = Object.entries(totaisPorPlanoContas).sort(([, a], [, b]) => b - a);
  const maxValor = Math.max(1, ...planoOrd.map(([, v]) => v));

  const cardW = tableWidth;
  const cardPad = 12;
  const dashHeaderH = 28;
  const barH = 12;
  const labelW = 180;
  const barMaxW = 420;
  const cardGap = 10;

  function drawCardFrame(doc, x, y, w, h) {
    doc.save();
    doc.lineWidth(0.8)
      .strokeColor('#e5e7eb')
      .fillColor('#f8fafc')
      .roundedRect(x, y, w, h, 8)
      .fillAndStroke();
    doc.restore();
  }

  function drawCardHeader(doc, x, y, w, h, titleText) {
    doc.save();
    doc.fillColor('#eef2ff')
      .roundedRect(x, y, w, h, 8)
      .fill();

    doc.fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(titleText, x + cardPad, vCenter(y, h, 11), {
        width: w - cardPad * 2,
        lineBreak: false
      });

    doc.restore();
  }

  if (planoOrd.length === 0) {
    doc.font('Helvetica').fontSize(10)
      .text('Nenhuma movimentação encontrada para o período/filtros informados.', startX, yDash);
  }

  for (const [planoNome, valor] of planoOrd) {
    const cardH = dashHeaderH + cardPad + 22;

    if (yDash + cardH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      applyWatermark(doc, comp.logoPath);

      doc.font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111827')
        .text('Totais por Plano de Contas - Continuação', startX, titleY);

      yDash = titleY + 24;
    }

    const cardX = startX;
    drawCardFrame(doc, cardX, yDash, cardW, cardH);
    drawCardHeader(doc, cardX, yDash, cardW, dashHeaderH, planoNome);

    const cx = cardX + cardPad;
    const cy = yDash + dashHeaderH + cardPad;

    const barX = cx + labelW;
    const barW = Math.max(1, (valor / maxValor) * barMaxW);

    doc.save();
    doc.fillColor('#4285F4').rect(barX, cy, barW, barH).fill();

    doc.fillColor('#0f172a')
      .font('Helvetica')
      .fontSize(9)
      .text(moneyBR(valor), barX + barW + 8, vCenter(cy, barH, 9), {
        lineBreak: false
      });

    doc.restore();

    yDash += cardH + cardGap;
  }

  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Total de Movimentações: ${moneyBR(totalGeral)}`, startX, yDash + 8, {
      align: 'right',
      width: tableWidth
    });

  // Marca d’água final sobre todas as páginas
  try {
    const logoPathFinal = comp.logoPath || caminhoLogoDefault();

    if (canUseImage(logoPathFinal)) {
      const range = doc.bufferedPageRange();

      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const largura = 360;
        const x = (doc.page.width - largura) / 2;
        const yMark = (doc.page.height - largura) / 2;

        doc.save()
          .opacity(0.03)
          .image(logoPathFinal, x, yMark, { width: largura })
          .opacity(1)
          .restore();
      }
    }
  } catch (e) {
    console.error('[PDF Caixa] Erro ao aplicar marca d’água sobre o texto:', e.message);
  }

  doc.end();

  if (output === 'file') {
    const full = path.join(dir, filename);

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    return full;
  }

  if (output === 'buffer') {
    return await new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }

  return;
}

export default { generateCaixaPdf };
