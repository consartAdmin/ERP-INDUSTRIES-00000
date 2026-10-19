// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ generateMobilizedPdf.js — PDFKit (ESM)                                    ║
// ║ Path: backend/generationPdf/generateMobilizedPdf.js                       ║
// ║                                                                            ║
// ║ ✅ Layout: A4 LANDSCAPE (paisagem)                                        ║
// ║ ✅ Coluna "Img" com thumbnail (contain)                                   ║
// ║ ✅ Informações extras no item (em "Descrição"):                            ║
// ║    - MODELO (item.model)                                                  ║
// ║    - S/N    (item.serial_number)                                          ║
// ║    - NF-e   (item.nfe_ref)                                                ║
// ║    - OBS    (item.notes, limpando IMG_PATH/IMG_URL)                       ║
// ║                                                                            ║
// ║ ✅ 3 Caixas no lado direito (igual imagem):                               ║
// ║    - MODELO / S/N / NF-e dentro de caixas vermelhas                       ║
// ║                                                                            ║
// ║ ✅ Imagem por item (buffer resolver):                                     ║
// ║    1) IMG_PATH (GCS privado) → signed-url                                 ║
// ║    2) IMG_URL  (URL pública/legado)                                       ║
// ║    3) Fallback por SKU: /public/imagens/<SKU>.(png/jpg/jpeg/webp)         ║
// ║    4) Fallback remoto: DEFAULT_REMOTE_BASE_URL + prefix/sku.ext           ║
// ║                                                                            ║
// ║ ✅ FIX: PDFKit não renderiza WEBP/GIF/SVG → converte → PNG (sharp)        ║
// ║ ✅ FIX: Coluna "Total" não estoura (clamp no final da tabela)             ║
// ║ ✅ ESM: __dirname + DEFAULT_REMOTE_BASE_URL (igual budgets)               ║
// ║                                                                            ║
// ║ Export: generateMobilizedPdf({ mobilized, items, company, apiBase })      ║
// ║   -> Promise<Buffer>                                                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ──────────────────────────────────────────────────────────────
   Helpers (ESM __dirname) + Remote base default (igual budgets)
────────────────────────────────────────────────────────────── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base padrão para imagens remotas (GCS público)
// Ex: https://storage.googleapis.com/consart-erp
const DEFAULT_REMOTE_BASE_URL =
  process.env.GCS_PUBLIC_BASE_URL || 'https://storage.googleapis.com/consart-erp';

/* ──────────────────────────────────────────────────────────────
   Utils
────────────────────────────────────────────────────────────── */
const DEBUG = String(process.env.PDF_DEBUG || '').trim() === '1';

function dbg(...args) {
  if (DEBUG) console.log('[MOBILIZED_PDF]', ...args);
}

function safeStr(v, max = 5000) {
  return String(v ?? '').trim().slice(0, max);
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTimeBR(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function sumItemsTotal(items = []) {
  return items.reduce((acc, it) => acc + toNumber(it.total_value), 0);
}

function buildBufferFromDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/* ──────────────────────────────────────────────────────────────
   Notes helpers (IMG_PATH / IMG_URL) + clean notes
────────────────────────────────────────────────────────────── */
function extractImgPathFromNotes(notes) {
  const s = String(notes || '');
  const m = s.match(/(?:^|\n)\s*IMG_PATH:\s*([^\s]+)\s*(?:$|\n)/i);
  return m ? m[1].trim() : null;
}

function extractImgUrlFromNotes(notes) {
  const s = String(notes || '');
  const m = s.match(/(?:^|\n)\s*IMG_URL:\s*(\S+)\s*(?:$|\n)/i);
  return m ? m[1].trim() : null;
}

function cleanNotesForDisplay(notes) {
  if (!notes) return '';
  const lines = String(notes)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^IMG_PATH\s*:/i.test(l))
    .filter((l) => !/^IMG_URL\s*:/i.test(l));
  return lines.join(' • ').trim();
}

/**
 * Normaliza key para o endpoint /api/gcs/images/signed-url
 * - remove querystring
 * - remove gs://bucket/
 * - remove barras iniciais
 */
function normalizeKeyForSignedUrl(key) {
  if (!key) return '';
  let k = String(key).trim();
  k = k.split('?')[0];
  k = k.replace(/^gs:\/\/[^/]+\/+/i, '');
  k = k.replace(/^\/+/, '');
  return k;
}

/* ──────────────────────────────────────────────────────────────
   Buffer loaders (local + http)
────────────────────────────────────────────────────────────── */
function localBufferIfExists(absPath) {
  try {
    if (absPath && fs.existsSync(absPath)) return fs.readFileSync(absPath);
  } catch {}
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

async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    const txt = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  } finally {
    clearTimeout(t);
  }
}

