// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationManufacturesOrdersExcel.js                          ║
// ║ MODULE: Manufactures Orders                                         ║
// ║ DESCRIPTION: Excel completo - Pedido para Fabricante                 ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';

function safe(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d;
}

function statusLabel(status) {
  const map = {
    OPEN: 'ABERTO',
    IN_PROGRESS: 'EM PRODUÇÃO',
    FINISHED: 'FINALIZADO',
    CANCELLED: 'CANCELADO',
  };

  return map[status] || safe(status);
}

function sanitizeFilename(name = 'pedidos-fabricantes.xlsx') {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcItemsTotal(items = []) {
  return items.reduce((sum, item) => {
    const quantity = toNumber(item.quantity);
    const cost = toNumber(item.cost_price ?? item.cost);
    return sum + quantity * cost;
  }, 0);
}

function setTitle(ws, title, lastCol = 'K') {
  ws.mergeCells(`A1:${lastCol}1`);

  const cell = ws.getCell('A1');
  cell.value = title;
  cell.font = {
    bold: true,
    size: 16,
    color: { argb: 'FFFFFFFF' },
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  ws.getRow(1).height = 28;
}

function styleSectionTitle(row) {
  row.eachCell(cell => {
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };

    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };

    cell.border = borderFull();
  });
}

function styleTableHeader(row) {
  row.eachCell(cell => {
    cell.font = {
      bold: true,
      color: { argb: 'FF0F172A' },
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };

    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    cell.border = borderFull();
  });

  row.height = 24;
}

function borderFull(color = 'FFD9E2EF') {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function styleBodyRow(row, zebra = false) {
  row.eachCell(cell => {
    cell.border = borderFull('FFE5E7EB');
    cell.alignment = {
      vertical: 'middle',
      wrapText: true,
    };

    if (zebra) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
    }
  });
}

