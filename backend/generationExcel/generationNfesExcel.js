// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ generationNfesExcel.js — Exportação de NF-es em XLSX (CONSART ERP)        ║
// ║ Local: backend/generationExcel/generationNfesExcel.js                      ║
// ║ ✅ Layout profissional com ExcelJS                                         ║
// ║ ✅ Cabeçalho estilizado                                                    ║
// ║ ✅ Zebra nas linhas                                                        ║
// ║ ✅ AutoFilter + Freeze no topo                                             ║
// ║ ✅ Compatível com aliases variados do backend                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function asMoney(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(value) {
  if (!value) return '';

  // Date nativa
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  // Timestamp numérico
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d;
  }

  const raw = String(value).trim();
  if (!raw) return '';

  // Formato dd/mm/yyyy ou dd/mm/yyyy hh:mm:ss
  const brMatch = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (brMatch) {
    const [, dd, mm, yyyy, hh = '00', mi = '00', ss = '00'] = brMatch;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? raw : d;
  }

  // ISO / yyyy-mm-dd / yyyy-mm-ddTHH:mm:ss
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  return raw;
}

function resolvePedido(row) {
  return (
    row?.pedido ??
    row?.order_id ??
    row?.orderId ??
    row?.pedido_id ??
    row?.numero_pedido ??
    row?.n_pedido ??
    row?.id_pedido ??
    ''
  );
}

function resolveEmissao(row) {
  return (
    row?.emissao ??
    row?.issued_at ??
    row?.issuedAt ??
    row?.data_emissao ??
    row?.dhEmi ??
    row?.created_at ??
    row?.createdAt ??
    ''
  );
}

function resolveNumeroNfe(row) {
  return (
    row?.numero_nfe ??
    row?.nfe_number ??
    row?.numero ??
    row?.n_nf ??
    row?.nnf ??
    row?.invoice_number ??
    row?.nfeNumero ??
    ''
  );
}

function resolveChaveAcesso(row) {
  return (
    row?.chave_acesso ??
    row?.access_key ??
    row?.nfe_key ??
    row?.chNFe ??
    row?.chave ??
    row?.key ??
    ''
  );
}

function resolveCliente(row) {
  return (
    row?.cliente ??
    row?.customer_name ??
    row?.customer ??
    row?.nome_cliente ??
    row?.razao_social ??
    row?.nome_fantasia ??
    row?.destinatario ??
    ''
  );
}

function resolveTaxId(row) {
  return (
    row?.cnpj_cpf ??
    row?.tax_id ??
    row?.cpf_cnpj ??
    row?.document ??
    row?.cpf ??
    row?.cnpj ??
    row?.customer_tax_id ??
    ''
  );
}

function resolveTotal(row) {
  return (
    row?.total ??
    row?.total_value ??
    row?.valor_total ??
    row?.v_nf ??
    row?.vnf ??
    row?.amount_total ??
    row?.invoice_total ??
    0
  );
}

function resolveStatus(row) {
  return (
    row?.status_nfe ??
    row?.status ??
    row?.situacao ??
    row?.nfe_status ??
    row?.status_label ??
    row?.status_text ??
    ''
  );
}

function resolveAmbiente(row) {
  const raw =
    row?.ambiente ??
    row?.environment ??
    row?.tpAmb ??
    row?.ambiente_label ??
    row?.environment_label ??
    '';

  const text = String(raw ?? '').trim();
  if (!text) return '';

  if (text === '1') return 'PRODUÇÃO';
  if (text === '2') return 'HOMOLOGAÇÃO';

  const upper = text.toUpperCase();
  if (upper === 'PRODUCAO') return 'PRODUÇÃO';

  return upper;
}

/* ============================================================================
 * MAIN
 * ========================================================================== */

