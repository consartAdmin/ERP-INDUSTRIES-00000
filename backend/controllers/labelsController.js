// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 🏷 labelsController.js — Product Labels (PDF) — CONSART ERP (ESM)   ║
// ║ - POST /api/labels/products                                         ║
// ║ - Usa parâmetros da tabela labelParameters                          ║
// ║ - NÃO salva arquivo em disco                                        ║
// ║ - Faz download direto via response                                  ║
// ║ - Renderiza via layout_json (designer visual)                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import bwipjs from 'bwip-js';

import labelParametersApi from '../repositories/labelParameters/labelParameters.index.js';

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function mmToPt(mm) {
  return (Number(mm) || 0) * (72 / 25.4);
}

function ptToMm(pt) {
  return (Number(pt) || 0) * (25.4 / 72);
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function getFontScale(fontPreset) {
  const p = String(fontPreset || 'medium').toLowerCase();
  if (p === 'small' || p === 's') return 0.85;
  if (p === 'large' || p === 'l') return 1.25;
  if (p === 'm' || p === 'medium') return 1.0;
  return 1.0;
}

function fitTextByWidth(doc, text, maxWidth, startPt, minPt = 5) {
  let size = Math.max(minPt, Number(startPt) || minPt);

  doc.fontSize(size);
  while (size > minPt && doc.widthOfString(String(text || '')) > maxWidth) {
    size -= 0.5;
    doc.fontSize(size);
  }

  return size;
}

function formatMoney(value, currencySymbol = 'R$') {
  if (value === null || value === undefined || value === '') {
    return currencySymbol;
  }

  const n = Number(value);
  if (Number.isFinite(n)) {
    return `${currencySymbol} ${n.toFixed(2).replace('.', ',')}`;
  }

  return `${currencySymbol} ${String(value)}`;
}

function parseLayoutJson(raw) {
  if (!raw) {
    return { version: 1, elements: [] };
  }

  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.warn('[LabelsController] layout_json inválido:', err);
    return { version: 1, elements: [] };
  }
}

function sanitizeLayoutElement(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    id: String(raw.id || `el_${Date.now()}_${index}`),
    type: String(raw.type || 'custom'),
    key: String(raw.key || raw.type || 'custom'),
    text: String(raw.text ?? ''),
    x: safeNumber(raw.x, 0),
    y: safeNumber(raw.y, 0),
    w: Math.max(2, safeNumber(raw.w, 20)),
    h: Math.max(2, safeNumber(raw.h, 5)),
    fontSize: Math.max(3, safeNumber(raw.fontSize, 6)),
    align: ['left', 'center', 'right'].includes(raw.align) ? raw.align : 'left',
    weight: String(raw.weight || '400'),
    visible: normalizeBoolean(raw.visible, true),
  };
}

function normalizeLayout(raw) {
  const parsed = parseLayoutJson(raw);
  const elements = Array.isArray(parsed?.elements)
    ? parsed.elements.map(sanitizeLayoutElement).filter(Boolean)
    : [];

  return {
    version: safeNumber(parsed?.version, 1) || 1,
    elements,
  };
}

function normalizeLabelItem(raw = {}) {
  const {
    product_code,
    productCode,
    code,
    sku,

    description,
    name,
    product_name,
    productName,

    barcode,
    barCode,
    bar_code,
    ean,

    unit,
    um,
    unit_abbr,

    price,
    value,
    salePrice,
    sale_price,

    batch,
    lot,
    expiryDate,
    expirationDate,
    location,
    shelf,
    aisle,
  } = raw;

  let unifiedPrice = salePrice ?? sale_price ?? price ?? value;
  if (unifiedPrice === '' || unifiedPrice === undefined) {
    unifiedPrice = null;
  }

  return {
    product_code: product_code || productCode || code || sku || '',
    name: name || product_name || productName || description || '',
    barcode: barcode || barCode || bar_code || ean || '',
    unit: unit || um || unit_abbr || '',
    price: unifiedPrice,
    batch: batch || lot || '',
    expiryDate: expiryDate || expirationDate || '',
    location: location || shelf || aisle || '',
  };
}

