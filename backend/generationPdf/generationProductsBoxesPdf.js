// ╔══════════════════════════════════════════════════════════════════════╗
// ║ generationProductsBoxesPdf.js — Geração PDF: Caixas de Produtos      ║
// ║ CONSART ERP | ESM                                                    ║
// ║ Path: backend/generationPdf/generationProductsBoxesPdf.js            ║
// ║                                                                      ║
// ║ Gera PDF de:                                                        ║
// ║ 1) Uma Caixa (com itens/SKUs)                                        ║
// ║ 2) Listagem de Caixas (opcional: inclui itens de TODAS as caixas)    ║
// ║                                                                      ║
// ║ Depende:                                                            ║
// ║ - pdfkit                                                            ║
// ║ - backend/services/apis/productsBoxesApis.js                         ║
// ║ - backend/config/db.js                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

import pool from '../config/db.js';
import {
  listBoxes,
  getBoxById,
  listBoxItems,
} from '../repositories/productsBoxes/productsBoxes.index.js';

/* ──────────────────────────────────────────────────────────────
   Paths
────────────────────────────────────────────────────────────── */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeFilePart(v) {
  return String(v ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'arquivo';
}

function getOutDir() {
  // PDFs públicos (para servir via /public/...)
  // backend/public/pdfs/productsBoxes, relativo a este arquivo (não ao cwd)
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfs', 'productsBoxes');
  ensureDir(dir);
  return dir;
}

/* ──────────────────────────────────────────────────────────────
   Helpers (PDF)
────────────────────────────────────────────────────────────── */
function fmtDateTimeBR(d) {
  try {
    return new Date(d).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}

function fmtNum(v, dec = 3) {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dec,
  });
}

function drawHr(doc, y, alpha = 0.18) {
  const x1 = doc.page.margins.left;
  const x2 = doc.page.width - doc.page.margins.right;
  doc.save();
  doc.opacity(alpha);
  doc.moveTo(x1, y).lineTo(x2, y).stroke();
  doc.restore();
}

function newPageIfNeeded(doc, nextBlockHeight = 120) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + nextBlockHeight > bottomLimit) doc.addPage();
}

function writeKeyValue(doc, label, value, { labelW = 120, gap = 8 } = {}) {
  // ✅ garante alinhamento sempre no margin-left
  const x = doc.page.margins.left;
  const y = doc.y;

  doc.fontSize(9).fillColor('#334155').text(label, x, y, { width: labelW });
  doc.fontSize(9).fillColor('#0f172a').text(value ?? '—', x + labelW + gap, y, {
    width: doc.page.width - doc.page.margins.right - (x + labelW + gap),
  });

  doc.moveDown(0.2);
}

function drawHeader(doc, title, subtitle) {
  const x = doc.page.margins.left;

  doc.save();
  doc.rect(0, 0, doc.page.width, 54).fill('#f3f4f6');

  doc.fillColor('#0f172a');
  doc.fontSize(16).text(title, x, 14, { width: doc.page.width - x * 2 });

  doc.fillColor('#475569');
  doc.fontSize(9).text(subtitle, x, 34, { width: doc.page.width - x * 2 });

  doc.restore();
  doc.y = 70;
}