/* ──────────────────────────────────────────────────────────────
   Image decoding / conversion (WEBP/GIF/SVG → PNG)
────────────────────────────────────────────────────────────── */
function sniffImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;

  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';

  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'gif';

  const head = buf.toString('utf8', 0, Math.min(buf.length, 200)).trim();
  if (head.startsWith('<svg') || head.startsWith('<?xml') || head.includes('<svg')) return 'svg';

  return null;
}

async function convertToPngIfNeeded(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;

  const type = sniffImageType(buffer);
  if (type === 'png' || type === 'jpg') return buffer;

  if (type === 'webp' || type === 'gif' || type === 'svg') {
    try {
      const mod = await import('sharp');
      const sharp = mod?.default || mod;
      return await sharp(buffer).png({ quality: 90 }).toBuffer();
    } catch (e) {
      dbg('sharp convert failed (install sharp?)', e?.message || e);
      return null;
    }
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Image resolver (local + url + remote)
────────────────────────────────────────────────────────────── */
function skuLocalCandidates(imagesDir, sku) {
  const s = String(sku || '').trim();
  if (!s) return [];
  return [
    path.resolve(imagesDir, `${s}.png`),
    path.resolve(imagesDir, `${s}.jpg`),
    path.resolve(imagesDir, `${s}.jpeg`),
    path.resolve(imagesDir, `${s}.webp`),
  ];
}

function skuRemoteCandidates(remoteBase, sku, prefix = '') {
  const s = String(sku || '').trim();
  if (!s || !remoteBase) return [];
  const base = String(remoteBase).replace(/\/+$/, '');
  const pref = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const p = pref ? `${pref}/` : '';
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  return exts.map((ext) => `${base}/${p}${encodeURIComponent(s)}.${ext}`);
}

async function resolveMobilizedItemImageBuffer(
  item,
  { apiBase = '', imagesDir, remoteImagesBaseUrl, remoteSkuPrefix = '' } = {}
) {
  const base = String(apiBase || '').replace(/\/+$/, '');
  const notes = item?.notes;

  // 1) IMG_PATH signed-url
  const keyRaw = extractImgPathFromNotes(notes);
  if (keyRaw && base) {
    const key = normalizeKeyForSignedUrl(keyRaw);
    try {
      const qs = new URLSearchParams({ key });
      const out = await fetchJson(`${base}/api/gcs/images/signed-url?${qs.toString()}`);
      const signed = out?.url || out?.signedUrl || out?.signed_url || null;
      dbg('signed-url resp:', { key, ok: out?.ok, signed: !!signed });
      if (signed) {
        const b = await httpBuffer(signed);
        if (b) return b;
      }
    } catch (e) {
      dbg('signed-url error:', e?.message || e);
    }
  }

  // 2) IMG_URL legacy
  const urlLegacy = extractImgUrlFromNotes(notes);
  if (urlLegacy && /^https?:\/\//i.test(urlLegacy)) {
    const b = await httpBuffer(urlLegacy);
    if (b) return b;
  }

  // 3) local SKU fallback
  const sku = item?.sku;
  if (sku && imagesDir) {
    for (const p of skuLocalCandidates(imagesDir, sku)) {
      const b = localBufferIfExists(p);
      if (b) return b;
    }
  }

  // 4) remote SKU fallback
  if (sku && remoteImagesBaseUrl) {
    const urls = skuRemoteCandidates(remoteImagesBaseUrl, sku, remoteSkuPrefix);
    for (const u of urls) {
      const b = await httpBuffer(u);
      if (b) return b;
    }
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────
   PDF Layout helpers
────────────────────────────────────────────────────────────── */
function drawHeader(doc, { mobilized, company }) {
  const pageWidth = doc.page.width;
  const { left, right } = doc.page.margins;

  const title = safeStr(mobilized?.title, 180) || `MOBILIZADO #${mobilized?.mobilized_id ?? ''}`;
  const status = safeStr(mobilized?.status, 20) || '';
  const acquired = formatDateTimeBR(mobilized?.acquired_at);
  const externalRef = safeStr(mobilized?.external_ref, 80);
  const sourceSystem = safeStr(mobilized?.source_system, 60);

  doc.save().rect(0, 0, pageWidth, 72).fill('#F2F4F7').restore();

  const companyName = safeStr(company?.name || company?.razao_social || company?.nome_fantasia, 120);
  const companyCnpj = safeStr(company?.cnpj, 30);

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#111827')
    .text(title, left, 18, { width: pageWidth - left - right });

  doc.font('Helvetica').fontSize(9).fillColor('#374151');

  const line2 = [];
  if (companyName) line2.push(companyName);
  if (companyCnpj) line2.push(`CNPJ: ${companyCnpj}`);
  if (line2.length) doc.text(line2.join(' • '), left, 38, { width: pageWidth - left - right });

  const meta = [
    status ? `Status: ${status}` : null,
    acquired ? `Aquisição: ${acquired}` : null,
    sourceSystem ? `Origem: ${sourceSystem}` : null,
    externalRef ? `Ref: ${externalRef}` : null,
  ].filter(Boolean);

  doc.text(meta.join(' • '), left, 54, { width: pageWidth - left - right });

  doc.save()
    .moveTo(left, 78)
    .lineTo(pageWidth - right, 78)
    .lineWidth(1)
    .strokeColor('#E5E7EB')
    .stroke()
    .restore();

  const notes = safeStr(mobilized?.notes, 2000);
  if (notes) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Observações', left, 90);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#374151')
      .text(notes, left, 104, { width: pageWidth - left - right });

    return Math.max(doc.y + 8, 130);
  }

  return 96;
}

function drawTableHeader(doc, x, y, cols) {
  doc.save().rect(x, y, cols.totalWidth, cols.headerHeight).fill('#111827').restore();

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
  const padY = 6;

  doc.text('Img', cols.img.x, y + padY, { width: cols.img.w, align: 'center' });
  doc.text('SKU', cols.sku.x, y + padY, { width: cols.sku.w, align: 'left' });
  doc.text('Descrição', cols.desc.x, y + padY, { width: cols.desc.w, align: 'left' });
  doc.text('Qtd', cols.qty.x, y + padY, { width: cols.qty.w, align: 'right' });
  doc.text('Un.', cols.unit.x, y + padY, { width: cols.unit.w, align: 'left' });
  doc.text('Unitário', cols.unitPrice.x, y + padY, { width: cols.unitPrice.w, align: 'right' });
  doc.text('Total', cols.total.x, y + padY, { width: cols.total.w, align: 'right' });

  doc.save()
    .moveTo(x, y + cols.headerHeight)
    .lineTo(x + cols.totalWidth, y + cols.headerHeight)
    .lineWidth(1)
    .strokeColor('#E5E7EB')
    .stroke()
    .restore();

  return y + cols.headerHeight;
}

function ensureSpace(doc, neededHeight, onNewPage) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
    if (typeof onNewPage === 'function') onNewPage();
  }
}