async function generateBarcodePng(barcodeText, format = 'code128') {
  if (!barcodeText) return null;

  const bcid = String(format || 'code128').toLowerCase();

  let bwipFormat = 'code128';
  if (bcid === 'ean13' || bcid === 'ean-13') bwipFormat = 'ean13';
  else if (bcid === 'ean8' || bcid === 'ean-8') bwipFormat = 'ean8';
  else if (bcid === 'upca' || bcid === 'upc-a') bwipFormat = 'upca';

  try {
    const png = await bwipjs.toBuffer({
      bcid: bwipFormat,
      text: String(barcodeText),
      scale: 2,
      height: 10,
      includetext: false,
      backgroundcolor: 'FFFFFF',
    });

    return png;
  } catch (err) {
    console.warn('[LabelsController] Falha ao gerar barcode PNG:', err.message);
    return null;
  }
}

/* --------------------------------------------------------------------- */
/* Token resolution                                                      */
/* --------------------------------------------------------------------- */

function resolveElementText(element, item, currencySymbol = 'R$') {
  let text = String(element?.text || '');

  const replacements = {
    '{{TITLE}}': item.name || '',
    '{{NAME}}': item.name || '',
    '{{DESCRIPTION}}': item.name || '',
    '{{CODE}}': item.product_code ? `SKU ${item.product_code}` : '',
    '{{SKU}}': item.product_code || '',
    '{{BARCODE}}': item.barcode || '',
    '{{PRICE}}': formatMoney(item.price, currencySymbol),
    '{{UNIT}}': item.unit || '',
    '{{BATCH}}': item.batch || '',
    '{{LOT}}': item.batch || '',
    '{{EXPIRY}}': item.expiryDate || '',
    '{{EXPIRYDATE}}': item.expiryDate || '',
    '{{LOCATION}}': item.location || '',
  };

  Object.entries(replacements).forEach(([token, value]) => {
    text = text.replaceAll(token, value);
  });

  return text;
}

function getFontNameFromWeight(weight = '400') {
  const w = String(weight);
  if (w === '700' || w.toLowerCase() === 'bold') return 'Helvetica-Bold';
  if (w === '600' || w.toLowerCase() === 'semibold') return 'Helvetica-Bold';
  return 'Helvetica';
}

/* --------------------------------------------------------------------- */
/* Drawing engine via layout_json                                        */
/* --------------------------------------------------------------------- */

