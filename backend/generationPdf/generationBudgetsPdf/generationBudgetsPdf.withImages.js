// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ generationBudgetsPdf.withImages.js — PDF de Orçamento (A4 *paisagem*) — Layout legado  ║
// ║ CONSART ERP — Colunas do legado + imagens locais/URL/GCS                    ║
// ║ ✅ Suporte a múltiplas formas de pagamento                                   ║
// ║ ✅ Suporte a payments + payment_installments                                 ║
// ║ ✅ Pagamento detalhado no box final                                          ║
// ║ ✅ Sem exibir bloco de parcelas no box de pagamento                          ║
// ║ ✅ Compatível com output response / file | buffer | writable stream          ║
// ║ ✅ Compatível com múltiplos aliases de campos                                ║
// ║ ✅ Corrige desconto em R$ e total líquido dos itens                          ║
// ║ ✅ Exibe endereço do cliente no cabeçalho                                    ║
// ║ ✅ Bloco empresa em formato horizontal                                       ║
// ║ ✅ Bloco cliente/orçamento em 2 linhas horizontais                           ║
// ║ ✅ Header dinâmico sem sobreposição com a tabela de itens                    ║
// ║ ✅ Empresa com campos separados: Contato | E-mail | Site                     ║
// ║ ✅ Todos os blocos alinhados pela mesma largura da tabela de produtos        ║
// ║ ✅ Corrigido resolveBudgetFinancialTotals / totalFinal / linha do pagamento  ║
// ║ Requisitos: pdfkit                                                           ║
// ║   npm i pdfkit                                                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetPdfFilename, contentDisposition } from './generationBudgetsPdf.filename.js';
import { downloadEnterpriseLogoByUrl } from '../../uploadBuckets/uploadBucketsEnterprise.js';

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function getItemNcm(item) {
  return firstNonEmpty(
    item?.ncm,
    item?.codigo_ncm,
    item?.ncm_code,
    item?.ncm_produto,
    item?.product_ncm
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REMOTE_BASE_URL =
  process.env.GCS_PUBLIC_BASE_URL || 'https://storage.googleapis.com/consart-erp';

const PAGE = {
  margin: 40,
  size: 'A4',
  layout: 'landscape',
};

const COLORS = {
  text: '#000000',
  subtle: '#111111',
  headerFill: '#f0f0f0',
  border: '#000000',
};

const TABLE_X_OFFSET = 40;

const COLS = {
  x: [20, 90, 135, 355, 415, 475, 515, 575, 635, 691, 747].map((v) => v + TABLE_X_OFFSET),
  w: [70, 45, 220, 60, 60, 40, 60, 60, 56, 56],
  headers: [
    'Imagem',
    'SKU',
    'Descrição',
    'Grade',
    'U.M. / NCM',
    'Qtde',
    'Unitário',
    'Desc (%)',
    'V. Desc.',
    'Total',
  ],
  rowHeight: 44,
  headerHeight: 18,
};

const TABLE_LEFT = COLS.x[0];
const TABLE_RIGHT = COLS.x[COLS.x.length - 1];
const TABLE_WIDTH = TABLE_RIGHT - TABLE_LEFT;

const money = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatarDataPagamento(value) {
  if (!value) return '';

  const s = String(value).trim();
  if (!s) return '';

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return s;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}/${d.getFullYear()}`;
  }

  return '';
}

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNumberBR(v, fallback = 0) {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function textOr(v, alt = '---') {
  return v == null || v === '' ? alt : String(v);
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function truncarTexto(texto, max) {
  if (!texto) return '';
  return texto.length > max ? texto.substring(0, max - 3) + '...' : texto;
}

function sanitizeFilename(name) {
  return String(name || 'arquivo.pdf').replace(/[\/\\:*?"<>|]+/g, '-');
}

function defaultFilename(budget) {
  return budgetPdfFilename(budget);
}

function resolveBudgetItemsArray(budget) {
  const candidates = [
    budget?.items,
    budget?.budget_items,
    budget?.budgetItens,
    budget?.budget_itens,
    budget?.itens,
    budget?.rows,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr)) return arr;
  }

  return [];
}

function resolveBudgetPaymentsArray(budget) {
  const candidates = [
    budget?.payments,
    budget?.budget_payments,
    budget?.budgetsPayments,
    budget?.payment_lines,
    budget?.budgetPayments,
    budget?.budgets_payments,
    budget?.paymentRows,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr)) return arr;
  }

  return [];
}

function resolveBudgetInstallmentsArray(budget) {
  const candidates = [
    budget?.payment_installments,
    budget?.installments,
    budget?.budgetsPaymentInstallments,
    budget?.parcelas,
    budget?.paymentInstallments,
    budget?.budgets_payment_installments,
    budget?.installmentRows,
  ];

  for (const arr of candidates) {
    if (Array.isArray(arr)) return arr;
  }

  return [];
}

function resolveFrete(budget) {
  const raw = firstNonEmpty(
    budget?.freight_value,
    budget?.valor_frete,
    budget?.frete_valor,
    budget?.frete,
    budget?.shipping_value,
    budget?.shipping_amount
  );

  const freteValor = toNumberBR(raw, 0);

  const modalidade = firstNonEmpty(
    budget?.freight_mode,
    budget?.modalidade_frete,
    budget?.frete_modalidade,
    budget?.shipping_mode
  );

  const freteMode = Number.isFinite(Number(modalidade)) ? Number(modalidade) : null;

  return { freteValor, freteMode };
}

function resolveBudgetFinancialTotals(budget, totalItensCalculado = 0) {
  const subtotalFromBudget = toNumber(
    budget?.subtotal ??
    budget?.subtotal_products ??
    budget?.subtotal_produtos ??
    budget?.products_subtotal ??
    budget?.items_subtotal,
    NaN
  );

  const totalDiscountFromBudget = toNumber(
    budget?.total_discount ??
    budget?.discount_total ??
    budget?.desconto_total ??
    budget?.valor_desconto_total,
    NaN
  );

  const globalDiscountAmountFromBudget = toNumber(
    budget?.global_discount_amount ??
    budget?.discount_amount ??
    budget?.desconto_geral_valor ??
    budget?.valor_desconto_geral,
    NaN
  );

  const freightFromBudget = toNumber(
    budget?.freight_value ??
    budget?.valor_frete ??
    budget?.frete_valor ??
    budget?.frete ??
    budget?.shipping_value ??
    budget?.shipping_amount,
    0
  );

  const totalFinalFromBudget = toNumber(
    budget?.total_amount ??
    budget?.total ??
    budget?.valor_total ??
    budget?.grand_total ??
    budget?.final_total,
    NaN
  );

  const globalDiscountType = firstNonEmpty(
    budget?.global_discount_type,
    budget?.discount_type,
    budget?.tipo_desconto_geral
  )
    .toLowerCase()
    .trim();

  const globalDiscountValue = toNumber(
    budget?.global_discount_value ??
    budget?.discount_value ??
    budget?.desconto_geral ??
    budget?.valor_desconto,
    0
  );

  const subtotalProdutos = Number.isFinite(subtotalFromBudget)
    ? subtotalFromBudget
    : toNumber(totalItensCalculado, 0);

  let descGeral = 0;

  if (Number.isFinite(globalDiscountAmountFromBudget)) {
    descGeral = globalDiscountAmountFromBudget;
  } else if (globalDiscountType === 'percent' || globalDiscountType === 'percentage') {
    descGeral = subtotalProdutos * (globalDiscountValue / 100);
  } else if (globalDiscountType === 'value') {
    descGeral = globalDiscountValue;
  }

  descGeral = Math.max(0, descGeral);

  let descItens = 0;
  if (Number.isFinite(totalDiscountFromBudget)) {
    descItens = Math.max(0, totalDiscountFromBudget - descGeral);
  }
  descItens = Math.max(0, descItens);

  const frete = Math.max(0, freightFromBudget);

  const totalFinal = Number.isFinite(totalFinalFromBudget)
    ? totalFinalFromBudget
    : Math.max(0, subtotalProdutos - descGeral + frete);

  return {
    subtotalProdutos,
    descItens,
    descGeral,
    frete,
    totalFinal,
  };
}

function freteModeLabel(mode) {
  switch (Number(mode)) {
    case 0:
      return '0 - Emitente';
    case 1:
      return '1 - Destinatário';
    case 2:
      return '2 - Terceiros';
    case 9:
      return '9 - Sem frete';
    default:
      return '---';
  }
}

function getPaymentMethodNameFromRow(row) {
  return firstNonEmpty(
    row?.payment_method_name,
    row?.payment_form_name,
    row?.method_name,
    row?.name,
    row?.payment_method,
    row?.payment_form,
    row?.forma_pagamento
  );
}

function getNotesText(budget) {
  return firstNonEmpty(
    budget?.notes,
    budget?.observation,
    budget?.observations,
    budget?.observacao,
    budget?.observacoes,
    budget?.remarks,
    '---'
  );
}

function buildCustomerAddress(budget) {
  const streetType = firstNonEmpty(
    budget?.street_type,
    budget?.tipo_logradouro,
    budget?.address_type
  );

  const streetName = firstNonEmpty(
    budget?.street_name,
    budget?.logradouro,
    budget?.address,
    budget?.endereco
  );

  const streetNumber = firstNonEmpty(
    budget?.street_number,
    budget?.numero,
    budget?.address_number
  );

  const complement = firstNonEmpty(
    budget?.address_complement,
    budget?.complemento,
    budget?.complement
  );

  const neighborhood = firstNonEmpty(
    budget?.neighborhood,
    budget?.bairro,
    budget?.district
  );

  const city = firstNonEmpty(budget?.city, budget?.cidade);
  const state = firstNonEmpty(budget?.state, budget?.uf, budget?.estado);
  const postalCode = firstNonEmpty(budget?.postal_code, budget?.cep, budget?.zipcode);

  let line1 = '';
  if (streetType || streetName) {
    line1 += [streetType, streetName].filter(Boolean).join(' ');
  }
  if (streetNumber) {
    line1 += `${line1 ? ', ' : ''}${streetNumber}`;
  }
  if (complement) {
    line1 += `${line1 ? ' - ' : ''}${complement}`;
  }

  let line2 = '';
  if (neighborhood) line2 += neighborhood;
  if (city) line2 += `${line2 ? ' / ' : ''}${city}`;
  if (state) line2 += `${line2 ? ' - ' : ''}${state}`;
  if (postalCode) line2 += `${line2 ? ' | ' : ''}CEP ${postalCode}`;

  return [line1, line2].filter(Boolean).join(' | ') || '---';
}

function getItemSku(item) {
  return firstNonEmpty(item?.sku, item?.product_code, item?.codigo, item?.code);
}

function getItemDescription(item) {
  return firstNonEmpty(
    item?.description,
    item?.descricao,
    item?.product_name,
    item?.product_description,
    item?.nome
  );
}

function getItemUnit(item) {
  return firstNonEmpty(item?.unit, item?.unidade, item?.un, item?.unit_name);
}

function getItemQuantity(item) {
  return toNumber(
    item?.quantity ?? item?.quantidade ?? item?.qty ?? item?.qtd ?? item?.amount,
    0
  );
}

function getItemUnitPrice(item) {
  return toNumber(
    item?.unit_price ??
    item?.valor_unitario ??
    item?.price ??
    item?.valor ??
    item?.preco_unitario,
    0
  );
}

function getItemDiscountPercent(item) {
  const raw =
    item?.discount_percent ??
    item?.desconto_percent ??
    item?.desc_percent ??
    item?.perc_desconto ??
    item?.discount_pct ??
    item?.percent_discount ??
    item?.discountPercentage ??
    item?.desconto_percentual;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function getItemDiscountValue(item) {
  return toNumber(
    item?.discount_value ??
    item?.desconto_valor ??
    item?.valor_desconto ??
    item?.discount_amount ??
    item?.desc ??
    item?.desconto ??
    item?.discount ??
    item?.desc_value ??
    item?.descValue ??
    item?.discountValue ??
    item?.discount_value_amount ??
    item?.desconto_reais ??
    item?.line_discount ??
    item?.item_discount ??
    item?.valor_desc ??
    item?.['desc_r$'],
    0
  );
}

function getItemTotal(item, quantity, unitPrice, discountValue) {
  const fromRow = toNumber(
    item?.total ??
    item?.valor_total ??
    item?.total_value ??
    item?.line_total ??
    item?.subtotal_liquido ??
    item?.total_liquido ??
    item?.valor_liquido ??
    item?.net_total ??
    item?.final_total ??
    item?.amount_total,
    NaN
  );

  if (Number.isFinite(fromRow)) return Math.max(0, fromRow);

  return Math.max(0, quantity * unitPrice - discountValue);
}

function buildPaymentsText(budget) {
  const payments = resolveBudgetPaymentsArray(budget);

  if (payments.length) {
    const linhas = [];

    for (const p of payments) {
      const nome = getPaymentMethodNameFromRow(p) || 'FORMA NÃO INFORMADA';
      const valor = toNumber(p?.amount, 0);
      const obs = firstNonEmpty(p?.notes, p?.observacao);

      const manualDueDate = firstNonEmpty(
        p?.manual_due_date,
        p?.due_date,
        p?.payment_due_date,
        p?.data_vencimento,
        p?.vencimento
      );

      const vencText = formatarDataPagamento(manualDueDate);

      let linha = `${nome}: R$ ${money(valor)}`;

      if (vencText) {
        linha += ` | Venc.: ${vencText}`;
      }

      if (obs) {
        linha += ` (${obs})`;
      }

      linhas.push(linha);
    }

    return linhas.join('\n');
  }

  return firstNonEmpty(
    budget?.payment_method_name,
    budget?.payment_form_name,
    budget?.forma_pagamento_nome,
    budget?.forma_pagamento,
    budget?.payment_method,
    budget?.payment_form,
    budget?.condicao_pagamento,
    '---'
  );
}

function splitTextToFit(doc, text, width, maxHeight, options = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) return { fit: '', rest: '' };

  const opts = { width, ...options };

  let fullH = Infinity;
  try {
    fullH = doc.heightOfString(raw, opts);
  } catch {
    fullH = Infinity;
  }

  if (fullH <= maxHeight) return { fit: raw, rest: '' };

  let lo = 0;
  let hi = raw.length;
  let bestLen = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = raw.slice(0, mid).trimEnd();

    let h = Infinity;
    try {
      h = doc.heightOfString(candidate, opts);
    } catch {
      h = Infinity;
    }

    if (h <= maxHeight) {
      bestLen = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  let cut = bestLen;
  if (cut > 30) {
    const lastSpace = raw.lastIndexOf(' ', cut);
    if (lastSpace > 10) cut = lastSpace;
  }

  const fit = raw.slice(0, cut).trimEnd();
  const rest = raw.slice(cut).trimStart();

  return { fit, rest };
}

/* ──────────────────────────────────────────────────────────────
   Tabela de informações vertical
────────────────────────────────────────────────────────────── */
function drawInfoTable(
  doc,
  {
    x,
    y,
    width,
    rows = [],
    title = '',
    col1Width = 90,
    minRowHeight = 18,
    fontSize = 8.5,
    titleHeight = 0,
    paddingX = 8,
    paddingY = 5,
  }
) {
  const safeRows = Array.isArray(rows) ? rows : [];

  doc.font('Helvetica').fontSize(fontSize);

  const measuredRows = safeRows.map((row) => {
    const label = `${row.label || ''}:`;
    const value = textOr(row.value, '---');

    const valueHeight = doc.heightOfString(String(value), {
      width: width - col1Width - paddingX * 2,
      align: 'left',
      lineGap: 1,
    });

    doc.font('Helvetica-Bold').fontSize(fontSize);
    const labelHeight = doc.heightOfString(String(label), {
      width: col1Width - paddingX * 2,
      align: 'left',
      lineGap: 1,
    });

    const rowHeight = Math.max(
      minRowHeight,
      Math.ceil(Math.max(valueHeight, labelHeight) + paddingY * 2)
    );

    return {
      ...row,
      label,
      value,
      rowHeight,
    };
  });

  const bodyHeight = measuredRows.reduce((acc, row) => acc + row.rowHeight, 0);
  const totalHeight = titleHeight + bodyHeight;

  doc.lineWidth(0.5).strokeColor(COLORS.border).rect(x, y, width, totalHeight).stroke();

  if (title) {
    doc.save();
    doc.rect(x, y, width, titleHeight).fill(COLORS.headerFill);
    doc.restore();

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(title, x + paddingX, y + 6, {
        width: width - paddingX * 2,
        align: 'left',
      });
  }

  const startY = y + titleHeight;

  doc
    .lineWidth(0.3)
    .strokeColor(COLORS.border)
    .moveTo(x + col1Width, startY)
    .lineTo(x + col1Width, y + totalHeight)
    .stroke();

  let cursorY = startY;

  measuredRows.forEach((row, index) => {
    if (index > 0) {
      doc
        .lineWidth(0.3)
        .strokeColor(COLORS.border)
        .moveTo(x, cursorY)
        .lineTo(x + width, cursorY)
        .stroke();
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(row.label, x + paddingX, cursorY + paddingY, {
        width: col1Width - paddingX * 2,
        align: 'left',
        lineGap: 1,
      });

    doc
      .font('Helvetica')
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(row.value, x + col1Width + paddingX, cursorY + paddingY, {
        width: width - col1Width - paddingX * 2,
        align: 'left',
        lineGap: 1,
      });

    cursorY += row.rowHeight;
  });

  return totalHeight;
}

/* ──────────────────────────────────────────────────────────────
   Imagens (local + URL + GCS)
────────────────────────────────────────────────────────────── */
function localBufferIfExists(absPath) {
  try {
    if (absPath && fs.existsSync(absPath)) return fs.readFileSync(absPath);
  } catch { }
  return null;
}

async function httpBuffer(url) {
  try {
    if (typeof fetch === 'function') {
      const r = await fetch(url);
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    }

    const lib = url.startsWith('https')
      ? await import('node:https')
      : await import('node:http');

    return await new Promise((resolve) => {
      lib.default
        .get(url, (res) => {
          if (res.statusCode !== 200) return resolve(null);
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

async function drawImageBuffer(doc, buf, x, y, fit) {
  if (!buf) return false;

  try {
    doc.image(buf, x, y, { fit, align: 'center', valign: 'center' });
    return true;
  } catch {
    try {
      const sharp = (await import('sharp')).default;
      const pngBuf = await sharp(buf).png().toBuffer();
      doc.image(pngBuf, x, y, { fit, align: 'center', valign: 'center' });
      return true;
    } catch {
      return false;
    }
  }
}

async function resolveItemImageBuffer(item, options = {}) {
  const imagesDir = options.imagesDir || path.resolve(__dirname, '../../public/imagens');
  const remoteBase = (options.remoteImagesBaseUrl || '').trim();

  if (!item || typeof item !== 'object') return null;

  const pathCandidatesRaw = [
    item.image_path,
    item.imagePath,
    item.image_file,
    item.imageFile,
    item.imagem_path,
    item.imagemFile,
  ].filter((v) => v != null && String(v).trim() !== '');

  for (const p of pathCandidatesRaw) {
    const imagePathStr = String(p).trim();

    if (/^https?:\/\//i.test(imagePathStr)) {
      const b = await httpBuffer(imagePathStr);
      if (b) return b;
      continue;
    }

    const localPath = path.isAbsolute(imagePathStr)
      ? imagePathStr
      : path.resolve(imagesDir, imagePathStr);

    const localBuf = localBufferIfExists(localPath);
    if (localBuf) return localBuf;

    if (remoteBase) {
      const base = remoteBase.replace(/\/+$/, '');
      const rel = imagePathStr.replace(/^\/+/, '');
      const url = `${base}/${rel}`;
      const b = await httpBuffer(url);
      if (b) return b;
    }
  }

  const urlCandidatesRaw = [
    item.image_url,
    item.imageUrl,
    item.product_image_url,
    item.productImageUrl,
    item.image_gcs,
    item.image_gcs_url,
    item.url_imagem,
    item.imagem_url,
  ].filter((v) => v != null && String(v).trim() !== '');

  for (const u of urlCandidatesRaw) {
    const urlStr = String(u).trim();
    if (/^https?:\/\//i.test(urlStr)) {
      const b = await httpBuffer(urlStr);
      if (b) return b;
    }
  }

  for (const v of Object.values(item)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
      const b = await httpBuffer(v.trim());
      if (b) return b;
    }
  }

  const sku = getItemSku(item);
  if (sku) {
    const extsLocal = ['.png', '.jpg', '.jpeg', '.webp'];
    for (const ext of extsLocal) {
      const guessLocal = path.resolve(imagesDir, `${sku}${ext}`);
      const bLocal = localBufferIfExists(guessLocal);
      if (bLocal) return bLocal;
    }

    if (remoteBase) {
      const base = remoteBase.replace(/\/+$/, '');
      const prefix = 'bh3Distribuidora/productsImagens';
      const exts = ['webp', 'jpeg', 'jpg', 'png'];

      for (const ext of exts) {
        const url = `${base}/${prefix}/${sku}.${ext}`;
        const b = await httpBuffer(url);
        if (b) return b;
      }
    }
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────
   Linha horizontal simples
────────────────────────────────────────────────────────────── */
function drawInlineInfoRow(
  doc,
  {
    x,
    y,
    width,
    items = [],
    height = 24,
    fontSize = 8.8,
    labelFont = 'Helvetica-Bold',
    valueFont = 'Helvetica',
    paddingX = 10,
    paddingY = 5,
  }
) {
  const safeItems = (Array.isArray(items) ? items : []).filter(
    (item) => item && String(item.value || '').trim() !== ''
  );

  if (!safeItems.length) return height;

  doc.lineWidth(0.5).strokeColor(COLORS.border).rect(x, y, width, height).stroke();

  const cellWidth = width / safeItems.length;

  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    const cellX = x + i * cellWidth;

    if (i > 0) {
      doc
        .lineWidth(0.3)
        .strokeColor(COLORS.border)
        .moveTo(cellX, y)
        .lineTo(cellX, y + height)
        .stroke();
    }

    const label = `${item.label}:`;
    const value = textOr(item.value, '---');

    doc.font(labelFont).fontSize(fontSize);
    const labelWidth = doc.widthOfString(label);

    const labelX = cellX + paddingX;
    const labelY = y + paddingY;
    const valueX = labelX + labelWidth + 4;
    const valueWidth = Math.max(20, cellWidth - (paddingX * 2 + labelWidth + 4));

    doc
      .font(labelFont)
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(label, labelX, labelY, {
        width: labelWidth + 2,
        align: 'left',
        lineBreak: false,
      });

    const useEllipsis = item.ellipsis !== false;

    doc
      .font(valueFont)
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(value, valueX, labelY, {
        width: valueWidth,
        height: height - paddingY * 2,
        align: 'left',
        ellipsis: useEllipsis,
        lineBreak: false,
      });
  }

  return height;
}

/* ──────────────────────────────────────────────────────────────
   Linha horizontal com pesos customizados
────────────────────────────────────────────────────────────── */
function drawInlineInfoGridRow(
  doc,
  {
    x,
    y,
    width,
    items = [],
    height = 24,
    fontSize = 8.2,
    labelFont = 'Helvetica-Bold',
    valueFont = 'Helvetica',
    paddingX = 8,
    paddingY = 5,
  }
) {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!safeItems.length) return height;

  const totalWeight = safeItems.reduce((acc, item) => acc + (Number(item.weight) || 1), 0);

  doc.lineWidth(0.5).strokeColor(COLORS.border).rect(x, y, width, height).stroke();

  let cursorX = x;

  safeItems.forEach((item, index) => {
    const weight = Number(item.weight) || 1;
    const cellWidth = (width * weight) / totalWeight;

    if (index > 0) {
      doc
        .lineWidth(0.3)
        .strokeColor(COLORS.border)
        .moveTo(cursorX, y)
        .lineTo(cursorX, y + height)
        .stroke();
    }

    const label = `${item.label}:`;
    const value = textOr(item.value, '---');

    doc.font(labelFont).fontSize(fontSize);
    const labelWidth = doc.widthOfString(label);

    const labelX = cursorX + paddingX;
    const labelY = y + paddingY;
    const valueX = labelX + labelWidth + 4;
    const valueWidth = Math.max(20, cellWidth - (paddingX * 2 + labelWidth + 4));

    doc
      .font(labelFont)
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(label, labelX, labelY, {
        width: labelWidth + 2,
        align: 'left',
        lineBreak: false,
      });

    doc
      .font(valueFont)
      .fontSize(fontSize)
      .fillColor(COLORS.text)
      .text(value, valueX, labelY, {
        width: valueWidth,
        height: height - paddingY * 2,
        align: 'left',
        ellipsis: true,
        lineBreak: false,
      });

    cursorX += cellWidth;
  });

  return height;
}

/* ──────────────────────────────────────────────────────────────
   Layout
────────────────────────────────────────────────────────────── */
function drawHeader(doc, company, budget) {
  const configuredLogoPath = firstNonEmpty(
    company?.logoPath,
    company?.logoUrl,
    company?.logo_url
  );

  const candidatePaths = [
    configuredLogoPath,
    configuredLogoPath && !/^https?:\/\//i.test(configuredLogoPath)
      ? path.resolve(process.cwd(), configuredLogoPath.replace(/^[/\\]+/, ''))
      : null,
    configuredLogoPath && !/^https?:\/\//i.test(configuredLogoPath)
      ? path.resolve(process.cwd(), 'backend', configuredLogoPath.replace(/^[/\\]+/, ''))
      : null,
    path.resolve(__dirname, '../../public/imagens/logoBh3Supply.png'),
    path.resolve(process.cwd(), 'backend/public/imagens/logoBh3Supply.png'),
    path.resolve(process.cwd(), 'public/imagens/logoBh3Supply.png'),
  ].filter(Boolean);

  let logoPathFinal = Buffer.isBuffer(company?.logoBuffer)
    ? company.logoBuffer
    : null;

  if (!logoPathFinal) {
    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        logoPathFinal = p;
        break;
      }
    }
  }

  const headerY = 20;
  const headerX = TABLE_LEFT;
  const headerRight = TABLE_RIGHT;

  const logoBoxW = 130;
  const gap = 15;
  const contentX = headerX + logoBoxW + gap;
  const contentW = headerRight - contentX;

  const companyRow1Height = 24;
  const companyRow2Height = 24;
  const companyBlockHeight = companyRow1Height + companyRow2Height;

  if (logoPathFinal) {
    try {
      const logoFitW = 350;
      const logoFitH = 125;

      const logoX = headerX + (logoBoxW - logoFitW) / 2;
      const logoY = headerY + (companyBlockHeight - logoFitH) / 2;

      doc.image(logoPathFinal, logoX, logoY, {
        fit: [logoFitW, logoFitH],
        align: 'center',
        valign: 'center',
      });
    } catch { }
  }

  doc.fillColor(COLORS.text);

  const rawContacts = firstNonEmpty(company?.contacts, '');
  const extractedEmail =
    (rawContacts.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';

  const extractedPhone = rawContacts
    ? rawContacts
      .replace(extractedEmail, '')
      .replace(/[•|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    : '';

  const companyPhone = firstNonEmpty(
    company?.phone,
    company?.phones,
    company?.telephone,
    company?.telefone,
    company?.contact_phone,
    extractedPhone
  );

  const companyEmail = firstNonEmpty(
    company?.email,
    company?.mail,
    company?.contact_email,
    extractedEmail
  );

  const companySite = firstNonEmpty(company?.site, company?.website, '');

  const row1Y = headerY;
  const row2Y = row1Y + companyRow1Height;

  drawInlineInfoGridRow(doc, {
    x: contentX,
    y: row1Y,
    width: contentW,
    height: companyRow1Height,
    fontSize: 8.2,
    items: [
      { label: 'Empresa', value: textOr(company?.name, 'Sua Empresa'), weight: 1.5 },
      { label: 'CNPJ', value: textOr(company?.cnpj, ''), weight: 1.3 },
      {
        label: 'Endereço',
        value: textOr(company?.addressLine, ''),
        weight: 2.2,
        ellipsis: false,
      },
    ],
  });

  drawInlineInfoRow(doc, {
    x: contentX,
    y: row2Y,
    width: contentW,
    height: companyRow2Height,
    fontSize: 8.2,
    items: [
      { label: 'Contato', value: textOr(companyPhone, '---') },
      { label: 'E-mail', value: textOr(companyEmail, '---') },
      { label: 'Site', value: textOr(companySite, '---') },
    ],
  });

  const companyBlockBottom = row2Y + companyRow2Height;
  const dividerY = companyBlockBottom + 6;

  doc
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .moveTo(TABLE_LEFT, dividerY)
    .lineTo(TABLE_RIGHT, dividerY)
    .stroke();

  const oNumero = textOr(
    firstNonEmpty(
      budget?.number,
      budget?.budget_number,
      budget?.budget_num,
      budget?.orcamento_num,
      budget?.budget_id,
      budget?.id
    )
  );

  const oCliente = textOr(
    firstNonEmpty(
      budget?.customer_name,
      budget?.nome_razao_social,
      budget?.trade_name,
      budget?.legal_name
    )
  );

  const oDoc = textOr(firstNonEmpty(budget?.customer_tax_id, budget?.cnpj_cpf));

  const oTel = textOr(
    firstNonEmpty(
      budget?.customer_phone,
      budget?.telefone_cliente,
      budget?.telefone,
      budget?.phone,
      budget?.phone_number
    )
  );

  const oMail = textOr(
    firstNonEmpty(budget?.customer_email, budget?.email_cliente, budget?.email)
  );

  const oData = formatarData(budget?.issue_date || budget?.created_at || budget?.budget_date);
  const oVendedor = textOr(firstNonEmpty(budget?.seller_name, budget?.vendedor));
  const oEndereco = buildCustomerAddress(budget);

  const { freteMode } = resolveFrete(budget);
  const freteLabel = freteModeLabel(freteMode);

  const customerTableX = TABLE_LEFT;
  const customerTableY = dividerY + 10;
  const customerTableW = TABLE_WIDTH;

  const customerRow1Y = customerTableY;
  const customerRow2Y = customerRow1Y + 24;

  drawInlineInfoGridRow(doc, {
    x: customerTableX,
    y: customerRow1Y,
    width: customerTableW,
    height: 24,
    fontSize: 7.9,
    items: [
      { label: 'Orçamento', value: oNumero, weight: 0.9 },
      { label: 'Cliente', value: oCliente, weight: 2.5 },
      { label: 'CPF/CNPJ', value: oDoc, weight: 1.7 },
      { label: 'Telefone', value: oTel, weight: 1.2 },
      { label: 'Email', value: oMail, weight: 1.7 },
    ],
  });

  drawInlineInfoGridRow(doc, {
    x: customerTableX,
    y: customerRow2Y,
    width: customerTableW,
    height: 24,
    fontSize: 8.1,
    items: [
      { label: 'Data', value: oData, weight: 1.0 },
      { label: 'Vendedor', value: oVendedor, weight: 1.2 },
      { label: 'Frete', value: freteLabel, weight: 1.2 },
      { label: 'Endereço', value: oEndereco, weight: 4.2 },
    ],
  });

  return {
    bottomY: customerRow2Y + 24,
  };
}

function drawTableHeader(doc, y) {
  const { x, w, headers, headerHeight } = COLS;

  doc.font('Helvetica-Bold').fontSize(9);
  headers.forEach((label, i) => {
    const xi = x[i];
    const width = w[i];

    doc.save();
    doc.rect(xi, y, width, headerHeight).fill(COLORS.headerFill);
    doc.restore();

    doc.fillColor(COLORS.text).text(label, xi, y + 5, {
      width,
      align: 'center',
    });
  });

  doc
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .moveTo(x[0], y + headerHeight)
    .lineTo(x[x.length - 1], y + headerHeight)
    .stroke();
}

function drawVerticalGrid(doc, yStart, yEnd) {
  const { x } = COLS;
  x.forEach((xi) => {
    doc
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .moveTo(xi, yStart)
      .lineTo(xi, yEnd)
      .stroke();
  });
}

function drawEmptyImagePlaceholder(doc, x, y, w, h) {
  doc.rect(x, y, w, h).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(COLORS.text).text('sem imagem', x, y + (h / 2 - 4), {
    width: w,
    align: 'center',
  });
}

function finalizeDoc(doc, output, dir, filename, fileStream, chunks) {
  if (output === 'response' || output === 'stream') {
    return Promise.resolve();
  }

  if (output === 'file') {
    const fullPath = path.join(dir, sanitizeFilename(filename));
    return new Promise((resolve, reject) => {
      fileStream.on('finish', () => resolve(fullPath));
      fileStream.on('error', reject);
    });
  }

  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/* ──────────────────────────────────────────────────────────────
   API Principal
────────────────────────────────────────────────────────────── */
export async function generateBudgetPdf(budget, options = {}) {
  const {
    company = {},
    output = 'response', // response | file | buffer | stream
    res = null,
    stream = null,
    filename = defaultFilename(budget),
    dir = path.resolve(__dirname, '../../public/pdfs'),
    paymentMethodResolver = null,
    gradeResolver = null,
    imagesDir = path.resolve(__dirname, '../../public/imagens'),
    remoteImagesBaseUrl = DEFAULT_REMOTE_BASE_URL,
    debug = false,
  } = options;

  const pdfCompany = { ...company };
  const configuredLogo = firstNonEmpty(
    company?.logoUrl,
    company?.logo_url,
    company?.logoPath
  );

  if (/^https?:\/\//i.test(configuredLogo)) {
    try {
      // 1) Preferência: lê diretamente do bucket logoEnterprise via GCS SDK.
      // Isso funciona mesmo quando o objeto não possui acesso público.
      pdfCompany.logoBuffer = await downloadEnterpriseLogoByUrl(configuredLogo, {
        silent: true,
      });

      // 2) Fallback para URLs externas ou para um objeto que não pertença
      // ao bucket/prefixo gerenciado pelo service de Enterprise.
      if (!pdfCompany.logoBuffer) {
        pdfCompany.logoBuffer = await httpBuffer(configuredLogo);
      }

      if (debug) {
        console.log('[BUDGET PDF] Logo da empresa:', {
          source: pdfCompany.logoBuffer ? 'bucket/http' : 'not-found',
          logoUrl: configuredLogo,
        });
      }
    } catch (error) {
      if (debug) {
        console.warn('[BUDGET PDF] Não foi possível carregar logo_url:', error?.message);
      }
    }
  }

  const doc = new PDFDocument({
    margin: PAGE.margin,
    size: PAGE.size,
    layout: PAGE.layout,
    info: { Title: filename.replace(/\.pdf$/i, '') },
  });

  const chunks = [];
  let fileStream = null;

  if (output === 'response') {
    if (!res || typeof res.setHeader !== 'function') {
      throw new Error('Para output="response", informe { res }.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition(filename));
    doc.pipe(res);
  } else if (output === 'file') {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, sanitizeFilename(filename));
    fileStream = fs.createWriteStream(fullPath);
    doc.pipe(fileStream);
  } else if (output === 'stream') {
    const writable = stream || res;
    if (!writable || typeof writable.write !== 'function') {
      throw new Error('Para output="stream", informe { stream } ou { res } gravável.');
    }
    doc.pipe(writable);
  } else {
    doc.on('data', (c) => chunks.push(c));
  }

  const items = resolveBudgetItemsArray(budget);
  const payments = resolveBudgetPaymentsArray(budget);
  const installments = resolveBudgetInstallmentsArray(budget);

  if (debug) {
    console.log('[BUDGET PDF] items:', items.length);
    console.log('[BUDGET PDF] payments:', payments.length);
    console.log('[BUDGET PDF] installments:', installments.length);
  }

  const headerLayout = drawHeader(doc, pdfCompany, budget);

  const { x, w, rowHeight, headerHeight } = COLS;
  let y = (headerLayout?.bottomY || 210) + 12;

  drawTableHeader(doc, y);
  y += headerHeight;

  let alturaMaxPagina = doc.page.height - PAGE.margin - 20;
  let totalGeral = 0;
  let yInicioBloco = y;

  if (!items.length) {
    const yEmpty = y + 12;
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text('Nenhum item encontrado para este orçamento.', x[0], yEmpty, {
        width: COLS.x[COLS.x.length - 1] - x[0],
        align: 'center',
      });

    y += 32;

    doc
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .moveTo(x[0], y)
      .lineTo(x[x.length - 1], y)
      .stroke();

    drawVerticalGrid(doc, yInicioBloco, y);
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    console.log('ITEM PDF >>>', it);
    console.log('NCM PDF >>>', {
      sku: it?.sku,
      ncm: it?.ncm,
      codigo_ncm: it?.codigo_ncm,
      ncm_code: it?.ncm_code,
      ncm_produto: it?.ncm_produto,
      product_ncm: it?.product_ncm,
    });

    if (debug) {
      console.log('[PDF ITEM RAW]', JSON.stringify(it, null, 2));
    }

    const sku = getItemSku(it);
    const descricao = getItemDescription(it);

    let grade = firstNonEmpty(
      it?.grade,
      it?.grade_nome,
      it?.grade_name,
      it?.grade_desc,
      it?.grade_descricao,
      it?.variacao,
      it?.variation
    );

    if (!grade && typeof gradeResolver === 'function' && sku) {
      try {
        const g = await gradeResolver(sku, it);
        if (g) grade = String(g);
      } catch (err) {
        if (debug) console.error('[BUDGET PDF] gradeResolver error:', err);
      }
    }

    const unidade = getItemUnit(it);
    const ncm = getItemNcm(it);
    const quantidade = getItemQuantity(it);
    const valorUnit = getItemUnitPrice(it);

    const descontoPct = getItemDiscountPercent(it);
    const descontoValItem = getItemDiscountValue(it);

    const hasPct = Number.isFinite(Number(descontoPct));
    const descFromPct = hasPct ? valorUnit * quantidade * (Number(descontoPct) / 100) : 0;

    const vDesc = Math.max(descFromPct, descontoValItem);
    const vTotal = getItemTotal(it, quantidade, valorUnit, vDesc);

    totalGeral += vTotal;

    const yBase = y;

    const IMG_W = 44;
    const IMG_H = 34;
    const IMG_X = x[0] + 13;
    const IMG_Y = yBase + 5;

    const buf = await resolveItemImageBuffer(it, { imagesDir, remoteImagesBaseUrl });

    if (!(await drawImageBuffer(doc, buf, IMG_X, IMG_Y, [IMG_W, IMG_H]))) {
      drawEmptyImagePlaceholder(doc, IMG_X, IMG_Y, IMG_W, IMG_H);
    }

    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);

    doc.text(`${sku || ''}`, x[1], yBase + 12, { width: w[1] - 4, align: 'center' });
    doc.text(truncarTexto(descricao, 75), x[2], yBase + 12, {
      width: w[2] - 4,
      align: 'center',
    });
    doc.text(`${grade || ''}`, x[3], yBase + 12, { width: w[3] - 4, align: 'center' });
    doc.font('Helvetica').fontSize(9);
    doc.text(`${unidade || ''}`, x[4], yBase + 8, {
      width: w[4] - 4,
      align: 'center',
      lineBreak: false,
    });

    doc.font('Helvetica').fontSize(7);
    doc.text(`${ncm || ''}`, x[4], yBase + 24, {
      width: w[4] - 4,
      align: 'center',
      lineBreak: false,
    });
    doc.text(`${quantidade}`, x[5], yBase + 12, { width: w[5] - 4, align: 'center' });
    doc.text(`R$ ${money(valorUnit)}`, x[6], yBase + 12, {
      width: w[6] - 4,
      align: 'center',
    });

    const descPctText = hasPct ? `${Number(descontoPct).toFixed(2)}%` : '0.00%';
    const vDescText = `R$ ${money(vDesc)}`;

    doc.text(descPctText, x[7], yBase + 12, { width: w[7] - 4, align: 'center' });
    doc.text(vDescText, x[8], yBase + 12, { width: w[8] - 4, align: 'center' });
    doc.text(`R$ ${money(vTotal)}`, x[9], yBase + 12, { width: w[9] - 4, align: 'center' });

    doc
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .moveTo(x[0], y + rowHeight)
      .lineTo(x[x.length - 1], y + rowHeight)
      .stroke();

    y += rowHeight;

    const fimPagina = i === items.length - 1 || y + rowHeight > alturaMaxPagina;
    if (fimPagina) {
      drawVerticalGrid(doc, yInicioBloco, y);

      if (i < items.length - 1) {
        doc.addPage({ layout: PAGE.layout, margin: PAGE.margin, size: PAGE.size });

        const nextHeaderLayout = drawHeader(doc, pdfCompany, budget);

        y = (nextHeaderLayout?.bottomY || 210) + 12;
        drawTableHeader(doc, y);
        y += headerHeight;
        yInicioBloco = y;
        alturaMaxPagina = doc.page.height - PAGE.margin - 20;
      }
    }
  }

  let forma = buildPaymentsText(budget);

  if ((!forma || forma === '---') && !payments.length) {
    const idRaw = firstNonEmpty(
      budget?.payment_method_id,
      budget?.payment_form_id,
      budget?.forma_pagamento_id,
      budget?.condicao_pagamento_id
    );

    const id = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;

    if (id && typeof paymentMethodResolver === 'function') {
      try {
        const nm = await paymentMethodResolver(id);
        if (nm) forma = String(nm);
      } catch (err) {
        console.error('[BUDGET PDF] Falha ao resolver forma de pagamento:', err);
      }
    }
  }

  forma = forma || '---';

  const LEFT = TABLE_LEFT;
  const TOTAL_WIDTH = TABLE_WIDTH;

  const GAP = 20;
  const wForma = 220;
  const wObs = TOTAL_WIDTH - wForma - GAP;

  const xObs = LEFT;
  const xForma = LEFT + wObs + GAP;

  const { subtotalProdutos, descGeral, frete, totalFinal } = resolveBudgetFinancialTotals(
    budget,
    totalGeral
  );

  const obsRaw = getNotesText(budget);

  const obsPadTop = 20;
  const obsBottomPad = 12;
  const obsMinH = 70;
  const obsMaxHMarginBottom = 20;
  const obsWInner = wObs - 20;

  const drawPaymentBox = (docRef, x0, y0, w0, h0) => {
    docRef.rect(x0, y0, w0, h0).stroke();

    docRef
      .fillColor(COLORS.text)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Forma de Pagamento:', x0 + 10, y0 + 5);

    const pad = 10;
    const titleBottomY = y0 + 20;
    const contentX = x0 + pad;
    const contentW = w0 - pad * 2;

    const paymentText = forma || '---';

    docRef.font('Helvetica').fontSize(9).fillColor(COLORS.text);

    const paymentTextHeight = docRef.heightOfString(paymentText, {
      width: contentW,
      align: 'left',
      lineGap: 1,
    });

    const paymentY = titleBottomY + 8;

    docRef.text(paymentText, contentX, paymentY, {
      width: contentW,
      align: 'left',
      lineGap: 1,
    });

    // Os totais sempre começam DEPOIS da forma de pagamento.
    // Nunca usamos Math.min aqui, pois isso poderia puxar o separador
    // para cima e sobrepor textos como "BOLETO 7 DIAS".
    const minGapAfterPaymentText = 10;
    const totalsStartY = paymentY + paymentTextHeight + minGapAfterPaymentText;

    docRef
      .lineWidth(0.3)
      .strokeColor(COLORS.border)
      .moveTo(x0 + 8, totalsStartY)
      .lineTo(x0 + w0 - 8, totalsStartY)
      .stroke();

    const labelW = 70;
    const valueW = 90;
    const labelsX = x0 + 12;
    const valuesX = x0 + w0 - valueW - 12;

    const bottomPadding = 12;
    const totalLinesHeight = 12 + 12 + 14; // subtotal + frete + total

    let ty = totalsStartY + 8;

    docRef.font('Helvetica').fontSize(9).fillColor(COLORS.text);

    docRef.text('Subtotal:', labelsX, ty, { width: labelW, align: 'left' });
    docRef.text(`R$ ${money(subtotalProdutos)}`, valuesX, ty, {
      width: valueW,
      align: 'right',
    });

    ty += 12;
    docRef.text('Frete:', labelsX, ty, { width: labelW, align: 'left' });
    docRef.text(`R$ ${money(frete)}`, valuesX, ty, {
      width: valueW,
      align: 'right',
    });

    ty += 12;
    docRef.text('Desc. Geral:', labelsX, ty, { width: labelW, align: 'left' });
    docRef.text(`R$ ${money(descGeral)}`, valuesX, ty, {
      width: valueW,
      align: 'right',
    });

    ty += 14;
    docRef.font('Helvetica-Bold');
    docRef.text('Total:', labelsX, ty, { width: labelW, align: 'left' });
    docRef.text(`R$ ${money(totalFinal)}`, valuesX, ty, {
      width: valueW,
      align: 'right',
    });

    docRef.font('Helvetica');
  };

  {
    const margemY = y + 30;
    const maxAvail = Math.floor(doc.page.height - PAGE.margin - margemY - obsMaxHMarginBottom);

    doc.font('Helvetica').fontSize(9);

    let obsTextH = 0;
    try {
      obsTextH = doc.heightOfString(obsRaw, {
        width: obsWInner,
        align: 'left',
        lineGap: 1,
      });
    } catch {
      obsTextH = 99999;
    }

    let formaTextH = 0;
    try {
      formaTextH = doc.heightOfString(forma, {
        width: wForma - 20,
        align: 'left',
        lineGap: 1,
      });
    } catch {
      formaTextH = 0;
    }

    const neededObsH = obsPadTop + obsTextH + obsBottomPad;
    // título (20) + respiro (8) + pagamento + respiro/separador (10)
    // + totais (50) + margem inferior (12)
    const neededFormaH = Math.max(obsMinH, 100 + formaTextH);
    const neededH = Math.max(neededObsH, neededFormaH);

    const boxH = clamp(Math.ceil(neededH), obsMinH, Math.max(obsMinH, maxAvail));
    const innerH = boxH - obsPadTop - obsBottomPad;

    // Só desenha os dois boxes nesta página se a altura calculada realmente
    // couber. Antes, o box era reduzido pelo clamp e os totais se sobrepunham
    // à forma de pagamento.
    const fitsAllHere =
      obsTextH <= innerH &&
      maxAvail >= obsMinH &&
      neededH <= maxAvail;

    if (fitsAllHere) {
      doc.rect(xObs, margemY, wObs, boxH).stroke();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.text)
        .text('Observações:', xObs + 10, margemY + 5);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(COLORS.text)
        .text(obsRaw, xObs + 10, margemY + obsPadTop, {
          width: wObs - 20,
          height: innerH,
          align: 'left',
          lineGap: 1,
        });

      drawPaymentBox(doc, xForma, margemY, wForma, boxH);

      doc.end();
      return finalizeDoc(doc, output, dir, filename, fileStream, chunks);
    }
  }

  {
    let rest = obsRaw;
    let pageCount = 0;

    // "---" representa observação vazia. Não deve entrar neste laço,
    // pois o bloco vazio é desenhado uma única vez logo abaixo.
    while (rest && rest.trim() && rest.trim() !== '---') {
      doc.addPage({ layout: PAGE.layout, margin: PAGE.margin, size: PAGE.size });
      const obsHeaderLayout = drawHeader(doc, pdfCompany, budget);

      const y0 = (obsHeaderLayout?.bottomY || 210) + 12;
      const maxAvail = Math.floor(doc.page.height - PAGE.margin - y0 - obsMaxHMarginBottom);
      const maxInnerH = Math.max(40, maxAvail - obsPadTop - obsBottomPad);

      doc.font('Helvetica').fontSize(9);

      const { fit, rest: newRest } = splitTextToFit(doc, rest, obsWInner, maxInnerH, {
        align: 'left',
        lineGap: 1,
      });

      let fitH = 0;
      try {
        fitH = doc.heightOfString(fit, {
          width: obsWInner,
          align: 'left',
          lineGap: 1,
        });
      } catch {
        fitH = maxInnerH;
      }

      let formaTextH = 0;
      try {
        formaTextH = doc.heightOfString(forma, {
          width: wForma - 20,
          align: 'left',
          lineGap: 1,
        });
      } catch {
        formaTextH = 0;
      }

      const neededObsH = obsPadTop + fitH + obsBottomPad;
      const neededFormaH = Math.max(obsMinH, 100 + formaTextH);
      const neededH = Math.max(neededObsH, neededFormaH);

      const boxH = clamp(Math.ceil(neededH), obsMinH, maxAvail);
      const innerH = boxH - obsPadTop - obsBottomPad;

      const title = pageCount === 0 ? 'Observações:' : 'Observações (continuação):';

      doc.rect(xObs, y0, wObs, boxH).stroke();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.text)
        .text(title, xObs + 10, y0 + 5);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(COLORS.text)
        .text(fit, xObs + 10, y0 + obsPadTop, {
          width: wObs - 20,
          height: innerH,
          align: 'left',
          lineGap: 1,
        });

      const isLast = !newRest || !newRest.trim();
      if (isLast) {
        drawPaymentBox(doc, xForma, y0, wForma, boxH);
      }

      rest = newRest;
      pageCount += 1;
    }

    if (!obsRaw || obsRaw === '---') {
      doc.addPage({ layout: PAGE.layout, margin: PAGE.margin, size: PAGE.size });
      const emptyObsHeaderLayout = drawHeader(doc, pdfCompany, budget);

      const y0 = (emptyObsHeaderLayout?.bottomY || 210) + 12;
      doc.font('Helvetica').fontSize(9);
      const formaTextH = doc.heightOfString(forma || '---', {
        width: wForma - 20,
        align: 'left',
        lineGap: 1,
      });
      const boxH = Math.max(obsMinH, Math.ceil(100 + formaTextH));

      doc.rect(xObs, y0, wObs, boxH).stroke();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.text)
        .text('Observações:', xObs + 10, y0 + 5);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(COLORS.text)
        .text('---', xObs + 10, y0 + obsPadTop, {
          width: wObs - 20,
          height: boxH - obsPadTop - obsBottomPad,
          align: 'left',
          lineGap: 1,
        });

      drawPaymentBox(doc, xForma, y0, wForma, boxH);
    }
  }

  doc.end();
  return finalizeDoc(doc, output, dir, filename, fileStream, chunks);
}

export default { generateBudgetPdf };