/** "contain" thumbnail */
function drawImageContain(doc, imgObjOrBuffer, x, y, w, h) {
  if (!imgObjOrBuffer) return;

  let img;
  try {
    img = Buffer.isBuffer(imgObjOrBuffer) ? doc.openImage(imgObjOrBuffer) : imgObjOrBuffer;
  } catch {
    return;
  }

  const iw = img.width || 1;
  const ih = img.height || 1;

  const scale = Math.min(w / iw, h / ih);
  const sw = iw * scale;
  const sh = ih * scale;

  const ox = x + (w - sw) / 2;
  const oy = y + (h - sh) / 2;

  doc.image(img, ox, oy, { width: sw, height: sh });
}

/**
 * Build description + extras
 */
function computeDescBlockLines(item) {
  const baseDesc = safeStr(item?.description, 1200);
  const extras = [];

  const model = safeStr(item?.model, 120);
  const sn = safeStr(item?.serial_number, 120);
  const nfe = safeStr(item?.nfe_ref, 120);
  const obs = safeStr(cleanNotesForDisplay(item?.notes), 260);

  if (model) extras.push(`MODELO: ${model}`);
  if (sn) extras.push(`S/N: ${sn}`);
  if (nfe) extras.push(`NF-e: ${nfe}`);
  if (obs) extras.push(`OBS: ${obs}`);

  return { baseDesc, extras };
}