async function drawLayoutElement(doc, element, item, originX, originY, labelWPt, labelHPt, fontScale = 1, presetCfg = null) {
  if (!element?.visible) return;

  const x = originX + mmToPt(element.x);
  const y = originY + mmToPt(element.y);
  const w = mmToPt(element.w);
  const h = mmToPt(element.h);

  const rightLimit = originX + labelWPt;
  const bottomLimit = originY + labelHPt;

  if (x >= rightLimit || y >= bottomLimit) return;

  const safeW = Math.max(2, Math.min(w, rightLimit - x));
  const safeH = Math.max(2, Math.min(h, bottomLimit - y));

  const currencySymbol = presetCfg?.currencySymbol || 'R$';
  const fontName = getFontNameFromWeight(element.weight);
  const baseFontSize = Math.max(3, safeNumber(element.fontSize, 6) * fontScale);

  switch (element.type) {
    case 'title':
    case 'code':
    case 'price':
    case 'barcodeText':
    case 'custom': {
      const resolvedText = resolveElementText(element, item, currencySymbol);

      doc.save();
      doc.font(fontName);

      let finalFontSize = baseFontSize;

      if (element.type === 'price') {
        finalFontSize = fitTextByWidth(doc, resolvedText, safeW, baseFontSize, 5);
      }

      doc.fontSize(finalFontSize);

      doc.text(resolvedText, x, y, {
        width: safeW,
        height: safeH,
        align: element.align || 'left',
        ellipsis: true,
      });

      doc.restore();
      break;
    }

    case 'barcode': {
      const barcodeValue = item.barcode || item.product_code || '';
      if (!barcodeValue) return;

      const barcodePng = await generateBarcodePng(
        barcodeValue,
        presetCfg?.barcodeFormat || 'code128',
      );

      if (!barcodePng) {
        doc.save();
        doc.font('Helvetica');
        doc.fontSize(Math.max(5, baseFontSize));
        doc.text(barcodeValue, x, y, {
          width: safeW,
          height: safeH,
          align: 'center',
          ellipsis: true,
        });
        doc.restore();
        return;
      }

      try {
        doc.image(barcodePng, x, y, {
          width: safeW,
          height: safeH,
        });
      } catch (err) {
        console.warn('[LabelsController] Erro ao desenhar barcode:', err.message);
      }
      break;
    }

    default: {
      const fallbackText = resolveElementText(element, item, currencySymbol);

      doc.save();
      doc.font(fontName);
      doc.fontSize(baseFontSize);
      doc.text(fallbackText, x, y, {
        width: safeW,
        height: safeH,
        align: element.align || 'left',
        ellipsis: true,
      });
      doc.restore();
      break;
    }
  }
}

async function drawLabelFromLayout(doc, item, x, y, w, h, layout, fontScale = 1, presetCfg = null) {
  const normalizedLayout = normalizeLayout(layout);

  doc.save();
  doc.lineWidth(0.45);
  doc.strokeColor('#D9D9D9');
  doc.rect(x, y, w, h).stroke();
  doc.restore();

  if (!normalizedLayout.elements.length) {
    const fallbackLayout = {
      version: 1,
      elements: [
        { type: 'title', key: 'title', text: '{{TITLE}}', x: 2, y: 2, w: ptToMm(w) - 4, h: 8, fontSize: 7, align: 'left', weight: '700', visible: true },
        { type: 'code', key: 'code', text: '{{CODE}}', x: 2, y: 12, w: 18, h: 5, fontSize: 8, align: 'left', weight: '600', visible: true },
        { type: 'barcodeText', key: 'barcodeText', text: '{{BARCODE}}', x: 10, y: 22, w: ptToMm(w) - 20, h: 5, fontSize: 6, align: 'center', weight: '400', visible: true },
        { type: 'price', key: 'price', text: '{{PRICE}}', x: Math.max(2, ptToMm(w) - 24), y: 12, w: 22, h: 6, fontSize: 8, align: 'right', weight: '700', visible: true },
      ],
    };

    for (const element of fallbackLayout.elements) {
      await drawLayoutElement(doc, element, item, x, y, w, h, fontScale, presetCfg);
    }
    return;
  }

  for (const element of normalizedLayout.elements) {
    await drawLayoutElement(doc, element, item, x, y, w, h, fontScale, presetCfg);
  }
}

/* --------------------------------------------------------------------- */
/* Controller: POST /api/labels/products                                 */
/* --------------------------------------------------------------------- */

