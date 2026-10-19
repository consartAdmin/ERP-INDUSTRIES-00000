// ╔══════════════════════════════════════════════════════════════╗
// ║ generationDeliveryLabelsPdf.js — PDF Etiquetas de Entrega   ║
// ║ CONSART ERP | ESM                                           ║
// ║ Formato parametrizável (padrão 60x30mm) | 1 etiqueta/página ║
// ╚══════════════════════════════════════════════════════════════╝

import { createRequire } from 'module';
import path from 'path';
import PDFDocument from 'pdfkit';
import pool from '../config/db.js';
import {
  getLabelSettings,
  sanitizeLabelSettings,
} from '../repositories/deliveryLabelSettings/deliveryLabelSettings.index.js';

const MM_TO_PT = 2.834645669;

// Liberation Sans (métricas idênticas a Helvetica/Arial) embutida no PDF:
// impressão e pré-visualização ficam iguais em qualquer impressora/visualizador.
const require = createRequire(import.meta.url);
const FONTS_DIR = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
const FONT_REGULAR = path.join(FONTS_DIR, 'LiberationSans-Regular.ttf');
const FONT_BOLD = path.join(FONTS_DIR, 'LiberationSans-Bold.ttf');
const FONT_REGULAR_NAME = 'LabelSans';
const FONT_BOLD_NAME = 'LabelSans-Bold';

// Layout de referência (60x30mm) usado quando auto_scale está ligado
const BASE_W = 60 * MM_TO_PT;
const BASE_H = 30 * MM_TO_PT;

const SAMPLE_LABEL = Object.freeze({
  customer_name: 'CLIENTE EXEMPLO LTDA',
  address: 'Rua das Flores',
  number: '123',
  complement: 'Sala 4',
  neighborhood: 'Centro',
  city: 'Belo Horizonte',
  state: 'MG',
  nfe_number: '8886',
  volumes: 2,
});

function safe(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

// Corta o texto para caber em maxW (medido com a fonte/tamanho atuais do doc), com "…"
function fitText(doc, text, maxW) {
  if (doc.widthOfString(text) <= maxW) return text;

  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.widthOfString(`${text.slice(0, mid).trimEnd()}…`) <= maxW) lo = mid;
    else hi = mid - 1;
  }

  return lo ? `${text.slice(0, lo).trimEnd()}…` : '';
}

// Quebra o texto em até maxLines linhas de largura maxW (por palavras); a última recebe "…"
function wrapText(doc, text, maxW, maxLines) {
  const lines = [];
  let rest = text;

  while (rest && lines.length < maxLines - 1 && doc.widthOfString(rest) > maxW) {
    const words = rest.split(' ');
    let current = '';

    while (words.length && doc.widthOfString(current ? `${current} ${words[0]}` : words[0]) <= maxW) {
      current = current ? `${current} ${words.shift()}` : words.shift();
    }

    // Palavra única maior que a linha: corta no caractere
    if (!current) {
      current = fitText(doc, words.shift(), maxW);
    }

    lines.push(current);
    rest = words.join(' ');
  }

  if (rest) lines.push(fitText(doc, rest, maxW));
  return lines;
}

/**
 * Desenha "Título: informação" sem nunca invadir a linha seguinte.
 * Retorna quantas linhas foram usadas (maxLines > 1 permite quebrar a informação).
 */
