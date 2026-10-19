// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🏬 productsStockController.js — Controller Express                      ║
// ║ CONSART ERP | ESM                                                       ║
// ║ ✅ CRUD Estoque Min./Máx.                                               ║
// ║ ✅ Busca digitada por produto/SKU                                       ║
// ║ ✅ Filtros grupo/subgrupo/fabricante                                    ║
// ║ ✅ PDF Sugestão de Compra                                               ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';

import productsStockApi from '../repositories/productsStock/productsStock.manager.js';

export async function filterOptions(req, res) {
  try {
    const data = await productsStockApi.filterOptions();
    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

const ok = (res, data, code = 200) => res.status(code).json(data);

const fail = (res, err, code = 400) => {
  console.error('[productsStockController]', err);
  return res.status(code).json({
    ok: false,
    error: err?.message || 'Erro interno',
  });
};

function moneyNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(v) {
  return moneyNum(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function safe(v, fallback = '-') {
  return v === null || v === undefined || v === '' ? fallback : String(v);
}

export async function ensure(req, res) {
  try {
    const r = await productsStockApi.ensureTable();
    return ok(res, r);
  } catch (err) {
    return fail(res, err);
  }
}

export async function list(req, res) {
  try {
    const data = await productsStockApi.list({
      limit: req.query.limit,
      offset: req.query.offset,
      status: req.query.status,
      q: req.query.q,
      group_id: req.query.group_id,
      subgroup_id: req.query.subgroup_id,
      manufacturer_id: req.query.manufacturer_id,
      order: req.query.order,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function getByCode(req, res) {
  try {
    const productCode = String(
      req.params?.product_code ??
      req.query?.product_code ??
      ''
    ).trim();

    if (!productCode) {
      return ok(
        res,
        {
          ok: false,
          error: 'product_code é obrigatório',
        },
        400,
      );
    }

    const data =
      await productsStockApi.getByProductCode(productCode);

    if (!data) {
      return ok(
        res,
        {
          ok: false,
          error: `Estoque não encontrado para o SKU ${productCode}`,
        },
        404,
      );
    }

    const returnedCode = String(
      data.product_code ?? ''
    ).trim();

    if (
      returnedCode &&
      returnedCode !== productCode
    ) {
      console.error(
        '[productsStockController][getByCode] SKU inconsistente',
        {
          requestedProductCode: productCode,
          returnedProductCode: returnedCode,
          productStockId: data.product_stock_id,
        },
      );

      return ok(
        res,
        {
          ok: false,
          error:
            `Estoque inconsistente: solicitado SKU ${productCode}, ` +
            `mas encontrado SKU ${returnedCode}.`,
        },
        409,
      );
    }

    return ok(res, {
      ok: true,
      data,
    });
  } catch (err) {
    return fail(res, err);
  }
}

export async function get(req, res) {
  try {
    const data = await productsStockApi.getById(req.params.id);

    if (!data) {
      return ok(res, { ok: false, error: 'Registro não encontrado' }, 404);
    }

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function create(req, res) {
  try {
    const data = await productsStockApi.create(req.body || {});
    return ok(res, data, 201);
  } catch (err) {
    return fail(res, err);
  }
}

export async function update(req, res) {
  try {
    const data = await productsStockApi.update(req.params.id, req.body || {});

    if (!data) {
      return ok(res, { ok: false, error: 'Registro não encontrado' }, 404);
    }

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function adjust(req, res) {
  try {
    const data = await productsStockApi.adjust(req.params.id, req.body?.delta);

    if (!data) {
      return ok(res, { ok: false, error: 'Registro não encontrado' }, 404);
    }

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function remove(req, res) {
  try {
    const data = await productsStockApi.remove(req.params.id);

    if (!data) {
      return ok(res, { ok: false, error: 'Registro não encontrado' }, 404);
    }

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function purchaseSuggestionPdf(req, res) {
  try {
    const rows = await productsStockApi.listPurchaseSuggestion({
      q: req.query.q,
      group_id: req.query.group_id,
      subgroup_id: req.query.subgroup_id,
      manufacturer_id: req.query.manufacturer_id,
    });

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 28,
      bufferPages: true,
    });

    const filename = `sugestao_de_compra_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    const pageW = doc.page.width;
    const left = 28;
    let y = 28;

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('SUGESTÃO DE COMPRA', left, y);

    y += 22;

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, left, y)
      .text(`Total de itens sugeridos: ${rows.length}`, left + 260, y);

    y += 24;

    const cols = {
      sku: left,
      desc: left + 75,
      grupo: left + 330,
      atual: left + 500,
      min: left + 570,
      max: left + 640,
      sug: left + 710,
    };

    function header() {
      doc
        .rect(left, y, pageW - 56, 18)
        .fill('#f1f5f9')
        .stroke('#d8dee9');

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);

      doc.text('SKU', cols.sku, y + 5, { width: 65 });
      doc.text('Produto', cols.desc, y + 5, { width: 240 });
      doc.text('Grupo', cols.grupo, y + 5, { width: 150 });
      doc.text('Atual', cols.atual, y + 5, { width: 60, align: 'right' });
      doc.text('Mín.', cols.min, y + 5, { width: 60, align: 'right' });
      doc.text('Máx.', cols.max, y + 5, { width: 60, align: 'right' });
      doc.text('Comprar', cols.sug, y + 5, { width: 65, align: 'right' });

      y += 20;
    }

    header();

    let totalSuggestion = 0;

    rows.forEach((r, index) => {
      const suggestion = Math.max(0, moneyNum(r.stock_max) - moneyNum(r.stock_qty));
      totalSuggestion += suggestion;

      if (y > doc.page.height - 55) {
        doc.addPage();
        y = 28;
        header();
      }

      if (index % 2 === 0) {
        doc.rect(left, y - 2, pageW - 56, 18).fill('#fbfbfb');
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(7.5);

      doc.text(safe(r.product_code), cols.sku, y + 2, { width: 65 });
      doc.text(safe(r.product_description), cols.desc, y + 2, { width: 240, ellipsis: true });
      doc.text(safe(r.product_group_name), cols.grupo, y + 2, { width: 150, ellipsis: true });
      doc.text(fmtQty(r.stock_qty), cols.atual, y + 2, { width: 60, align: 'right' });
      doc.text(fmtQty(r.stock_min), cols.min, y + 2, { width: 60, align: 'right' });
      doc.text(fmtQty(r.stock_max), cols.max, y + 2, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').text(fmtQty(suggestion), cols.sug, y + 2, {
        width: 65,
        align: 'right',
      });

      y += 18;
    });

    y += 10;

    if (y > doc.page.height - 45) {
      doc.addPage();
      y = 28;
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(`Total sugerido: ${fmtQty(totalSuggestion)}`, left, y);

    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(
          `Página ${i + 1} de ${range.count}`,
          left,
          doc.page.height - 20,
          { width: pageW - 56, align: 'right' }
        );
    }

    doc.end();
  } catch (err) {
    return fail(res, err, 500);
  }
}

export default {
  ensure,
  list,
  getByCode,
  get,
  create,
  update,
  adjust,
  remove,
  purchaseSuggestionPdf,
  filterOptions,
};