export async function generateProductLabels(req, res, next) {
  try {
    const {
      items = [],
      templateSlug,
      templateId,
      format = 'pdf',
      labelConfig = null,
      fontPreset = 'medium',
      labelParametersId = null,
      priceTableId: rawPriceTableId = null,
    } = req.body || {};

    const template = templateSlug || templateId || 'default-product-label';
    const priceTableId = rawPriceTableId ? Number(rawPriceTableId) : null;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No items provided to generate labels.',
      });
    }

    if (format !== 'pdf') {
      return res.status(400).json({
        ok: false,
        error: 'Only format "pdf" is supported at the moment.',
      });
    }

    let effectiveCfg = { ...(labelConfig || {}) };
    let presetCfg = null;
    let presetLayout = { version: 1, elements: [] };

    if (labelParametersId) {
      const preset = await labelParametersApi.getLabelParametersById(Number(labelParametersId));

      if (!preset) {
        return res.status(400).json({
          ok: false,
          error: 'LABEL_PARAMETERS_NOT_FOUND',
          message: `Preset de etiqueta ${labelParametersId} não encontrado.`,
        });
      }

      presetLayout = normalizeLayout(preset.layout_json);

      presetCfg = {
        pageWidthMm: safeNumber(preset.page_width_mm, 0),
        pageHeightMm: safeNumber(preset.page_height_mm, 0),
        labelWidthMm: safeNumber(preset.label_width_mm, 0),
        labelHeightMm: safeNumber(preset.label_height_mm, 0),
        active: !!preset.active,
        currencySymbol: 'R$',
        barcodeFormat: 'code128',
      };

      effectiveCfg = {
        ...effectiveCfg,
        widthMm: safeNumber(effectiveCfg.widthMm, preset.label_width_mm),
        heightMm: safeNumber(effectiveCfg.heightMm, preset.label_height_mm),
        pageWidthMm: safeNumber(effectiveCfg.pageWidthMm, preset.page_width_mm),
        pageHeightMm: safeNumber(effectiveCfg.pageHeightMm, preset.page_height_mm),
        columns: safeNumber(effectiveCfg.columns, 1),
        rows: safeNumber(effectiveCfg.rows, 1),
        marginLeftMm: safeNumber(effectiveCfg.marginLeftMm, 0),
        marginTopMm: safeNumber(effectiveCfg.marginTopMm, 0),
        marginRightMm: safeNumber(effectiveCfg.marginRightMm, 0),
        marginBottomMm: safeNumber(effectiveCfg.marginBottomMm, 0),
        spacingXmm: safeNumber(effectiveCfg.spacingXmm, 0),
        spacingYmm: safeNumber(effectiveCfg.spacingYmm, 0),
      };
    }

    const widthMm = safeNumber(effectiveCfg.widthMm ?? effectiveCfg.label_width_mm, 60);
    const heightMm = safeNumber(effectiveCfg.heightMm ?? effectiveCfg.label_height_mm, 30);

    let cols = Math.max(1, Math.trunc(safeNumber(effectiveCfg.columns ?? effectiveCfg.cols_per_page, 1)));
    let rows = Math.max(1, Math.trunc(safeNumber(effectiveCfg.rows ?? effectiveCfg.rows_per_page, 1)));

    const labelWPt = mmToPt(widthMm);
    const labelHPt = mmToPt(heightMm);

    const pageWidthMm = safeNumber(effectiveCfg.pageWidthMm ?? effectiveCfg.page_width_mm, widthMm);
    const pageHeightMm = safeNumber(effectiveCfg.pageHeightMm ?? effectiveCfg.page_height_mm, heightMm);

    const spacingXPt = mmToPt(safeNumber(effectiveCfg.spacingXmm ?? effectiveCfg.spacing_x_mm, 0));
    const spacingYPt = mmToPt(safeNumber(effectiveCfg.spacingYmm ?? effectiveCfg.spacing_y_mm, 0));

    const marginLeftPt = mmToPt(safeNumber(effectiveCfg.marginLeftMm ?? effectiveCfg.margin_left_mm, 0));
    const marginTopPt = mmToPt(safeNumber(effectiveCfg.marginTopMm ?? effectiveCfg.margin_top_mm, 0));
    const marginRightPt = mmToPt(safeNumber(effectiveCfg.marginRightMm ?? effectiveCfg.margin_right_mm, 0));
    const marginBottomPt = mmToPt(safeNumber(effectiveCfg.marginBottomMm ?? effectiveCfg.margin_bottom_mm, 0));

    const pageWidthPt = mmToPt(pageWidthMm);
    const pageHeightPt = mmToPt(pageHeightMm);

    if (
      Math.abs(pageWidthPt - labelWPt) < 0.5 &&
      Math.abs(pageHeightPt - labelHPt) < 0.5
    ) {
      cols = 1;
      rows = 1;
    }

    const docOptions = {
      size: [pageWidthPt, pageHeightPt],
      margins: {
        top: marginTopPt,
        bottom: marginBottomPt,
        left: marginLeftPt,
        right: marginRightPt,
      },
    };

    const timestamp = Date.now();
    const safeTemplate = String(template || 'default')
      .toLowerCase()
      .replace(/[^a-z0-9\-]+/g, '-');

    const fileName = `labels_${safeTemplate}_${timestamp}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const doc = new PDFDocument(docOptions);
    doc.pipe(res);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

    const totalSpacingX = spacingXPt * Math.max(cols - 1, 0);
    const totalSpacingY = spacingYPt * Math.max(rows - 1, 0);

    const slotWidthPt = cols > 0 ? (usableWidth - totalSpacingX) / cols : labelWPt;
    const slotHeightPt = rows > 0 ? (usableHeight - totalSpacingY) / rows : labelHPt;

    const drawWidthPt = Math.min(labelWPt, slotWidthPt);
    const drawHeightPt = Math.min(labelHPt, slotHeightPt);

    const fontScale = getFontScale(fontPreset);

    const expanded = [];

    for (const raw of items) {
      const enriched = { ...raw };

      if (priceTableId) {
        const existingUnifiedPrice =
          enriched.salePrice ??
          enriched.sale_price ??
          enriched.price ??
          enriched.value;

        const hasPriceAlready =
          existingUnifiedPrice !== undefined &&
          existingUnifiedPrice !== null &&
          existingUnifiedPrice !== '';

        if (!hasPriceAlready) {
          const productCode =
            enriched.product_code ||
            enriched.productCode ||
            enriched.code ||
            enriched.sku ||
            null;

          if (productCode) {
            const dbPrice = await labelParametersApi.getProductPriceForLabel(
              productCode,
              priceTableId,
            );

            if (dbPrice != null) {
              enriched.salePrice = dbPrice;
            }
          }
        }
      }

      const q1 = Number(enriched.quantity);
      const q2 = Number(enriched.labelsPerProduct);

      let qty = 1;
      if (Number.isFinite(q1) && q1 > 0) {
        qty = q1;
      } else if (Number.isFinite(q2) && q2 > 0) {
        qty = q2;
      }

      for (let i = 0; i < qty; i++) {
        expanded.push(normalizeLabelItem(enriched));
      }
    }

    let index = 0;
    const labelsPerPage = Math.max(1, cols * rows);

    for (const item of expanded) {
      const positionInPage = index % labelsPerPage;

      if (positionInPage === 0 && index !== 0) {
        doc.addPage();
      }

      const row = Math.floor(positionInPage / cols);
      const col = positionInPage % cols;

      const x = doc.page.margins.left + col * (slotWidthPt + spacingXPt);
      const y = doc.page.margins.top + row * (slotHeightPt + spacingYPt);

      await drawLabelFromLayout(
        doc,
        item,
        x,
        y,
        drawWidthPt,
        drawHeightPt,
        presetLayout,
        fontScale,
        presetCfg,
      );

      index++;
    }

    doc.end();
  } catch (err) {
    console.error('[LabelsController] Unexpected error:', err);

    if (!res.headersSent) {
      return next(err);
    }

    return res.end();
  }
}

/* --------------------------------------------------------------------- */
/* Stubs para futuros endpoints de “jobs”                                */
/* --------------------------------------------------------------------- */

export async function listLabelJobs(_req, res) {
  return res.json({
    ok: true,
    data: [],
  });
}

export async function getLabelJob(_req, res) {
  return res.status(404).json({
    ok: false,
    error: 'Label job not implemented yet.',
  });
}