function estimateRowHeightFromText({ baseDesc, extras }) {
  const baseLines = Math.min(5, Math.max(1, Math.ceil(String(baseDesc || '').length / 80)));
  const extraLines = Math.min(8, extras.length); // allows OBS etc

  const rowBaseH = 60;
  const boxesH = 26; // right-side boxes height budget

  return rowBaseH + (baseLines - 1) * 12 + extraLines * 11 + boxesH;
}

function drawRow(doc, item, cols, y, rowH, zebra, imageBuffer) {
  const x = cols.x;

  if (zebra) doc.save().rect(x, y, cols.totalWidth, rowH).fill('#F9FAFB').restore();

  // ─────────────────────────────
  // Thumbnail
  // ─────────────────────────────
  const thumbPad = 4;
  const thumbW = cols.img.w - thumbPad * 2;
  const thumbH = Math.min(rowH - 10, 72);
  const thumbX = cols.img.x + thumbPad;
  const thumbY = y + (rowH - thumbH) / 2;

  doc.save()
    .rect(thumbX, thumbY, thumbW, thumbH)
    .fill('#FFFFFF')
    .lineWidth(0.8)
    .strokeColor('#E5E7EB')
    .stroke()
    .restore();

  if (imageBuffer) {
    drawImageContain(doc, imageBuffer, thumbX, thumbY, thumbW, thumbH);
  } else {
    doc.fontSize(7).fillColor('#9CA3AF');
    doc.text('img', thumbX, thumbY + thumbH / 2 - 4, { width: thumbW, align: 'center' });
  }

  // ─────────────────────────────
  // SKU + Description + Extras
  // ─────────────────────────────
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
  doc.text(item.sku ?? '', cols.sku.x, y + 6);

  const { baseDesc, extras } = computeDescBlockLines(item);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
  doc.text(baseDesc || '', cols.desc.x, y + 6, { width: cols.desc.w });

  let descEndY = doc.y;

  if (extras.length) {
    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    for (const line of extras) {
      doc.text(line, cols.desc.x, descEndY + 2, { width: cols.desc.w });
      descEndY = doc.y;
    }
  }

  // ─────────────────────────────
  // Numbers (top line)
  // ─────────────────────────────
  doc.font('Helvetica').fontSize(9).fillColor('#111827');

  doc.text(
    toNumber(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 4 }),
    cols.qty.x,
    y + 6,
    { width: cols.qty.w, align: 'right' }
  );

  doc.text(item.unit ?? '', cols.unit.x, y + 6);

  doc.text(
    item.unit_price != null ? formatBRL(item.unit_price) : '',
    cols.unitPrice.x,
    y + 6,
    { width: cols.unitPrice.w, align: 'right' }
  );

  doc.text(
    item.total_value != null ? formatBRL(item.total_value) : '',
    cols.total.x,
    y + 6,
    { width: cols.total.w, align: 'right' }
  );

  // ─────────────────────────────
  // ✅ 3 Right-side boxes (MODELO / S/N / NF-e)
  // ─────────────────────────────
  const model = safeStr(item?.model, 120);
  const sn = safeStr(item?.serial_number, 120);
  const nfe = safeStr(item?.nfe_ref, 120);

  // boxes inside row:
  const boxesTop = y + 30;
  const boxH = 18;
  const padX = 6;

  // Box 1 uses "qty + unit" area
  const box1X = cols.qty.x;
  const box1W = cols.qty.w + cols.unit.w;

  // Box 2 uses "unitPrice"
  const box2X = cols.unitPrice.x;
  const box2W = cols.unitPrice.w;

  // Box 3 uses "total"
  const box3X = cols.total.x;
  const box3W = cols.total.w;

  function drawInfoBox(label, value, bx, bw) {
    doc.save()
      .rect(bx + 2, boxesTop, bw - 4, boxH)
      .lineWidth(1)
      .strokeColor('#EF4444')
      .stroke()
      .restore();

    doc.font('Helvetica').fontSize(7).fillColor('#6B7280');
    doc.text(label, bx + padX, boxesTop + 3, { width: bw - padX * 2 });

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827');
    doc.text(value || '-', bx + padX, boxesTop + 10, {
      width: bw - padX * 2,
      ellipsis: true,
    });
  }

  drawInfoBox('MODELO', model, box1X, box1W);
  drawInfoBox('S/N', sn, box2X, box2W);
  drawInfoBox('NF-e', nfe, box3X, box3W);

  // ─────────────────────────────
  // Row separator
  // ─────────────────────────────
  doc
    .moveTo(x, y + rowH)
    .lineTo(x + cols.totalWidth, y + rowH)
    .strokeColor('#E5E7EB')
    .stroke();

  return y + rowH;
}

