// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ generationCustomersExcel.js — Exportação de Clientes em XLSX (CONSART ERP)║
// ║ Local: backend/generationExcel/generationCustomersExcel.js              ║
// ║ ✅ Agora exibe NOME do vendedor (seller_name)                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

/**
 * Resolve o "nome do vendedor" de forma padronizada:
 * - Prioriza seller_name (JOIN no customersApi.list)
 * - Se vier só seller_id, cai pro "#id" (fallback)
 */
function resolveSellerName(row) {
  const name =
    row?.seller_name ??
    row?.salesperson_name ??
    row?.vendedor_nome ??
    row?.sellerNickname ??
    row?.nickname ??
    row?.salesperson ??
    row?.vendedor ??
    null;

  if (name != null && String(name).trim() !== '') return String(name).trim();

  const sellerId = row?.seller_id ?? row?.salesperson_id ?? row?.vendedor_id ?? null;
  if (sellerId != null && String(sellerId).trim() !== '') return String(sellerId).trim(); // ✅ se quiser "#3", troque aqui

  return '';
}

export async function generateCustomersExcel({ rows = [], filters = {}, res }) {
  try {
    const fileName = `clientes_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clientes');

    ws.columns = [
      { header: 'ID',            key: 'id',               width: 10 },
      { header: 'Nome Fantasia', key: 'trade_name',       width: 32 },
      { header: 'Razão Social',  key: 'legal_name',       width: 36 },
      { header: 'CNPJ/CPF',      key: 'tax_id',           width: 18 },
      { header: 'Segmento',      key: 'business_segment', width: 18 },
      { header: 'Classificação', key: 'classification',   width: 16 },
      { header: 'Vendedor',      key: 'salesperson',      width: 22 },
      { header: 'E-mail',        key: 'email',            width: 28 },
      { header: 'Contato',       key: 'contact_name',     width: 18 },
      { header: 'Telefone',      key: 'phone_number',     width: 16 },
      { header: 'Celular',       key: 'mobile_number',    width: 16 },
      { header: 'Cidade',        key: 'city',             width: 18 },
      { header: 'UF',            key: 'state',            width: 6  },
      { header: 'Ativo',         key: 'is_active',        width: 10 },
      { header: 'Asaas',         key: 'asaas_id',         width: 18 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;

    for (const r of rows) {
      const id        = r.customer_id ?? r.id ?? '';
      const tradeName = r.trade_name ?? r.nome_fantasia ?? '';
      const legalName = r.legal_name ?? r.razao_social ?? '';
      const taxId     = r.tax_id ?? r.cnpj_cpf ?? '';
      const segment =
      r.business_segment_name ??
      r.segment_name ??
      r.segmento_nome ??
      r.business_segment ??
      r.segmento ??
      '';
      const classif   = r.classification ?? r.status ?? '';
      const seller    = resolveSellerName(r);

      const email     = r.email ?? '';
      const contact   = r.contact_name ?? '';
      const phone     = r.phone_number ?? r.telefone ?? '';
      const mobile    = r.mobile_number ?? '';
      const city      = r.city ?? r.cidade ?? '';
      const state     = r.state ?? r.uf ?? '';

      const isActive =
        typeof r.is_active === 'boolean'
          ? (r.is_active ? 'Sim' : 'Não')
          : (typeof r.ativo === 'boolean'
              ? (r.ativo ? 'Sim' : 'Não')
              : (r.is_active ?? r.ativo ?? ''));

      const asaasId = r.asaas_id ?? '';

      const row = ws.addRow({
        id,
        trade_name: tradeName,
        legal_name: legalName,
        tax_id: taxId,
        business_segment: segment,
        classification: classif,
        salesperson: seller,
        email,
        contact_name: contact,
        phone_number: phone,
        mobile_number: mobile,
        city,
        state,
        is_active: isActive,
        asaas_id: asaasId,
      });

      row.getCell('id').alignment        = { horizontal: 'center' };
      row.getCell('tax_id').alignment    = { horizontal: 'center' };
      row.getCell('state').alignment     = { horizontal: 'center' };
      row.getCell('is_active').alignment = { horizontal: 'center' };
      row.getCell('asaas_id').alignment  = { horizontal: 'center' };
    }

    const lastRow = ws.lastRow?.number || 1;

    const colId = ws.getColumn('id');
    colId.eachCell((cell, rowNumber) => {
      if (rowNumber === 1) return;
      cell.font = { ...(cell.font || {}), bold: true };
      cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
    });

    for (let r = 1; r <= lastRow; r++) {
      const row = ws.getRow(r);

      row.eachCell((cell) => {
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });

      if (r >= 2 && r % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    }

    ws.autoFilter = { from: 'A1', to: 'O1' };
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    for (let r = 2; r <= lastRow; r++) ws.getRow(r).height = 18;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[customers][generateCustomersExcel] error:', err);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: 'Falha ao exportar clientes.',
        details: err.message,
      });
      return;
    }

    try { res.end(); } catch {}
  }
}

export default generateCustomersExcel;