function line(doc, label, value, x, y, labelW, fontSize = 5.8, labelColW = null, style = {}) {
  const { boldLabel = true, boldValue = false, align = 'left', maxLines = 1 } = style;
  const labelFont = boldLabel ? FONT_BOLD_NAME : FONT_REGULAR_NAME;
  const valueFont = boldValue ? FONT_BOLD_NAME : FONT_REGULAR_NAME;
  const labelText = safe(label, '');
  const valueText = safe(value).replace(/\s+/g, ' ').trim();

  const calculatedLabelWidth = doc
    .font(labelFont)
    .fontSize(fontSize)
    .widthOfString(labelText);

  // Sem título: o valor ocupa a linha inteira a partir da margem
  const finalLabelWidth = labelText ? labelColW ?? calculatedLabelWidth + 2 : 0;
  const available = Math.max(1, labelW - 8);
  const valueMaxW = Math.max(1, available - finalLabelWidth);

  doc.font(valueFont).fontSize(fontSize);
  const valueLines = wrapText(doc, valueText, valueMaxW, maxLines);
  const lineH = rowStep(fontSize);

  // Centro/direita: título + informação posicionados como um bloco (pela linha mais larga)
  let startX = x;

  if (align !== 'left') {
    const valueW = Math.max(...valueLines.map((text) => doc.widthOfString(text)));
    const blockW = finalLabelWidth + valueW;
    startX = x + Math.max(0, align === 'center' ? (available - blockW) / 2 : available - blockW);
  }

  doc
    .font(labelFont)
    .fontSize(fontSize)
    .text(labelText, startX, y, {
      lineBreak: false,
    });

  doc.font(valueFont).fontSize(fontSize);

  valueLines.forEach((text, index) => {
    doc.text(text, startX + finalLabelWidth, y + index * lineH, {
      lineBreak: false,
    });
  });

  return valueLines.length;
}

// Negrito do título e da informação do campo (parâmetros bold_label_* / bold_value_*)
function boldStyle(settings, field) {
  return {
    boldLabel: settings[`bold_label_${field}`],
    boldValue: settings[`bold_value_${field}`],
    align: settings[`align_${field}`] || 'left',
  };
}

// Título do campo ("Cliente: ") ou vazio, conforme o parâmetro label_* do campo
function caption(settings, key, text) {
  return settings[key] ? text : '';
}

function formatCity(label) {
  return [label.city, label.state].filter(Boolean).join('/');
}

function rowStep(fontSize) {
  return Math.max(10, fontSize * 1.3);
}

/* ──────────────────────────────────────────────────────────
   Geometria da página a partir dos parâmetros
────────────────────────────────────────────────────────── */

function buildGeometry(settings) {
  const pageW = settings.width_mm * MM_TO_PT;
  const pageH = settings.height_mm * MM_TO_PT;
  const scale = settings.auto_scale ? Math.min(pageW / BASE_W, pageH / BASE_H) : 1;

  // Área de desenho em unidades já escaladas
  const drawW = pageW / scale;
  const drawH = pageH / scale;
  const margin = (settings.margin_mm * MM_TO_PT) / scale;

  return {
    pageW,
    pageH,
    scale,
    offsetX: settings.offset_x_mm * MM_TO_PT,
    offsetY: settings.offset_y_mm * MM_TO_PT,
    x: margin,
    y: margin,
    w: Math.max(1, drawW - margin * 2),
    h: Math.max(1, drawH - margin * 2),
  };
}

function beginPage(doc, geo) {
  doc.addPage({ size: [geo.pageW, geo.pageH], margin: 0 });
  doc.save();
  doc.translate(geo.offsetX, geo.offsetY);
  doc.scale(geo.scale);
}

function drawFrame(doc, geo, settings) {
  if (!settings.show_border) return;

  doc
    .roundedRect(geo.x, geo.y, geo.w, geo.h, settings.border_radius)
    .lineWidth(0.4)
    .stroke('#111111');
}

/* ──────────────────────────────────────────────────────────
   Etiqueta de volume
────────────────────────────────────────────────────────── */