/* ──────────────────────────────────────────────────────────────
   Main
────────────────────────────────────────────────────────────── */
export async function generateMobilizedPdf({
  mobilized,
  items = [],
  company = null,
  apiBase = '',

  imagesDir = path.resolve(__dirname, '../public/imagens'),
  remoteImagesBaseUrl = DEFAULT_REMOTE_BASE_URL,
  remoteSkuPrefix = '',
} = {}) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, left: 36, right: 36, bottom: 36 },
    info: {
      Title: safeStr(mobilized?.title, 180) || `Mobilized ${mobilized?.mobilized_id ?? ''}`,
      Author: safeStr(company?.name || company?.razao_social || 'CONSART ERP', 120),
    },
  });

  const pageWidth = doc.page.width;
  const { left, right } = doc.page.margins;
  const usableW = pageWidth - left - right;

  const cols = {
    x: left,
    totalWidth: usableW,
    headerHeight: 24,

    img: { x: left, w: 100 },

    sku: { x: 0, w: 0 },
    desc: { x: 0, w: 0 },
    qty: { x: 0, w: 0 },
    unit: { x: 0, w: 0 },
    unitPrice: { x: 0, w: 0 },
    total: { x: 0, w: 0 },
  };

  const restW = usableW - cols.img.w;

  // fixed widths (stable)
  cols.sku.w = 90;
  cols.qty.w = 80;
  cols.unit.w = 55;
  cols.unitPrice.w = 110;
  cols.total.w = 110;

  const usedFixed = cols.sku.w + cols.qty.w + cols.unit.w + cols.unitPrice.w + cols.total.w;
  cols.desc.w = Math.max(240, restW - usedFixed);

  const overflow = usedFixed + cols.desc.w - restW;
  if (overflow > 0) cols.sku.w = Math.max(70, cols.sku.w - overflow);

  // X positions
  cols.sku.x = cols.img.x + cols.img.w;
  cols.desc.x = cols.sku.x + cols.sku.w;
  cols.qty.x = cols.desc.x + cols.desc.w;
  cols.unit.x = cols.qty.x + cols.qty.w;
  cols.unitPrice.x = cols.unit.x + cols.unit.w;
  cols.total.x = cols.unitPrice.x + cols.unitPrice.w;

  // ✅ FINAL ALIGNMENT (fix "Total" overflow)
  const tableRight = cols.x + cols.totalWidth;
  const totalRight = cols.total.x + cols.total.w;
  const drift = totalRight - tableRight;

  if (drift > 0) {
    cols.total.w = Math.max(80, cols.total.w - drift - 1);
  } else if (drift < -1) {
    cols.desc.w += Math.abs(drift) - 1;
    cols.qty.x = cols.desc.x + cols.desc.w;
    cols.unit.x = cols.qty.x + cols.qty.w;
    cols.unitPrice.x = cols.unit.x + cols.unit.w;
    cols.total.x = cols.unitPrice.x + cols.unitPrice.w;
  }

  // Header
  const startY = drawHeader(doc, { mobilized, company });

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Itens', left, startY + 6);
  doc.y = startY + 22;

  // Table header
  const tableHeaderY = doc.y;
  drawTableHeader(doc, cols.x, tableHeaderY, cols);
  doc.y = tableHeaderY + cols.headerHeight;

  // Image cache
  const imgCache = new Map();

  async function getImageBufferForItem(item) {
    const key =
      extractImgPathFromNotes(item?.notes) ||
      extractImgUrlFromNotes(item?.notes) ||
      `SKU:${String(item?.sku || '').trim()}`;

    if (imgCache.has(key)) return imgCache.get(key) || null;

    try {
      const rawBuf = await resolveMobilizedItemImageBuffer(item, {
        apiBase,
        imagesDir,
        remoteImagesBaseUrl,
        remoteSkuPrefix,
      });

      if (!rawBuf) {
        imgCache.set(key, null);
        return null;
      }

      const converted = await convertToPngIfNeeded(rawBuf);
      const finalBuf = converted || rawBuf;

      try {
        doc.openImage(finalBuf);
        imgCache.set(key, finalBuf);
        return finalBuf;
      } catch (e) {
        dbg('doc.openImage failed:', e?.message || e);
        imgCache.set(key, null);
        return null;
      }
    } catch (e) {
      dbg('getImageBufferForItem error:', e?.message || e);
      imgCache.set(key, null);
      return null;
    }
  }

  // Rows
  for (let i = 0; i < items.length; i++) {
    const rowItem = items[i];

    const descPack = computeDescBlockLines(rowItem);
    const rowH = estimateRowHeightFromText(descPack);

    ensureSpace(doc, rowH + 80, () => {
      drawTableHeader(doc, cols.x, doc.page.margins.top, cols);
      doc.y = doc.page.margins.top + cols.headerHeight;
    });

    const zebra = i % 2 === 1;
    const imageBuffer = await getImageBufferForItem(rowItem);

    doc.y = drawRow(doc, rowItem, cols, doc.y, rowH, zebra, imageBuffer);
  }

// Totals
ensureSpace(doc, 90, () => {
  doc.y = doc.page.margins.top;
});

const totalAll = sumItemsTotal(items);

doc.y += 12;
doc.save()
  .moveTo(left, doc.y)
  .lineTo(pageWidth - right, doc.y)
  .lineWidth(1)
  .strokeColor('#E5E7EB')
  .stroke()
  .restore();

doc.y += 12;

const yLine = doc.y;

doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');

// ✅ value (right)
doc.text(formatBRL(totalAll), pageWidth - right - 220, yLine, { width: 220, align: 'right' });

// move cursor below
doc.y = yLine + 16;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827');
  doc.text('Total do mobilizado', left, doc.y, { continued: true });
  doc.text(formatBRL(totalAll), pageWidth - right - 200, doc.y, { width: 200, align: 'right' });

  // Footer
  const footerText = `Gerado em ${formatDateTimeBR(new Date())} • CONSART ERP`;
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280');

  const footerY = doc.page.height - doc.page.margins.bottom + 12;
  doc.text(footerText, left, footerY, { width: usableW, align: 'center' });

  return buildBufferFromDoc(doc);
}

export default { generateMobilizedPdf };