export async function generateNfesExcel({ rows = [], filters = {}, res }) {
  try {
    const fileName = `nfes_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CONSART ERP';
    wb.lastModifiedBy = 'CONSART ERP';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet('NFes');

    ws.columns = [
      { header: 'Pedido',          key: 'pedido',        width: 12 },
      { header: 'Emissão',         key: 'emissao',       width: 20 },
      { header: 'Nº NF-e',         key: 'numero_nfe',    width: 12 },
      { header: 'Chave de Acesso', key: 'chave_acesso',  width: 52 },
      { header: 'Cliente',         key: 'cliente',       width: 36 },
      { header: 'CNPJ/CPF',        key: 'cnpj_cpf',      width: 20 },
      { header: 'Total (R$)',      key: 'total',         width: 14 },
      { header: 'Status NF-e',     key: 'status_nfe',    width: 18 },
      { header: 'Ambiente',        key: 'ambiente',      width: 14 },
    ];

    /* ==========================================================================
     * HEADER
     * ======================================================================== */
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;

    /* ==========================================================================
     * FILTER SUMMARY
     * ======================================================================== */
    if (filters && Object.keys(filters).length > 0) {
      const filterParts = [];

      if (filters.search || filters.q) {
        filterParts.push(`Busca: ${filters.search ?? filters.q}`);
      }
      if (filters.from || filters.dataInicio || filters.startDate) {
        filterParts.push(`De: ${filters.from ?? filters.dataInicio ?? filters.startDate}`);
      }
      if (filters.to || filters.dataFim || filters.endDate) {
        filterParts.push(`Até: ${filters.to ?? filters.dataFim ?? filters.endDate}`);
      }
      if (filters.status) {
        filterParts.push(`Status: ${filters.status}`);
      }
      if (filters.limit || filters.pageSize) {
        filterParts.push(`Mostrar: ${filters.limit ?? filters.pageSize}`);
      }
      if (filters.sortBy) {
        filterParts.push(`Ordenar: ${filters.sortBy}`);
      }
      if (filters.sortOrder) {
        filterParts.push(`Ordem: ${filters.sortOrder}`);
      }

      if (filterParts.length) {
        ws.insertRow(1, [filterParts.join('  |  ')]);
        ws.mergeCells('A1:I1');

        const infoRow = ws.getRow(1);
        infoRow.height = 20;
        infoRow.font = { italic: true, color: { argb: 'FF374151' } };
        infoRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
        infoRow.alignment = { vertical: 'middle', horizontal: 'left' };

        // reaplica estilo do cabeçalho agora na linha 2
        const actualHeaderRow = ws.getRow(2);
        actualHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        actualHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF111827' },
        };
        actualHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        actualHeaderRow.height = 22;
      }
    }

    const headerRowNumber = filters && Object.keys(filters).length > 0 ? 2 : 1;
    const dataStartRow = headerRowNumber + 1;

    /* ==========================================================================
     * DATA
     * ======================================================================== */
    for (const r of rows) {
      const pedido = resolvePedido(r);

      const emissaoRaw = resolveEmissao(r);
      const emissao = normalizeDate(emissaoRaw);

      const numeroNfe = resolveNumeroNfe(r);
      const chaveAcesso = resolveChaveAcesso(r);
      const cliente = resolveCliente(r);

      const taxIdRaw = resolveTaxId(r);
      const taxId = String(taxIdRaw ?? '').trim();

      const total = asMoney(resolveTotal(r));
      const statusNfe = resolveStatus(r);
      const ambiente = resolveAmbiente(r);

      const row = ws.addRow({
        pedido,
        emissao,
        numero_nfe: numeroNfe,
        chave_acesso: chaveAcesso,
        cliente,
        cnpj_cpf: taxId,
        total,
        status_nfe: statusNfe,
        ambiente,
      });

      row.getCell('pedido').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('emissao').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('numero_nfe').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('cnpj_cpf').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('total').alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell('status_nfe').alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell('ambiente').alignment = { horizontal: 'center', vertical: 'middle' };

      // Número formatado
      row.getCell('total').numFmt = '#,##0.00';

      // Data formatada
      if (row.getCell('emissao').value instanceof Date) {
        row.getCell('emissao').numFmt = 'dd/mm/yyyy hh:mm';
      }

      // Chave sempre texto
      row.getCell('chave_acesso').numFmt = '@';

      // Documento sempre texto
      row.getCell('cnpj_cpf').numFmt = '@';
    }

    const lastRow = ws.lastRow?.number || headerRowNumber;

    /* ==========================================================================
     * STYLING / BORDERS / ZEBRA
     * ======================================================================== */
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

      if (r >= dataStartRow && (r - dataStartRow) % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    }

    /* ==========================================================================
     * EMPHASIS
     * ======================================================================== */
    ws.getColumn('pedido').eachCell((cell, rowNumber) => {
      if (rowNumber < dataStartRow) return;
      cell.font = { ...(cell.font || {}), bold: true };
    });

    ws.getColumn('numero_nfe').eachCell((cell, rowNumber) => {
      if (rowNumber < dataStartRow) return;
      cell.font = { ...(cell.font || {}), bold: true };
    });

    ws.getColumn('status_nfe').eachCell((cell, rowNumber) => {
      if (rowNumber < dataStartRow) return;
      cell.font = { ...(cell.font || {}), bold: true };
    });

    /* ==========================================================================
     * AUTO FILTER + FREEZE
     * ======================================================================== */
    ws.autoFilter = {
      from: `A${headerRowNumber}`,
      to: `I${headerRowNumber}`,
    };

    ws.views = [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: headerRowNumber,
      },
    ];

    /* ==========================================================================
     * ROW HEIGHTS
     * ======================================================================== */
    for (let r = dataStartRow; r <= lastRow; r++) {
      ws.getRow(r).height = 18;
    }

    /* ==========================================================================
     * FOOTER SUMMARY
     * ======================================================================== */
    const totalRowNumber = lastRow + 2;
    const totalDocs = rows.length;
    const totalGeral = rows.reduce((acc, item) => acc + asMoney(resolveTotal(item)), 0);

    ws.getCell(`F${totalRowNumber}`).value = 'Quantidade de NF-es:';
    ws.getCell(`G${totalRowNumber}`).value = totalDocs;
    ws.getCell(`H${totalRowNumber}`).value = 'Total Geral (R$):';
    ws.getCell(`I${totalRowNumber}`).value = totalGeral;

    ws.getCell(`F${totalRowNumber}`).font = { bold: true };
    ws.getCell(`G${totalRowNumber}`).font = { bold: true };
    ws.getCell(`H${totalRowNumber}`).font = { bold: true };
    ws.getCell(`I${totalRowNumber}`).font = { bold: true };

    ws.getCell(`G${totalRowNumber}`).alignment = { horizontal: 'center' };
    ws.getCell(`I${totalRowNumber}`).alignment = { horizontal: 'right' };
    ws.getCell(`I${totalRowNumber}`).numFmt = '#,##0.00';

    /* ==========================================================================
     * RESPONSE
     * ======================================================================== */
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[nfes][generateNfesExcel] error:', err);

    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: 'Falha ao exportar relatório de NF-es.',
        details: err.message,
      });
      return;
    }

    try {
      res.end();
    } catch {}
  }
}

export default generateNfesExcel;