function drawLabel(doc, geo, settings, label, volumeNumber, totalVolumes) {
  const { x, y, w, h } = geo;

  drawFrame(doc, geo, settings);

  doc
    .font(FONT_BOLD_NAME)
    .fontSize(settings.font_title)
    .text(settings.title_text || '', x + 3, y + 3, {
      width: w - 6,
      align: settings.align_title || 'center',
      ellipsis: true,
      lineBreak: false,
    });

  const dividerY = y + 3 + settings.font_title + 3;

  doc
    .moveTo(x + 3, dividerY)
    .lineTo(x + w - 3, dividerY)
    .lineWidth(0.3)
    .stroke('#111111');

  let rowY = dividerY + 4;

  line(doc, caption(settings, 'label_customer', 'Cliente: '), label.customer_name, x + 4, rowY, w, settings.font_customer, null, boldStyle(settings, 'customer'));
  rowY += rowStep(settings.font_customer);

  // Logradouro de linha menor que as demais (como no layout original)
  const addressFont = settings.font_body * (5.5 / 5.8);

  if (settings.show_address) {
    const address = [label.address, label.number].filter(Boolean).join(', ');
    // Logradouro + número pode ocupar até 2 linhas; as linhas seguintes descem
    const used = line(doc, caption(settings, 'label_address', 'Logradouro: '), address, x + 4, rowY, w, addressFont, null, {
      ...boldStyle(settings, 'address'),
      maxLines: 2,
    });
    rowY += rowStep(settings.font_body) * used;
  }

  // Complemento em linha própria (somente quando preenchido)
  if (settings.show_complement && label.complement) {
    const used = line(doc, caption(settings, 'label_complement', 'Complemento: '), label.complement, x + 4, rowY, w, addressFont, null, {
      ...boldStyle(settings, 'complement'),
      maxLines: 2,
    });
    rowY += rowStep(settings.font_body) * used;
  }

  if (settings.show_neighborhood) {
    line(doc, caption(settings, 'label_neighborhood', 'Bairro: '), label.neighborhood, x + 4, rowY, w, settings.font_body, null, boldStyle(settings, 'neighborhood'));
    rowY += rowStep(settings.font_body);
  }

  if (settings.show_city) {
    line(doc, caption(settings, 'label_city', 'Cidade: '), formatCity(label), x + 4, rowY, w, settings.font_body, null, boldStyle(settings, 'city'));
  }

  if (settings.show_nfe) {
    const valueSize = settings.font_nfe;
    const captionSize = valueSize * (8.5 / 11);
    const boxH = Math.max(18, valueSize + 7);
    const boxY = y + h - boxH - 2;

    const nfeCaptionFont = settings.bold_label_nfe ? FONT_BOLD_NAME : FONT_REGULAR_NAME;
    const nfeValueFont = settings.bold_value_nfe ? FONT_BOLD_NAME : FONT_REGULAR_NAME;
    const captionText = caption(settings, 'label_nfe', 'NF-e:');
    const captionW = captionText
      ? doc.font(nfeCaptionFont).fontSize(captionSize).widthOfString(captionText) + 4
      : 0;
    const valueW = valueSize * 3.3;
    const boxW = 4 + captionW + valueW + 2;

    doc
      .roundedRect(x + 4, boxY, boxW, boxH, 1.5)
      .lineWidth(0.3)
      .stroke('#111111');

    if (captionText) {
      doc
        .font(nfeCaptionFont)
        .fontSize(captionSize)
        .text(captionText, x + 8, boxY + (boxH - captionSize) / 2, {
          lineBreak: false,
        });
    }

    doc
      .font(nfeValueFont)
      .fontSize(valueSize)
      .text(safe(label.nfe_number), x + 8 + captionW, boxY + (boxH - valueSize) / 2, {
        width: valueW,
        align: 'left',
        ellipsis: true,
        lineBreak: false,
      });
  }

  if (settings.show_volume) {
    const volumeText = `VOL. ${volumeNumber}/${totalVolumes}`;

    let volumeFontSize = settings.font_volume;

    if (totalVolumes >= 10 || volumeNumber >= 10) {
      volumeFontSize = settings.font_volume * (14.5 / 18);
    }

    if (totalVolumes >= 100 || volumeNumber >= 100) {
      volumeFontSize = settings.font_volume * (12.5 / 18);
    }

    const volumeW = settings.font_volume * 4.9;

    doc
      .font(FONT_BOLD_NAME)
      .fontSize(volumeFontSize)
      .text(volumeText, x + w - volumeW - 4, y + h - settings.font_volume - 1, {
        width: volumeW,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  }
}

/* ──────────────────────────────────────────────────────────
   Etiqueta de resumo (1ª página de cada entrega)
────────────────────────────────────────────────────────── */

function drawSummaryLabel(doc, geo, settings, label) {
  const { x, y, w, h } = geo;
  const totalVolumes = Math.max(1, Number(label.volumes || 1));
  const titleSize = settings.font_title + 1;
  const rowSize = settings.font_customer * (7.5 / 7.8);

  drawFrame(doc, geo, settings);

  doc.font(FONT_BOLD_NAME).fontSize(titleSize).text('RESUMO', x + 3, y + 4, {
    width: w - 6,
    align: 'center',
    lineBreak: false,
  });

  const dividerY = y + 4 + titleSize + 3;
  doc.moveTo(x + 3, dividerY).lineTo(x + w - 3, dividerY).lineWidth(0.3).stroke();

  let rowY = dividerY + 8;
  line(doc, caption(settings, 'label_customer', 'Cliente: '), label.customer_name, x + 5, rowY, w, rowSize, rowSize * 4.8, boldStyle(settings, 'customer'));
  rowY += Math.max(16, rowSize * 2.1);

  if (settings.show_nfe) {
    line(doc, caption(settings, 'label_nfe', 'NF-e: '), label.nfe_number, x + 5, rowY, w, rowSize, rowSize * 3.7, boldStyle(settings, 'nfe'));
  }

  const volumesSize = settings.font_volume * (12 / 18);

  doc.font(FONT_BOLD_NAME).fontSize(volumesSize).text(
    `VOLUMES: ${totalVolumes}`,
    x + 5,
    y + h - volumesSize - 9,
    {
      width: w - 10,
      align: 'center',
      lineBreak: false,
    }
  );
}

/* ──────────────────────────────────────────────────────────
   Montagem do PDF
────────────────────────────────────────────────────────── */

function renderLabelsPdf(rows, settings) {
  const geo = buildGeometry(settings);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [geo.pageW, geo.pageH],
      margin: 0,
      bufferPages: true,
      autoFirstPage: false,
    });

    doc.registerFont(FONT_REGULAR_NAME, FONT_REGULAR);
    doc.registerFont(FONT_BOLD_NAME, FONT_BOLD);

    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const label of rows) {
      const totalVolumes = Math.max(1, Number(label.volumes || 1));

      if (settings.print_summary) {
        beginPage(doc, geo);
        drawSummaryLabel(doc, geo, settings, label);
        doc.restore();
      }

      for (let v = 1; v <= totalVolumes; v += 1) {
        beginPage(doc, geo);
        drawLabel(doc, geo, settings, label, v, totalVolumes);
        doc.restore();
      }
    }

    doc.end();
  });
}

export async function generateDeliveryLabelsPdf(ids = []) {
  const params = [];
  let where = '';

  if (ids.length) {
    params.push(ids);
    where = `WHERE delivery_label_id = ANY($1::bigint[])`;
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM public."deliveryLabels"
      ${where}
      ORDER BY delivery_label_id ASC
    `,
    params
  );

  if (!rows.length) {
    throw new Error('Nenhuma etiqueta encontrada para impressão.');
  }

  const settings = await getLabelSettings();
  return renderLabelsPdf(rows, settings);
}

// Pré-visualização com dados fictícios e parâmetros ainda não salvos
export function generateDeliveryLabelsPreviewPdf(settingsInput = {}, label = SAMPLE_LABEL) {
  return renderLabelsPdf([label], sanitizeLabelSettings(settingsInput));
}