function addInfoRow(ws, rowIndex, labelA, valueA, labelB = '', valueB = '') {
  ws.getCell(`A${rowIndex}`).value = labelA;
  ws.getCell(`B${rowIndex}`).value = valueA;
  ws.getCell(`D${rowIndex}`).value = labelB;
  ws.getCell(`E${rowIndex}`).value = valueB;

  ['A', 'D'].forEach(col => {
    const cell = ws.getCell(`${col}${rowIndex}`);
    cell.font = { bold: true, color: { argb: 'FF334155' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = borderFull();
  });

  ['B', 'E'].forEach(col => {
    const cell = ws.getCell(`${col}${rowIndex}`);
    cell.border = borderFull();
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function normalizeOrder(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];

  const totalCost =
    toNumber(order.total_cost) ||
    calcItemsTotal(items);

  return {
    id: order.manufacture_order_id || order.id || order.order_id || '',
    order_number: safe(order.order_number),
    manufacturer_id: safe(order.manufacturer_id),
    manufacturer_name: safe(order.manufacturer_name),
    status: statusLabel(order.status),
    notes: safe(order.notes),
    created_at: toDate(order.created_at),
    updated_at: toDate(order.updated_at),
    items_count: toNumber(order.items_count, items.length) || items.length,
    total_cost: totalCost,
    items,
    raw: order,
  };
}

function normalizeItem(item = {}) {
  const quantity = toNumber(item.quantity);
  const costPrice = toNumber(item.cost_price ?? item.cost);
  const total = quantity * costPrice;

  return {
    manufacture_order_item_id: item.manufacture_order_item_id || item.id || '',
    product_stock_id: item.product_stock_id || '',
    product_id: item.product_id || '',
    product_code: safe(item.product_code || item.sku),
    sku: safe(item.sku || item.product_code),
    description: safe(item.description || item.product_name || item.name),
    unit: safe(item.unit || item.um || item.unidade, 'UN'),
    stock_qty: toNumber(item.stock_qty),
    stock_min: toNumber(item.stock_min),
    stock_max: toNumber(item.stock_max),
    quantity,
    cost_price: costPrice,
    total_item: total,
  };
}

function applyCommonSheetSetup(ws) {
  ws.properties.defaultRowHeight = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function buildResumoSheet(workbook, orders) {
  const ws = workbook.addWorksheet('Resumo');

  ws.columns = [
    { key: 'a', width: 24 },
    { key: 'b', width: 30 },
    { key: 'c', width: 18 },
    { key: 'd', width: 24 },
    { key: 'e', width: 30 },
  ];

  setTitle(ws, 'RESUMO DOS PEDIDOS PARA FABRICANTES', 'E');

  const totalOrders = orders.length;
  const totalItems = orders.reduce((sum, order) => sum + toNumber(order.items_count), 0);
  const totalCost = orders.reduce((sum, order) => sum + toNumber(order.total_cost), 0);
  const openOrders = orders.filter(order => order.status === 'ABERTO').length;

  addInfoRow(ws, 3, 'Total Pedidos', totalOrders, 'Pedidos Abertos', openOrders);
  addInfoRow(ws, 4, 'Total Itens', totalItems, 'Total Custos', totalCost);

  ws.getCell('E4').numFmt = '"R$" #,##0.00';

  ws.addRow([]);

  const header = ws.addRow([
    'Número Pedido',
    'Fabricante',
    'Status',
    'Itens',
    'Total Custo',
  ]);

  styleTableHeader(header);

  orders.forEach((order, index) => {
    const row = ws.addRow([
      order.order_number,
      order.manufacturer_name,
      order.status,
      order.items_count,
      order.total_cost,
    ]);

    row.getCell(5).numFmt = '"R$" #,##0.00';
    styleBodyRow(row, index % 2 === 1);
  });

  ws.autoFilter = {
    from: 'A6',
    to: 'E6',
  };

  applyCommonSheetSetup(ws);

  return ws;
}

function buildOrdersSheet(workbook, orders) {
  const ws = workbook.addWorksheet('Pedidos');

  ws.columns = [
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Número Pedido', key: 'order_number', width: 22 },
    { header: 'Fabricante ID', key: 'manufacturer_id', width: 16 },
    { header: 'Fabricante', key: 'manufacturer_name', width: 38 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Qtd. Itens', key: 'items_count', width: 12 },
    { header: 'Total Custo', key: 'total_cost', width: 18 },
    { header: 'Observações', key: 'notes', width: 50 },
    { header: 'Criado em', key: 'created_at', width: 22 },
    { header: 'Atualizado em', key: 'updated_at', width: 22 },
  ];

  styleTableHeader(ws.getRow(1));

  orders.forEach((order, index) => {
    const row = ws.addRow({
      id: order.id,
      order_number: order.order_number,
      manufacturer_id: order.manufacturer_id,
      manufacturer_name: order.manufacturer_name,
      status: order.status,
      items_count: order.items_count,
      total_cost: order.total_cost,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
    });

    row.getCell('total_cost').numFmt = '"R$" #,##0.00';
    row.getCell('created_at').numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell('updated_at').numFmt = 'dd/mm/yyyy hh:mm';

    styleBodyRow(row, index % 2 === 1);
  });

  ws.autoFilter = {
    from: 'A1',
    to: 'J1',
  };

  applyCommonSheetSetup(ws);

  return ws;
}

function buildItemsSheet(workbook, orders) {
  const ws = workbook.addWorksheet('Itens');

  ws.columns = [
    { header: 'Número Pedido', key: 'order_number', width: 22 },
    { header: 'Fabricante', key: 'manufacturer_name', width: 38 },
    { header: 'Item ID', key: 'manufacture_order_item_id', width: 12 },
    { header: 'Product Stock ID', key: 'product_stock_id', width: 16 },
    { header: 'Product ID', key: 'product_id', width: 14 },
    { header: 'Código Produto', key: 'product_code', width: 18 },
    { header: 'SKU', key: 'sku', width: 18 },
    { header: 'Descrição', key: 'description', width: 55 },
    { header: 'U.M', key: 'unit', width: 10 },
    { header: 'Estoque', key: 'stock_qty', width: 14 },
    { header: 'Mínimo', key: 'stock_min', width: 14 },
    { header: 'Máximo', key: 'stock_max', width: 14 },
    { header: 'Quantidade', key: 'quantity', width: 14 },
    { header: 'Custo Unitário', key: 'cost_price', width: 18 },
    { header: 'Total Item', key: 'total_item', width: 18 },
  ];

  styleTableHeader(ws.getRow(1));

  let rowIndex = 0;

  for (const order of orders) {
    const items = order.items.map(normalizeItem);

    for (const item of items) {
      const row = ws.addRow({
        order_number: order.order_number,
        manufacturer_name: order.manufacturer_name,
        manufacture_order_item_id: item.manufacture_order_item_id,
        product_stock_id: item.product_stock_id,
        product_id: item.product_id,
        product_code: item.product_code,
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        stock_qty: item.stock_qty,
        stock_min: item.stock_min,
        stock_max: item.stock_max,
        quantity: item.quantity,
        cost_price: item.cost_price,
        total_item: item.total_item,
      });

      row.getCell('cost_price').numFmt = '"R$" #,##0.00';
      row.getCell('total_item').numFmt = '"R$" #,##0.00';

      styleBodyRow(row, rowIndex % 2 === 1);
      rowIndex++;
    }
  }

  ws.autoFilter = {
    from: 'A1',
    to: 'O1',
  };

  applyCommonSheetSetup(ws);

  return ws;
}

function buildOrderDetailSheet(workbook, order) {
  const safeSheetName = String(order.order_number || `Pedido ${order.id}`)
    .replace(/[\\/*?:[\]]/g, '-')
    .slice(0, 31);

  const ws = workbook.addWorksheet(safeSheetName || 'Pedido');

  ws.columns = [
    { key: 'a', width: 18 },
    { key: 'b', width: 22 },
    { key: 'c', width: 18 },
    { key: 'd', width: 18 },
    { key: 'e', width: 16 },
    { key: 'f', width: 14 },
    { key: 'g', width: 14 },
    { key: 'h', width: 14 },
    { key: 'i', width: 14 },
    { key: 'j', width: 18 },
    { key: 'k', width: 18 },
  ];

  setTitle(ws, `PEDIDO PARA FABRICANTE — ${order.order_number}`, 'K');

  ws.addRow([]);

  addInfoRow(ws, 3, 'Número Pedido', order.order_number, 'Status', order.status);
  addInfoRow(ws, 4, 'Fabricante', order.manufacturer_name, 'Fabricante ID', order.manufacturer_id);
  addInfoRow(ws, 5, 'Criado em', order.created_at, 'Atualizado em', order.updated_at);
  addInfoRow(ws, 6, 'Qtd. Itens', order.items_count, 'Total Geral', order.total_cost);

  ws.getCell('B5').numFmt = 'dd/mm/yyyy hh:mm';
  ws.getCell('E5').numFmt = 'dd/mm/yyyy hh:mm';
  ws.getCell('E6').numFmt = '"R$" #,##0.00';

  ws.addRow([]);

  ws.mergeCells('A8:K8');
  ws.getCell('A8').value = 'Observações';
  ws.getCell('A8').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A8').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  ws.getCell('A8').border = borderFull();

  ws.mergeCells('A9:K10');
  ws.getCell('A9').value = order.notes || '';
  ws.getCell('A9').alignment = {
    vertical: 'top',
    horizontal: 'left',
    wrapText: true,
  };
  ws.getCell('A9').border = borderFull();

  ws.addRow([]);

  const tableHeader = ws.addRow([
    'SKU',
    'Código',
    'Descrição',
    'U.M',
    'Estoque',
    'Mín.',
    'Máx.',
    'Qtd',
    'Custo',
    'Total',
    'Item ID',
  ]);

  styleTableHeader(tableHeader);

  const startRow = tableHeader.number + 1;

  order.items.map(normalizeItem).forEach((item, index) => {
    const row = ws.addRow([
      item.sku,
      item.product_code,
      item.description,
      item.unit,
      item.stock_qty,
      item.stock_min,
      item.stock_max,
      item.quantity,
      item.cost_price,
      item.total_item,
      item.manufacture_order_item_id,
    ]);

    row.getCell(9).numFmt = '"R$" #,##0.00';
    row.getCell(10).numFmt = '"R$" #,##0.00';

    styleBodyRow(row, index % 2 === 1);
  });

  const totalRow = ws.addRow([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL GERAL',
    order.total_cost,
    '',
  ]);

  totalRow.getCell(9).font = { bold: true };
  totalRow.getCell(10).font = { bold: true };
  totalRow.getCell(10).numFmt = '"R$" #,##0.00';

  totalRow.eachCell(cell => {
    cell.border = borderFull();
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
  });

  ws.autoFilter = {
    from: `A${tableHeader.number}`,
    to: `K${tableHeader.number}`,
  };

  ws.views = [{ state: 'frozen', ySplit: tableHeader.number }];

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  return ws;
}

export async function generationManufacturesOrdersExcel({
  orders = [],
  res,
  filename = 'pedidos-fabricantes.xlsx',
} = {}) {
  const normalizedOrders = Array.isArray(orders)
    ? orders.map(normalizeOrder)
    : [];

  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'CONSART ERP';
  workbook.lastModifiedBy = 'CONSART ERP';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = 'CONSART ERP';
  workbook.subject = 'Pedidos para Fabricantes';
  workbook.title = 'Pedidos para Fabricantes';

  buildResumoSheet(workbook, normalizedOrders);
  buildOrdersSheet(workbook, normalizedOrders);
  buildItemsSheet(workbook, normalizedOrders);

  if (normalizedOrders.length === 1) {
    buildOrderDetailSheet(workbook, normalizedOrders[0]);
  } else {
    normalizedOrders.slice(0, 20).forEach(order => {
      buildOrderDetailSheet(workbook, order);
    });
  }

  if (res) {
    const safeName = sanitizeFilename(filename);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"`,
    );

    await workbook.xlsx.write(res);
    res.end();
    return null;
  }

  return workbook.xlsx.writeBuffer();
}

export default generationManufacturesOrdersExcel;