/* ──────────────────────────────────────────────────────────────
   Enriquecimento de SKU -> Descrição/Unidade (fallback)
────────────────────────────────────────────────────────────── */
async function getProductsInfoBySkus(skus = []) {
  const uniq = Array.from(new Set(skus.map((s) => String(s).trim()).filter(Boolean)));
  if (!uniq.length) return new Map();

  try {
    const sql = `
      SELECT
        product_code,
        description,
        unit
      FROM public."products"
      WHERE product_code = ANY($1::text[])
    `;
    const res = await pool.query(sql, [uniq]);
    const map = new Map();
    for (const r of res.rows || []) {
      const key = String(r.product_code ?? '').trim();
      if (!key) continue;
      map.set(key, {
        description: r.description ?? null,
        unit: r.unit ?? null,
      });
    }
    return map;
  } catch {
    // fallback "sku"
    try {
      const sql2 = `
        SELECT
          sku,
          description,
          unit
        FROM public."products"
        WHERE sku = ANY($1::text[])
      `;
      const res2 = await pool.query(sql2, [uniq]);
      const map2 = new Map();
      for (const r of res2.rows || []) {
        const key = String(r.sku ?? '').trim();
        if (!key) continue;
        map2.set(key, {
          description: r.description ?? null,
          unit: r.unit ?? null,
        });
      }
      return map2;
    } catch {
      return new Map();
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   Query única: itens de várias caixas + join products
   (evita N+1 na listagem)
────────────────────────────────────────────────────────────── */
async function getItemsForBoxesWithProducts(boxIds = []) {
  const ids = (boxIds || [])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  if (!ids.length) return new Map();

  // ⚠️ Ajuste de nomes de tabelas/colunas se o seu schema for diferente.
  // Aqui conforme seu SQL: productsBoxes_items + products(product_code)
  const sql = `
    SELECT
      i.box_id,
      i.sku,
      i.quantity,
      i.unit,
      i.notes,
      p.description
    FROM "productsBoxes_items" i
    LEFT JOIN public."products" p
      ON p.product_code = i.sku
    WHERE i.box_id = ANY($1::int[])
    ORDER BY i.box_id, i.sku
  `;

  const res = await pool.query(sql, [ids]);

  const map = new Map(); // box_id -> items[]
  for (const r of res.rows || []) {
    const bid = Number(r.box_id);
    if (!map.has(bid)) map.set(bid, []);
    map.get(bid).push({
      box_id: bid,
      sku: r.sku,
      quantity: r.quantity,
      unit: r.unit,
      notes: r.notes,
      description: r.description, // já vem do JOIN
    });
  }

  return map;
}

/* ──────────────────────────────────────────────────────────────
   Tabela de Itens (SKU)
   - Usa description do item (se vier do join)
   - Se não vier, usa skuInfoMap fallback
────────────────────────────────────────────────────────────── */
function drawItemsTable(doc, items, skuInfoMap) {
  const x0 = doc.page.margins.left;
  const xMax = doc.page.width - doc.page.margins.right;
  const tableW = xMax - x0;

  const colSku = 120;
  const colQtd = 70;
  const colUn  = 60;
  const colObs = 160;
  const colDesc = Math.max(140, tableW - (colSku + colQtd + colUn + colObs));

  const rowH = 18;

  // Header
  doc.save();
  doc.fillColor('#f1f5f9').rect(x0, doc.y, tableW, rowH).fill();
  doc.fillColor('#334155').fontSize(9);

  const yH = doc.y + 5;
  doc.text('SKU', x0 + 6, yH, { width: colSku - 12 });
  doc.text('Descrição', x0 + colSku + 6, yH, { width: colDesc - 12 });
  doc.text('Qtd', x0 + colSku + colDesc + 6, yH, { width: colQtd - 12 });
  doc.text('Unid', x0 + colSku + colDesc + colQtd + 6, yH, { width: colUn - 12 });
  doc.text('Obs', x0 + colSku + colDesc + colQtd + colUn + 6, yH, { width: colObs - 12 });

  doc.restore();
  doc.y += rowH;

  if (!items?.length) {
    doc.fillColor('#64748b').fontSize(9).text('Nenhum item cadastrado para esta caixa.', x0, doc.y + 8);
    doc.moveDown(1.2);
    return;
  }

  // Rows
  for (let i = 0; i < items.length; i++) {
    newPageIfNeeded(doc, 70);

    const it = items[i];
    const sku = String(it.sku ?? '').trim();
    const info = skuInfoMap?.get(sku) || null;

    // ✅ prioriza description do JOIN, depois fallback do Map
    const descJoin = String(it.description ?? '').trim();
    const descFallback = String(info?.description ?? '').trim();
    const desc = descJoin || descFallback || '';

    const unit = String(it.unit ?? info?.unit ?? '').trim();
    const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';

    doc.save();
    doc.fillColor(bg).rect(x0, doc.y, tableW, rowH).fill();
    doc.restore();

    doc.fillColor('#0f172a').fontSize(9);
    const y = doc.y + 5;

    doc.text(sku || '—', x0 + 6, y, { width: colSku - 12, ellipsis: true });
    doc.text(desc || '—', x0 + colSku + 6, y, { width: colDesc - 12, ellipsis: true });
    doc.text(fmtNum(it.quantity, 3), x0 + colSku + colDesc + 6, y, { width: colQtd - 12, align: 'right' });
    doc.text(unit || '—', x0 + colSku + colDesc + colQtd + 6, y, { width: colUn - 12, ellipsis: true });
    doc.text(String(it.notes ?? '') || '—', x0 + colSku + colDesc + colQtd + colUn + 6, y, { width: colObs - 12, ellipsis: true });

    doc.y += rowH;
  }

  doc.moveDown(0.8);
}

/* ──────────────────────────────────────────────────────────────
   Render: Box Section (PDF de box único)
────────────────────────────────────────────────────────────── */
async function drawBoxSection(doc, box, { includeItems = true } = {}) {
  const subtitle = `Gerado em: ${fmtDateTimeBR(new Date())}`;
  drawHeader(doc, 'CONSART • Caixas de Produtos', subtitle);

  doc.fillColor('#0f172a').fontSize(13).text(`Caixa #${box.box_id} — ${box.name || ''}`);
  doc.moveDown(0.4);

  doc.fontSize(9).fillColor('#334155');
  drawHr(doc, doc.y + 6);
  doc.moveDown(0.6);

  writeKeyValue(doc, 'Código:', box.code || '—');
  writeKeyValue(doc, 'Tipo:', box.box_type || '—');
  writeKeyValue(doc, 'Localização:', box.location || '—');
  writeKeyValue(doc, 'Status:', box.active ? 'Ativo' : 'Inativo');
  writeKeyValue(doc, 'Dimensões (cm):', `${fmtNum(box.length_cm, 2)} × ${fmtNum(box.width_cm, 2)} × ${fmtNum(box.height_cm, 2)}`);
  writeKeyValue(doc, 'Peso máx (kg):', fmtNum(box.max_weight_kg, 3) || '—');
  writeKeyValue(doc, 'Volume máx (cm³):', fmtNum(box.max_volume_cm3, 2) || '—');
  writeKeyValue(doc, 'Obs:', box.notes || '—');
  writeKeyValue(doc, 'Criado:', fmtDateTimeBR(box.created_at));
  writeKeyValue(doc, 'Atualizado:', fmtDateTimeBR(box.updated_at));

  doc.moveDown(0.8);
  drawHr(doc, doc.y + 6);
  doc.moveDown(0.8);

  if (!includeItems) return;

  doc.fillColor('#0f172a').fontSize(12).text('Itens da Caixa (SKUs)');
  doc.moveDown(0.5);

  // ✅ Para box único pode manter listBoxItems, mas enriquece de forma segura
  const items = await listBoxItems(box.box_id);
  const skus = items.map((i) => i.sku);
  const skuInfoMap = await getProductsInfoBySkus(skus);

  drawItemsTable(doc, items, skuInfoMap);
}

/* ──────────────────────────────────────────────────────────────
   API Principal: gerar PDF (Box único ou lista)
────────────────────────────────────────────────────────────── */
export async function generateProductsBoxesPdf({
  box_id = null,

  // se não vier box_id, gera listagem:
  q = null,
  active = 'true',
  orderBy = 'created_at DESC',
  page = 1,
  pageSize = 200,

  includeItems = true,
} = {}) {
  const outDir = getOutDir();

  // Nome do arquivo
  const ts = new Date();
  const stamp = [
    ts.getFullYear(),
    String(ts.getMonth() + 1).padStart(2, '0'),
    String(ts.getDate()).padStart(2, '0'),
    '_',
    String(ts.getHours()).padStart(2, '0'),
    String(ts.getMinutes()).padStart(2, '0'),
  ].join('');

  let filename = '';

  /* ────────────────────────────────────────────────────────────
     PDF: BOX ÚNICO
  ──────────────────────────────────────────────────────────── */
  if (box_id) {
    const box = await getBoxById(box_id);
    if (!box) {
      const err = new Error('Box not found');
      err.status = 404;
      throw err;
    }

    filename = `CONSART_BOX_${box.box_id}_${safeFilePart(box.name)}_${stamp}.pdf`;
    const filepath = path.join(outDir, filename);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const stream = fs.createWriteStream(filepath);

      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.on('error', reject);

      doc.pipe(stream);

      (async () => {
        try {
          await drawBoxSection(doc, box, { includeItems });
          doc.end();
        } catch (e) {
          reject(e);
        }
      })();
    });

    return { filename, filepath };
  }

  /* ────────────────────────────────────────────────────────────
     PDF: LISTAGEM (COM/SEM ITENS)
  ──────────────────────────────────────────────────────────── */
  filename = `CONSART_BOXES_LIST_${stamp}.pdf`;
  const filepath = path.join(outDir, filename);

  const result = await listBoxes({
    q,
    active,
    orderBy,
    page,
    pageSize,
  });

  const rows = result?.rows || [];

  // ✅ Se includeItems=true, busca itens de TODAS as caixas em 1 query
  let itemsMap = new Map(); // box_id -> items[]
  let skuFallbackMap = new Map(); // usado só se algum item vier sem description no join

  if (includeItems && rows.length) {
    const boxIds = rows.map((b) => b.box_id);

    // Query única com join products
    itemsMap = await getItemsForBoxesWithProducts(boxIds);

    // fallback map (só se necessário)
    // (pega skus que ficaram sem description no join)
    const skusNeedingFallback = [];
    for (const items of itemsMap.values()) {
      for (const it of items) {
        const hasDesc = String(it.description ?? '').trim();
        if (!hasDesc && it.sku) skusNeedingFallback.push(it.sku);
      }
    }
    skuFallbackMap = await getProductsInfoBySkus(skusNeedingFallback);
  }

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(filepath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);

    (async () => {
      try {
        drawHeader(
          doc,
          'CONSART • Caixas de Produtos',
          `Listagem • Total: ${result?.total ?? 0} • Gerado em: ${fmtDateTimeBR(new Date())}`
        );

        doc.fillColor('#0f172a').fontSize(12).text('Filtros');
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#334155');
        writeKeyValue(doc, 'Busca (q):', q || '—');
        writeKeyValue(doc, 'Ativo:', active === '' || active == null ? 'Todos' : String(active));
        writeKeyValue(doc, 'Ordenação:', orderBy || '—');
        writeKeyValue(doc, 'Itens:', includeItems ? 'Incluídos (todas as caixas)' : 'Não incluídos');
        doc.moveDown(0.6);
        drawHr(doc, doc.y + 6);
        doc.moveDown(0.8);

        if (!rows.length) {
          doc.fillColor('#64748b').fontSize(10).text('Nenhuma caixa encontrada.');
          doc.end();
          return;
        }

        for (let i = 0; i < rows.length; i++) {
          const box = rows[i];

          // ✅ altura menor para evitar "página quase vazia"
          newPageIfNeeded(doc, includeItems ? 240 : 150);

          doc.fillColor('#0f172a').fontSize(12).text(`Caixa #${box.box_id} — ${box.name || ''}`);
          doc.moveDown(0.25);

          doc.fontSize(9).fillColor('#334155');
          writeKeyValue(doc, 'Código:', box.code || '—');
          writeKeyValue(doc, 'Tipo:', box.box_type || '—');
          writeKeyValue(doc, 'Localização:', box.location || '—');
          writeKeyValue(doc, 'Status:', box.active ? 'Ativo' : 'Inativo');
          writeKeyValue(doc, 'Dimensões (cm):', `${fmtNum(box.length_cm, 2)} × ${fmtNum(box.width_cm, 2)} × ${fmtNum(box.height_cm, 2)}`);
          writeKeyValue(doc, 'Peso máx (kg):', fmtNum(box.max_weight_kg, 3) || '—');
          writeKeyValue(doc, 'Volume máx (cm³):', fmtNum(box.max_volume_cm3, 2) || '—');

          if (includeItems) {
            doc.moveDown(0.2);
            doc.fillColor('#0f172a').fontSize(10).text('Itens (SKUs)');
            doc.moveDown(0.35);

            // ✅ pega do map (query única)
            const items = itemsMap.get(Number(box.box_id)) || [];

            // drawItemsTable usa description do item quando existe
            drawItemsTable(doc, items, skuFallbackMap);
          }

          drawHr(doc, doc.y + 6);
          doc.moveDown(0.8);
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    })();
  });

  return { filename, filepath };
}

/* ──────────────────────────────────────────────────────────────
   (Opcional) Handler Express pronto (retorna JSON com URL pública)
   Use em uma rota do tipo:
   GET /api/products-boxes/pdf?box_id=123&includeItems=true
   GET /api/products-boxes/pdf?q=cx&active=true&includeItems=false
────────────────────────────────────────────────────────────── */
export async function generateProductsBoxesPdfHandler(req, res) {
  try {
    const includeItems = String(req.query.includeItems ?? 'true').toLowerCase() === 'true';

    const { filename, filepath } = await generateProductsBoxesPdf({
      box_id: req.query.box_id || null,
      q: req.query.q || null,
      active: req.query.active ?? 'true',
      orderBy: req.query.orderBy || 'created_at DESC',
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 200),
      includeItems,
    });

    // ✅ backend/public servido em /public
    const publicUrl = `/public/pdfs/productsBoxes/${encodeURIComponent(filename)}`;

    return res.json({
      ok: true,
      filename,
      filepath,
      url: publicUrl,
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    return res.status(status).json({
      ok: false,
      message: err?.message || 'Erro ao gerar PDF',
    });
  }
}
