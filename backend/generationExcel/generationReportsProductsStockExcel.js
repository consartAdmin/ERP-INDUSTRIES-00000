// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationReportsProductsStockExcel.js                        ║
// ║ MODULE: Excel - Relatório de Posição de Estoque                      ║
// ║ CONSART ERP                                                         ║
// ║ ✔ Geração completa de Excel (.xlsx)                                  ║
// ║ ✔ Cabeçalho estilizado                                               ║
// ║ ✔ Coluna Localização                                                 ║
// ║ ✔ Auto width + formatação monetária                                  ║
// ║ ✔ Totalização                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import { resolveUseProductLocations } from '../repositories/productsLocations/productsLocations.index.js';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const str = String(value).trim();

  // Brazilian format: 1.234,56
  if (str.includes(',') && str.includes('.')) {
    const n = Number(str.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  // Brazilian decimal only: 1234,56
  if (str.includes(',')) {
    const n = Number(str.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }

  // PostgreSQL numeric usually arrives like: 2.44 / 1286.00
  const n = Number(str);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getLocation(item = {}) {
  return cleanText(
    item.localizacao ??
    item.localização ??
    item.location ??
    item.localizacao_produto ??
    item.product_location ??
    item.productLocation ??
    ''
  );
}

/**
 * Gera Excel de posição de estoque
 * @param {Array} data
 * @param {Object} filters
 * @param {Response} res Express Response
 */
export async function generateReportsProductsStockExcel(data = [], filters = {}, res) {
  try {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'CONSART ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Posição de Estoque', {
      views: [{ state: 'frozen', ySplit: 3 }],
    });

    /* =========================================================
     * 🎨 HEADER
     * ========================================================= */
    worksheet.mergeCells('A1:G1');

    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'RELATÓRIO DE POSIÇÃO DE ESTOQUE';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getRow(1).height = 26;
    worksheet.addRow([]);

    /* =========================================================
     * 📊 CABEÇALHO DA TABELA
     * ========================================================= */
    const header = [
      'ID',
      'Código',
      'Descrição',
      'Localização',
      'Custo',
      'Estoque',
      'Total (Custo)',
    ];

    const headerRow = worksheet.addRow(header);
    headerRow.height = 20;

    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    /* =========================================================
     * 📦 DADOS
     * ========================================================= */
    let totalGeral = 0;

    data.forEach((item) => {
      const custo = toNumber(item.custo);
      const estoque = toNumber(item.estoque);
      const total = custo * estoque;

      totalGeral += total;

      const row = worksheet.addRow([
        item.id ?? '',
        cleanText(item.codigo),
        cleanText(item.descricao),
        getLocation(item),
        custo,
        estoque,
        total,
      ]);

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

      row.getCell(5).numFmt = 'R$ #,##0.00';
      row.getCell(6).numFmt = '#,##0.000';
      row.getCell(7).numFmt = 'R$ #,##0.00';
    });

    /* =========================================================
     * 📊 TOTAL
     * ========================================================= */
    worksheet.addRow([]);

    const totalRow = worksheet.addRow([
      '',
      '',
      '',
      '',
      '',
      'TOTAL GERAL:',
      totalGeral,
    ]);

    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    totalRow.getCell(7).font = { bold: true };
    totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(7).numFmt = 'R$ #,##0.00';

    /* =========================================================
     * 📏 LARGURA DAS COLUNAS
     * ========================================================= */
    worksheet.getColumn(1).width = 10;
    worksheet.getColumn(2).width = 16;
    worksheet.getColumn(3).width = 62;
    worksheet.getColumn(4).width = 36;
    // appFeature PRODUCT_LOCATIONS: LOCATIONS_DISABLED → coluna Localização oculta
    worksheet.getColumn(4).hidden = !(await resolveUseProductLocations());
    worksheet.getColumn(5).width = 14;
    worksheet.getColumn(6).width = 14;
    worksheet.getColumn(7).width = 18;

    worksheet.autoFilter = {
      from: 'A3',
      to: 'G3',
    };

    /* =========================================================
     * 📤 DOWNLOAD
     * ========================================================= */
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=relatorio_posicao_estoque_${timestamp}.xlsx`
    );

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('[EXCEL] Erro ao gerar relatório:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        erro: 'Erro ao gerar Excel',
        detalhe: error.message,
      });
    }

    res.end();
  }
}