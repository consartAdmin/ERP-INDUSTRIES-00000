// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ generationCrmDealsReativationsPerformanceExcel.js — Export CRM XLSX     ║
// ║ CONSART ERP | ESM                                                      ║
// ║ Local: backend/generationExcel/generationCrmDealsReativationsPerformanceExcel.js ║
// ║                                                                          ║
// ║ ✅ Layout/estilo PADRÃO igual aos exports (clientes/produtos)            ║
// ║ ✅ Header (linha 1) com fundo cinza escuro + fonte branca + freeze        ║
// ║ ✅ AutoFilter + bordas finas + zebra                                      ║
// ║ ✅ Sem “cabeçalho extra” (título/filtros em linhas acima)                 ║
// ║ ✅ Nome de arquivo com timestamp                                          ║
// ║                                                                          ║
// ║ Fonte de dados: perfApi.listActions()                                    ║
// ║ (mesma base do GET /api/crm/reativacao/actions)                           ║
// ║                                                                          ║
// ║ Colunas:                                                                 ║
// ║ Data/Hora, Vendedor, Cliente, Ação, Etapa, Valor (R$), Detalhes           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';
import dayjs from 'dayjs';

import perfApi from '../repositories/crmDealsPerformance/crmDealsPerformance.index.js';

/* ===========================
   Helpers
   =========================== */

function toInt(v, def = undefined) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : def;
}

function safeTrim(v) {
  const s = (v ?? '').toString().trim();
  return s ? s : null;
}

function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('pt-BR');
}

function labelAction(type) {
  const t = String(type || '').toUpperCase();
  const map = {
    CREATE_DEAL: 'Criação de Card',
    UPDATE_DEAL: 'Atualização de Card',
    MOVE_STAGE: 'Movimentação de Etapa',
    DELETE_DEAL: 'Exclusão de Card',
    OUTCOME_CONVERSION: 'Conversão',
    OUTCOME_LOSS: 'Queda de Venda',
    NOTE: 'Anotação',
    CALL: 'Ligação',
    WHATSAPP: 'WhatsApp',
    EMAIL: 'E-mail',
    VISIT: 'Visita',
  };
  return map[t] || (type || '');
}

function buildStageLabel(r) {
  const stageCode = r.stage_code || r.stageCode || r.stage || '';
  const fromStage = r.from_stage_code || r.fromStageCode || r.from_stage || '';
  const toStage = r.to_stage_code || r.toStageCode || r.to_stage || '';

  if (fromStage || toStage) {
    return `${fromStage || '—'} → ${toStage || stageCode || '—'}`;
  }
  return stageCode || '';
}

function stringifyDetails(r) {
  const detailsObj = r.details || r.meta || null;

  let details = '';
  try {
    if (typeof detailsObj === 'string') details = detailsObj;
    else if (detailsObj && typeof detailsObj === 'object') details = JSON.stringify(detailsObj);
  } catch (_) {}

  if (!details) details = r.note || r.notes || r.observacao || '';
  return details || '';
}

/* ===========================
   Main Export (Express handler)
   =========================== */

export async function exportCrmDealsReativationPerformanceExcel(req, res) {
  try {
    // aceita aliases iguais ao controller/fe
    const startDate = req.query.startDate || req.query.start || null;
    const endDate = req.query.endDate || req.query.end || null;
    const sellerId = toInt(req.query.sellerId || req.query.seller_id, null);

    const actionType = safeTrim(req.query.actionType || req.query.type || null);
    const q = safeTrim(req.query.q || req.query.search || '');

    // Excel normalmente exporta “tudo” do filtro (limite alto)
    const limit = toInt(req.query.limit, 50000);
    const offset = toInt(req.query.offset, 0);

    // Busca no perfApi (mesma fonte da rota /actions)
    const r = await perfApi.listActions({
      startDate,
      endDate,
      sellerId,
      actionType,
      q,
      limit,
      offset,
    });

    if (!r?.ok) {
      return res.status(r?.status || 400).json(r || { ok: false, error: 'Falha ao buscar ações.' });
    }

    const rows = r?.data || r?.rows || r?.items || [];
    const fileName = `crm_reativacao_performance_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`;

    // ──────────────────────────────────────────────
    // Workbook / Worksheet
    // ──────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Performance');

    // Colunas (ordem e larguras)
    ws.columns = [
      { header: 'Data/Hora', key: 'created_at',    width: 22 },
      { header: 'Vendedor',  key: 'seller_name',   width: 22 },
      { header: 'Cliente',   key: 'customer_name', width: 28 },
      { header: 'Ação',      key: 'action_label',  width: 22 },
      { header: 'Etapa',     key: 'stage_label',   width: 24 },
      { header: 'Valor (R$)',key: 'value_brl',     width: 16 },
      { header: 'Detalhes',  key: 'details',       width: 60 },
    ];

    // ──────────────────────────────────────────────
    // Header style (linha 1) — igual produtos/clientes
    // ──────────────────────────────────────────────
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' }, // cinza escuro
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 22;

    // ──────────────────────────────────────────────
    // Dados
    // ──────────────────────────────────────────────
    for (const r0 of rows) {
      const createdAt =
        r0.created_at || r0.createdAt || r0.ts || r0.timestamp || r0.created || null;

      const seller =
        r0.seller_name || r0.sellerName || r0.vendedor || r0.seller || '';

      const customer =
        r0.customer_name || r0.customerName || r0.cliente || r0.customer || '';

      const type =
        r0.action_type || r0.actionType || r0.type || r0.action || r0.acao || '';

      const stageLabel = buildStageLabel(r0);

      const val =
        r0.value_at_moment ??
        r0.valueAtMoment ??
        r0.estimated_value ??
        r0.estimatedValue ??
        r0.value ??
        r0.valor ??
        null;

      const details = stringifyDetails(r0);

      const row = ws.addRow({
        created_at: fmtDateTime(createdAt),
        seller_name: seller,
        customer_name: customer,
        action_label: labelAction(type),
        stage_label: stageLabel,
        value_brl: (val === null || val === undefined || val === '') ? '' : fmtBRL(val),
        details,
      });

      // alinhamentos semelhantes ao padrão
      row.getCell('created_at').alignment = { horizontal: 'center' };
      row.getCell('value_brl').alignment  = { horizontal: 'right' };
    }

    const lastRow = ws.lastRow?.number || 1;

    // Coluna Data/Hora em negrito? (não precisa)
    // Mas podemos reforçar a legibilidade da primeira coluna (igual SKU/ID em outros)
    const colDate = ws.getColumn('created_at');
    colDate.eachCell((cell, rowNumber) => {
      if (rowNumber === 1) return;
      cell.font = { ...(cell.font || {}), bold: true };
      cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
    });

    // Bordas e zebra (igual produtos/clientes)
    for (let rN = 1; rN <= lastRow; rN++) {
      const row = ws.getRow(rN);

      row.eachCell((cell) => {
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left:   { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });

      // zebra (a partir da linha 2)
      if (rN >= 2 && rN % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' }, // cinza bem claro
        };
      }
    }

    // AutoFilter (A até G)
    ws.autoFilter = {
      from: 'A1',
      to: 'G1',
    };

    // Congelar header
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    // Altura das linhas de dados
    for (let rN = 2; rN <= lastRow; rN++) ws.getRow(rN).height = 18;

    // ──────────────────────────────────────────────
    // Headers HTTP (download)
    // ──────────────────────────────────────────────
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[crm][exportCrmDealsReativationPerformanceExcel] error:', err);
    res.status(500).json({
      ok: false,
      error: 'Falha ao exportar Performance do CRM (Excel).',
      details: err?.message || String(err),
    });
  }
}

export default exportCrmDealsReativationPerformanceExcel;
