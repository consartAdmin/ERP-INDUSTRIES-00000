// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersController.js — Controller de Pedidos (ESM) — CONSART ERP     ║
// ║ - Pedidos em geral (/api/orders...)                                  ║
// ║ - Listagem NF-e baseada na tabela orders (/api/nfes...)              ║
// ║ - Relatório PDF de pedidos (/api/orders/report/pdf)                  ║
// ╚══════════════════════════════════════════════════════════════════════╝
import pool from '../config/db.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

import ordersApi from '../repositories/orders/orders.index.js';
import customersApi from '../repositories/customers/customers.index.js'; // 🔗 hidratar dados do cliente
import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';
import {
  debitOrderStock,
  rollbackOrderStock,
} from '../services/stockFromOrdersService.js';

import ordersBillingApi from '../repositories/ordersBilling/ordersBilling.index.js';

import invoicesIssuedApi from '../repositories/invoicesIssued/invoicesIssued.index.js';

// 🔗 Novo bridge central NF-e ↔ Asaas
import { sendOrderToAsaas } from '../services/nfeAsaasBridgeService.js';

import { generateDanfeFromXml } from '../services/danfeConsartService.js';
import axios from 'axios';

import { generateOrderSeparationPdf } from '../generationPdf/generationOrdersSeparationPdf.js';

import { NFE_STATUS } from '../services/shared/constants/nfeStatus.js';
import { ORDER_STATUS } from '../services/shared/constants/orderStatus.js';
import { queueErrorEmail } from '../errorEmailReporter.js';

function reportOrdersError(...args) {
  console.error(...args);
  const caught = args.find((value) => value instanceof Error);
  const label = typeof args[0] === 'string' ? args[0] : 'Erro no módulo de pedidos';
  queueErrorEmail('ORDERS_CONTROLLER_ERROR', {
    module: 'controllers/ordersController.js',
    message: caught?.message || label,
    context: label,
    err: caught ? { name: caught.name, message: caught.message, code: caught.code, stack: caught.stack } : undefined,
    details: args,
  });
}

// Em ESM, simulamos __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapeia o resumo da PlugNotas (consultarNFe) para os campos da tabela orders
function mapPlugNotasResumoToOrderPatch(resumo, ambienteFallback = null) {
  if (!resumo) return {};

  return {
    // status da NF-e (CONCLUIDO, CANCELADO, REJEITADO, etc.)
    nfe_status: resumo.status || 'N/D',

    // número da NF-e
    nfe_number: resumo.numero ? Number(resumo.numero) : null,

    // chave de acesso
    nfe_key:
      resumo.accessKey ||
      resumo.chaveAcesso ||
      resumo.chave_acesso || // fallback adicional
      resumo.chave || // último fallback (compat antiga)
      null,

    // protocolo SEFAZ
    nfe_protocol: resumo.protocolo || null,

    // URLs do XML e DANFE (PDF)
    nfe_xml_url: resumo.xml || null,
    nfe_danfe_url: resumo.pdf || null,

    // ambiente (Produção / Homologação)
    nfe_environment: ambienteFallback || null,

    // id interno da PlugNotas
    nfe_plugnotas_id: resumo.id || null,
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: formata data vinda como string / Date / número
// ──────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return d.toISOString().slice(0, 10);
  }

  const s = String(d);

  // Ex: 2025-11-17T03:00:00.000Z
  if (s.includes('T')) {
    return s.slice(0, 10);
  }

  // Ex: 20251117
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // Qualquer outra string: pega até 10 caracteres
  return s.slice(0, 10);
}

// ──────────────────────────────────────────────────────────────
// Helper: busca Observações do Orçamento
// Tabela: public."budgets"
// Colunas: budget_id, notes
// ──────────────────────────────────────────────────────────────
async function loadBudgetObservation(budgetId) {
  if (!budgetId) return null;

  try {
    const { rows } = await pool.query(
      `
        SELECT NULLIF(BTRIM(COALESCE(b."notes", '')), '') AS observation
        FROM public."budgets" AS b
        WHERE b."budget_id" = $1
        LIMIT 1;
      `,
      [budgetId]
    );

    return rows[0]?.observation ?? null;
  } catch (error) {
    reportOrdersError(
      '[NFE] Erro ao buscar observação em public.budgets:',
      error?.message || error
    );

    return null;
  }
}

// ======================================================================
// Bootstrap opcional (chamado no server.js, similar ao budgets)
// ======================================================================
export async function initOrdersController() {
  try {
    await ordersApi.ensureTables?.();
    await ordersBillingApi.ensureTable?.();
    await invoicesIssuedApi.ensureTable?.();
  } catch (err) {
    reportOrdersError('initOrdersController() failed:', err);
  }
}

// ======================================================================
// PEDIDOS — /api/orders...
// ======================================================================

/** GET /api/orders/search */
export async function searchOrders(req, res) {
  try {
    const {
      q = '',
      limit = 20,
      offset = 0,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    const out = await ordersApi.search({
      q,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
      status: status ?? undefined, // 👉 aqui é status do PEDIDO
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
      // ⚠️ aqui NÃO filtramos por NF-e: é busca geral de pedidos
    });

    if (!out?.ok) {
      return res.status(400).json(out);
    }
    return res.json(out);
  } catch (err) {
    reportOrdersError('[searchOrders] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

/** GET /api/orders */
export async function listOrders(req, res) {
  try {
    const { q = '', limit = 20, offset = 0, status, dateFrom, dateTo } = req.query;

    // ✅ Se veio termo, vira busca (igual /search)
    if (String(q || '').trim()) {
      const out = await ordersApi.search({
        q,
        limit: Number(limit) || 20,
        offset: Number(offset) || 0,
        status: status ?? undefined,
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
      });
      if (!out?.ok) return res.status(400).json(out);
      return res.json(out);
    }

    // ✅ Sem termo: lista normal
    const out = await ordersApi.list({
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
    });

    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    reportOrdersError('[listOrders] EXC:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

/** GET /api/orders/pending-nfe
 *  Usado pelo dashboard (card + modal "Pedidos sem NF-e")
 */
export async function listOrdersPendingNfe(req, res) {
  try {
    const result = await ordersApi.listPendingNfe();

    if (!result?.ok) {
      return res.status(400).json(result);
    }

    // Mantém o formato que o dashBoardAlerts.js espera:
    // { ok, count, totalAmount, pending: [...] }
    return res.json(result);
  } catch (err) {
    reportOrdersError('[listOrdersPendingNfe] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

/** GET /api/orders/:id */
/** GET /api/orders/:id */
export async function getOrderById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    const out = await ordersApi.getById(id);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }

    // ──────────────────────────────────────────────────────
    // 🔗 Hidratar com dados completos do cliente
    // ──────────────────────────────────────────────────────
    try {
      const customerId = out.header?.customer_id;
      if (customerId) {
        const customer = await customersApi.getById(customerId);
        if (customer) out.customer = customer;
      }
    } catch (e) {
      reportOrdersError('[getOrderById] WARN ao carregar customer:', e);
    }

    // ──────────────────────────────────────────────────────
    // 🧾 Observações do orçamento + 🚚 Frete (padronizado)
    // ──────────────────────────────────────────────────────
    try {
      const header = out.header || {};

      const budgetId =
        header.budget_id ||
        header.orcamento_id ||
        header.budgetId ||
        header.budgetID ||
        null;

      const obsRaw = await loadBudgetObservation(budgetId);
      const cleanObs = (obsRaw || '').trim() || null;

      const freteRaw =
        header.freight_value ??
        header.frete_valor ??
        header.valor_frete ??
        header.frete ??
        header.shipping_value ??
        header.shipping_total ??
        null;

      const freteValue = Number(freteRaw || 0);

      out.header = {
        ...header,

        // ✅ campo atual (para seu front)
        complementary_info: cleanObs,

        // ✅ alias “notes” (para não quebrar telas)
        notes: header.notes ?? cleanObs,

        // ✅ frete padronizado
        freight_value: Number.isFinite(freteValue) ? freteValue : 0,

        // opcional: modalidade
        freight_mode:
          header.freight_mode ??
          header.modalidade_frete ??
          header.frete_modalidade ??
          null,
      };
    } catch (e) {
      reportOrdersError('[getOrderById] WARN frete/obs:', e);
    }

    return res.json(out);
  } catch (err) {
    reportOrdersError('[getOrderById] EXC:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

/** PUT /api/orders/:id */
export async function updateOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    const patch = {
      ...(req.body || {}),
      user_id: req.user?.id || req.user?.user_id || req.user?.email || null,
    };

    const out = await ordersApi.update(id, patch);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }
    return res.json(out);
  } catch (err) {
    reportOrdersError('[updateOrder] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

/** DELETE /api/orders/:id */
export async function deleteOrder(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    const out = await ordersApi.remove(id, {
      user_id: req.user?.id || req.user?.user_id || req.user?.email || null,
    });
    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    reportOrdersError('[deleteOrder] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// RELATÓRIO PDF — PEDIDOS / NF-e (ESTILO DANFE • A4 PAISAGEM)
// GET /api/orders/report/pdf?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// ======================================================================
export async function reportOrdersPdf(req, res) {
  const { dateFrom, dateTo, status, nfeStatus, nfe_status, environment } =
    req.query;

  const fmtMoney = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  try {
    // 1) Define filtro padrão de NF-e para o RELATÓRIO DE VENDAS
    //    - Se vier nfeStatus/nfe_status na query, respeita (exceto "TODOS")
    //    - Se não vier nada -> usa "AUTORIZADA"
    const rawNfeStatus = (nfeStatus ?? nfe_status ?? '').trim();
    let effectiveNfeStatus = null;

    if (rawNfeStatus && rawNfeStatus.toUpperCase() !== 'TODOS') {
      // usuário passou um status específico (AUTORIZADA, CANCELADA, etc.)
      effectiveNfeStatus = rawNfeStatus;
    }

    // Default do relatório de vendas: só NF-e AUTORIZADA
    if (!effectiveNfeStatus) {
      effectiveNfeStatus = NFE_STATUS.AUTHORIZED;
    }

    // 1) BUSCA PEDIDOS
    const out = await ordersApi.search({
      q: '',
      limit: 5000,
      offset: 0,
      status: status || undefined, // status do PEDIDO (ABERTO, CONVERTIDO...)
      nfeStatus: effectiveNfeStatus, // status da NF-e (AUTORIZADA por padrão)
      environment: environment || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });

    if (!out?.ok) return res.status(400).json(out);

    const rows = out.rows || [];

    const safeRows = rows.map((o) => {
      const paymentDesc = [o.payment_form_name, o.payment_term_name]
        .filter(Boolean)
        .join(' • ');

      return {
        number: o.number || o.order_id || '',
        issueDate: fmtDate(o.issue_date),
        customerName: o.customer_name || '',
        customerTaxId: o.customer_tax_id || '',
        payment: paymentDesc || '',
        nfeStatus: o.nfe_status || '-',
        totalAmount: Number(o.total_amount || 0),
      };
    });

    // 2) PDF EM MEMÓRIA (LANDSCAPE)
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      layout: 'landscape', // <<<<<<<<<<<<<<<<<<<<<<<< PAISAGEM 👈
      autoFirstPage: true,
    });

    const chunks = [];
    let responseSent = false;

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      if (responseSent) return;
      const pdf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="relatorio-pedidos.pdf"'
      );
      res.send(pdf);
    });

    // 3) CABEÇALHO (DANFE)
    const companyName = 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA';
    const cnpj = 'CNPJ: 34.363.337/0001-85';
    const addr1 = 'AV. BIAS FORTES, 784 - LOURDES';
    const addr2 = 'CEP 30170-012 - BELO HORIZONTE/MG';
    const phone = 'Fones: (31) 3566-0070 / (31) 3566-8888';
    const emailSite =
      'vendas@bh3distribuidora.com.br - www.bh3distribuidora.com.br';

    const periodoLabel = (() => {
      const ini = dateFrom ? fmtDate(dateFrom) : 'início';
      const fim = dateTo ? fmtDate(dateTo) : 'hoje';
      return `Período: ${ini} a ${fim}`;
    })();

    const drawTableHeader = (x, y) => {
      const wNumber = 40;
      const wDate = 70;
      const wCustomer = 220;
      const wTax = 110;
      const wPayment = 140;
      const wNfe = 100;
      const wTotal = 80;
      const h = 20;

      const totalWidth =
        wNumber + wDate + wCustomer + wTax + wPayment + wNfe + wTotal;

      doc.rect(x, y, totalWidth, h).fill('#e5e7eb');
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);

      let cx = x + 5;
      const ty = y + 5;

      doc.text('Nº', cx, ty, { width: wNumber, align: 'left' });
      cx += wNumber;

      doc.text('Data', cx, ty, { width: wDate, align: 'center' });
      cx += wDate;

      doc.text('Cliente', cx, ty, { width: wCustomer, align: 'left' });
      cx += wCustomer;

      doc.text('CNPJ/CPF', cx, ty, { width: wTax, align: 'left' });
      cx += wTax;

      doc.text('Pagamento', cx, ty, { width: wPayment, align: 'left' });
      cx += wPayment;

      doc.text('Status NF-e', cx, ty, { width: wNfe, align: 'left' });
      cx += wNfe;

      doc.text('Total (R$)', cx, ty, { width: wTotal, align: 'right' });

      doc.fillColor('black').font('Helvetica').fontSize(9);

      return {
        x,
        y: y + h + 2,
        wNumber,
        wDate,
        wCustomer,
        wTax,
        wPayment,
        wNfe,
        wTotal,
        totalWidth,
      };
    };

    const drawHeaderAndTable = () => {
      const { width } = doc.page;

      // LOGO
      try {
        const logo = path.join(
          __dirname,
          '..',
          'public',
          'imagens',
          'logo_bh3_pdf.png'
        );
        doc.image(logo, 40, 25, { width: 90 });
      } catch (_) { }

      // TEXTO CABEÇALHO
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(companyName, 140, 25);
      doc.font('Helvetica').fontSize(9);
      doc.text(cnpj, 140, 39);
      doc.text(addr1, 140, 52);
      doc.text(addr2, 140, 64);
      doc.text(phone, 140, 76);
      doc.text(emailSite, 140, 88);

      // LINHA
      doc
        .moveTo(40, 118)
        .lineTo(width - 40, 118)
        .strokeColor('#0f172a')
        .stroke();

      // TÍTULO
      doc.font('Helvetica-Bold').fontSize(13);
      doc.text('RELATÓRIO DE PEDIDOS / NF-e', 40, 125, {
        width: width - 80,
        align: 'center',
      });

      // PERÍODO
      doc.font('Helvetica').fontSize(9);
      doc.text(periodoLabel, 40, 145, {
        width: width - 80,
        align: 'center',
      });

      // CABEÇALHO DA TABELA
      return drawTableHeader(40, 170);
    };

    // 5) RENDERIZAÇÃO DAS LINHAS
    let table = drawHeaderAndTable();
    let y = table.y;
    const bottom = doc.page.height - 40;
    let grandTotal = 0;

    if (!safeRows.length) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .text('Nenhum pedido encontrado.', 40, y + 20);
    } else {
      safeRows.forEach((row, idx) => {
        if (y > bottom - 20) {
          doc.addPage();
          table = drawHeaderAndTable();
          y = table.y;
        }

        if (idx % 2 === 1) {
          doc.save();
          doc.rect(table.x, y - 2, table.totalWidth, 18).fill('#f9fafb');
          doc.restore();
        }

        let cx = table.x + 5;
        doc.font('Helvetica').fontSize(9);

        doc.text(String(row.number), cx, y, { width: table.wNumber });
        cx += table.wNumber;

        doc.text(row.issueDate, cx, y, {
          width: table.wDate,
          align: 'center',
        });
        cx += table.wDate;

        doc.text(row.customerName, cx, y, { width: table.wCustomer });
        cx += table.wCustomer;

        doc.text(row.customerTaxId, cx, y, { width: table.wTax });
        cx += table.wTax;

        doc.text(row.payment || '', cx, y, { width: table.wPayment });
        cx += table.wPayment;

        doc.text(row.nfeStatus, cx, y, { width: table.wNfe });
        cx += table.wNfe;

        doc.text(fmtMoney(row.totalAmount), cx, y, {
          width: table.wTotal,
          align: 'right',
        });

        grandTotal += row.totalAmount;
        y += 15;
      });
    }

    // 6) TOTAL GERAL
    if (y > bottom - 30) {
      doc.addPage();
      table = drawHeaderAndTable();
      y = table.y;
    }

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Total geral: R$ ${fmtMoney(grandTotal)}`, 40, y + 20);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Quantidade de pedidos: ${safeRows.length}`, 40, y + 36);

    doc.end();
  } catch (err) {
    reportOrdersError('[reportOrdersPdf] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// NF-E — Listagem específica para a tela nfes.html
// Baseada na tabela public.orders (campos nfe_*)
// ======================================================================

/**
 * GET /api/nfes/search
 *
 * Usado pela tela "Notas Fiscais (NF-e)" com:
 * - q             → cliente, doc, nº pedido, chave, etc.
 * - status        → **status da NF-e** (AUTORIZADA, CANCELADA, REJEITADA, ...)
 * - nfeStatus     → idem (opcional – permite chamar com nome explícito)
 * - environment   → ambiente (Homologação, Produção, N/D)
 * - orderStatus   → status do PEDIDO (ABERTO, FATURADO...) — opcional
 * - limit / offset
 *
 * Obs: o select da tela nfes.html envia "status" como status da NF-e.
 */
export async function searchNfes(req, res) {
  try {
    const {
      q = '',
      limit = 20,
      offset = 0,
      status, // 👈 da tela, é status da NF-e
      nfeStatus,
      nfe_status,
      environment,
      orderStatus, // opcional, se quiser filtrar status do pedido
    } = req.query;

    const nfeStatusFinal = (nfeStatus ?? nfe_status ?? status) || undefined;

    const orderStatusFinal = orderStatus ?? undefined;

    const out = await ordersApi.search({
      q,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
      status: orderStatusFinal, // 👉 aqui é status do PEDIDO
      nfeStatus: nfeStatusFinal, // 👉 aqui é status da NF-e (o que vem da tela)
      environment: environment ?? undefined,
      onlyWithNfe: true, // 👉 só pedidos que tenham NF-e relacionada
    });

    if (!out?.ok) {
      return res.status(400).json(out);
    }
    return res.json(out);
  } catch (err) {
    reportOrdersError('[searchNfes] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

/**
 * GET /api/nfes
 *
 * Versão simples: paginação + filtro de NF-e (sem termo de busca).
 * Ideal para "Mostrar 20/50/100" sem termo de busca.
 *
 * Query:
 * - status / nfeStatus / nfe_status → status da NF-e
 * - environment                    → ambiente da NF-e
 * - orderStatus                    → status do pedido (opcional)
 */
export async function listNfes(req, res) {
  try {
    const {
      limit = 20,
      offset = 0,
      status, // status da NF-e (vindo da tela)
      nfeStatus,
      nfe_status,
      environment,
      orderStatus, // opcional: status do pedido
    } = req.query;

    const nfeStatusFinal = (nfeStatus ?? nfe_status ?? status) || undefined;

    const orderStatusFinal = orderStatus ?? undefined;

    const out = await ordersApi.list({
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
      status: orderStatusFinal, // status do pedido (se vier)
      nfeStatus: nfeStatusFinal, // status da NF-e
      environment: environment ?? undefined,
      onlyWithNfe: true,
    });

    if (!out?.ok) return res.status(400).json(out);
    return res.json(out);
  } catch (err) {
    reportOrdersError('[listNfes] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// NF-E — Emitir NF-e a partir de um PEDIDO
// POST /api/orders/:id/nfe
// ======================================================================
export async function emitOrderNfe(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    // 1) Carrega pedido completo (header + items)
    const out = await ordersApi.getById(id);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res
        .status(code)
        .json({ ok: false, error: out?.error || 'PEDIDO_NAO_ENCONTRADO' });
    }

    const { header, items } = out;

    // 2) Monta JSON NF-e com o MESMO motor usado no CLI
    const nfeJson = await tecnospeedNfeApi.buildNFeFromOrder({ header, items });

    // 3) Emite NF-e na TecnoSpeed / PlugNotas
    const result = await tecnospeedNfeApi.emitirNFe(nfeJson);

    if (!result.ok) {
      const status = result.status || 400;
      return res.status(status).json({
        ok: false,
        error: result.error || 'FALHA_EMISSAO_NFE',
      });
    }

    // 4) Extrai dados principais de retorno (id PlugNotas, protocolo, etc.)
    const docs = Array.isArray(result.data?.documents)
      ? result.data.documents
      : [];
    const doc0 = docs[0] || {};
    const plugnotasId = doc0.id || doc0._id || null;
    const protocol = result.data?.protocol || null;

    // 5) Atualiza linha do pedido com alguns campos básicos da NF-e
    const cfg = tecnospeedNfeApi.getEffectiveConfig();
    const patch = {};

    if (plugnotasId) {
      patch.nfe_plugnotas_id = String(plugnotasId);
    }

    // Status inicial: nota em processamento na SEFAZ
    patch.nfe_status = NFE_STATUS.PROCESSING;

    if (cfg?.ambiente) {
      patch.nfe_environment = cfg.ambiente;
    }

    try {
      await ordersApi.update(id, patch);
    } catch (e) {
      reportOrdersError(
        '[emitOrderNfe] WARN ao atualizar pedido com dados básicos da NFe:',
        e.message || e
      );
    }

    // 6) NOVO: reconcile automático
    try {
      const rec = await tecnospeedNfeApi.reconcileOrderNfe(id);

      if (!rec.ok) {
        console.warn('[emitOrderNfe] WARN reconcile:', rec);
      } else {
        try {
          const sync = await invoicesIssuedApi.upsertFromOrder(id);

          if (!sync?.ok) {
            console.warn('[emitOrderNfe] invoicesIssued não sincronizada ainda:', sync);
          } else {
            console.log('[emitOrderNfe] invoicesIssued sincronizada:', id);
          }
        } catch (syncErr) {
          reportOrdersError(
            '[emitOrderNfe] erro ao sincronizar invoicesIssued:',
            syncErr?.message || syncErr
          );
        }
      }

    } catch (e) {
      reportOrdersError('[emitOrderNfe] reconcile EXC:', e);
    }

    return res.json({
      ok: true,
      message: 'NF-e enviada para processamento na SEFAZ.',
      orderId: id,
      idIntegracao: nfeJson.idIntegracao,
      numero: nfeJson.numero,
      ambiente: cfg?.ambiente || null,
      plugnotasId,
      protocol,
      raw: result.data,
    });
  } catch (err) {
    reportOrdersError('[emitOrderNfe] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// NF-E — Reconciliar dados da NF-e na tabela orders
// POST /api/nfes/reconcile/:id
// ======================================================================
export async function reconcileOrderNfe(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    // Usa o helper centralizado tecnospeedNfeApi.reconcileOrderNfe
    const result = await tecnospeedNfeApi.reconcileOrderNfe(id);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    reportOrdersError('[reconcileOrderNfe] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// NF-E — Detalhes (Resumo / Timeline / Erros / Pagamentos)
// GET /api/orders/:id/nfe/details
// Usado pelo nfes.html na linha expandida
// ======================================================================
export async function getOrderNfeDetails(req, res) {
  try {
    const rawId = req.params.id ?? req.params.orderId;
    const id = Number(rawId);

    if (!Number.isFinite(id) || id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    // 1) Carrega o pedido (header + items) do banco
    const out = await ordersApi.getById(id);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res
        .status(code)
        .json({ ok: false, error: out?.error || 'PEDIDO_NAO_ENCONTRADO' });
    }

    const header = out.header || {};
    const items = out.items || [];

    // ------------------------------------------------------------------
    // 2) Consulta TecnoSpeed / PlugNotas para pegar dados "frescos"
    // ------------------------------------------------------------------
    let remote = null;
    let remoteErrors = [];
    let remoteTimeline = [];
    let remotePayments = [];

    const plugId = header.nfe_plugnotas_id;
    if (plugId) {
      try {
        const resp = await tecnospeedNfeApi.consultarNFe(plugId);
        if (resp?.ok) {
          const data = Array.isArray(resp.data)
            ? resp.data[0]
            : resp.data || {};
          remote = data;

          // 🔹 possíveis campos de erros
          const errRaw =
            data.erros ||
            data.errors ||
            data.errosValidacao ||
            data.mensagens ||
            null;
          if (errRaw) {
            remoteErrors = Array.isArray(errRaw) ? errRaw : [errRaw];
          }

          // 🔹 possíveis campos de timeline / histórico
          const tlRaw = data.timeline || data.eventos || data.historico || null;
          if (tlRaw) {
            remoteTimeline = Array.isArray(tlRaw) ? tlRaw : [tlRaw];
          }

          // 🔹 pagamentos (se algum dia a API devolver)
          const payRaw = data.pagamentos || data.payments || null;
          if (payRaw) {
            remotePayments = Array.isArray(payRaw) ? payRaw : [payRaw];
          }
        }
      } catch (e) {
        reportOrdersError('[getOrderNfeDetails] WARN consultarNFe:', e);
      }
    }

    // ------------------------------------------------------------------
    // 3) Monta RESUMO combinando banco + TecnoSpeed
    // ------------------------------------------------------------------
    const summary = {
      numeroNFe:
        remote?.numero ??
        remote?.numeroNfe ??
        remote?.numeroNF ??
        header.nfe_number ??
        null,

      statusNFe:
        remote?.situacao ??
        remote?.situacaoNfe ??
        remote?.statusNfe ??
        remote?.status ??
        header.nfe_status ??
        null,

      chaveAcesso:
        remote?.accessKey ??
        remote?.chaveAcesso ??
        remote?.chave_acesso ??
        remote?.chave ??
        header.nfe_key ??
        null,

      protocolo:
        remote?.protocolo ?? remote?.nProt ?? header.nfe_protocol ?? null,

      ambiente:
        (remote?.ambiente || header.nfe_environment || '').toString() || null,

      total:
        header.total_amount ??
        (remote?.valor != null ? Number(remote.valor) : null),

      issueDate: header.issue_date ?? remote?.emissao ?? null,
    };

    // ------------------------------------------------------------------
    // ⭐ Se NF-e AUTORIZADA/CONCLUÍDA → baixa estoque e envia para Asaas
    // ------------------------------------------------------------------
    try {
      const statusUpper = (summary.statusNFe || '').toString().toUpperCase();
      const cStat = Number(remote?.cStat ?? remote?.cstat ?? NaN);

      const isAutorizada =
        statusUpper.includes('CONCLUID') || // PlugNotas: "CONCLUIDO"
        statusUpper.includes('AUTORIZAD') || // pode vir "AUTORIZADA"
        cStat === 100; // SEFAZ autorizado

      if (isAutorizada) {
        // 1) Baixa de estoque (somente se ainda não debitado, lógica via service)
        const orderFull = await ordersApi.getById(id);

        console.log('[STOCK][DEBUG] Pedido carregado:', {
          id,
          items: orderFull?.items?.length || 0,
        });

        if (
          !orderFull ||
          !Array.isArray(orderFull.items) ||
          orderFull.items.length === 0
        ) {
          console.warn(
            `[STOCK][WARN] Nenhum item encontrado para o pedido ${id}. Estoque não será alterado.`
          );
        } else {
          const resultStock = await debitOrderStock(orderFull);
          console.log(
            '[STOCK][INFO] Estoque debitado para pedido',
            id,
            resultStock
          );
        }

        // 2) Envia para Asaas (centralizado no bridge service)
        try {
          const remoteIssueDateTime =
            remote?.emissao ||
            remote?.dataEmissao ||
            remote?.dhEmi ||
            remote?.issuedAt ||
            remote?.dataAutorizacao ||
            remote?.dhRecbto ||
            null;

          if (remoteIssueDateTime) {
            await ordersApi.update(id, {
              nfe_issue_datetime: remoteIssueDateTime,
              nfe_issue_date: fmtDate(remoteIssueDateTime),
            });

            await ordersApi.resyncPaymentDueDatesFromNfeDate(id);

            console.log('[NF-e→Asaas] Due dates recalculated from nfe_issue_date:', {
              order_id: id,
              nfe_issue_date: fmtDate(remoteIssueDateTime),
            });
          }
          const asaasResult = await sendOrderToAsaas(id);
          if (!asaasResult?.ok) {
            console.warn('[NF-e→Asaas] WARN:', asaasResult);
          } else {
            console.log(
              '[NF-e→Asaas] ✅ Cobrança registrada:',
              asaasResult.charge?.id
            );
          }
        } catch (errAsaas) {
          reportOrdersError(
            '[NF-e→Asaas] Erro ao enviar pedido ao Asaas:',
            errAsaas
          );
        }
      }
    } catch (e) {
      reportOrdersError(
        '[STOCK/ASAAS][ERROR] Erro ao debitar estoque / enviar ao Asaas:',
        e
      );
    }

    // ------------------------------------------------------------------
    // 4) Decide quais arrays usar (banco vs remoto)
    // ------------------------------------------------------------------
    const pickArray = (fromDb, fromRemote) => {
      if (Array.isArray(fromDb) && fromDb.length) return fromDb;
      if (Array.isArray(fromRemote) && fromRemote.length) return fromRemote;
      return [];
    };

    const errors = pickArray(header.nfe_errors, remoteErrors);
    const payments = pickArray(header.nfe_payments, remotePayments);
    const timeline = pickArray(header.nfe_timeline, remoteTimeline);

    // ------------------------------------------------------------------
    // 5) Opcional: persiste no banco para próximas consultas
    //    (só grava campos que realmente têm valor)
    // ------------------------------------------------------------------
    try {
      const patch = {};

      if (summary.statusNFe) {
        patch.nfe_status = String(summary.statusNFe).trim().toUpperCase();
      }

      if (summary.numeroNFe != null && summary.numeroNFe !== '') {
        const num = Number(summary.numeroNFe);
        patch.nfe_number = Number.isFinite(num) ? num : summary.numeroNFe;
      }

      if (summary.chaveAcesso) {
        patch.nfe_key = String(summary.chaveAcesso).trim();
      }

      if (summary.protocolo) {
        patch.nfe_protocol = String(summary.protocolo).trim();
      }

      if (summary.ambiente) {
        patch.nfe_environment = String(summary.ambiente).trim();
      }

      // ✅ Data/hora real de emissão da NF-e
      const remoteIssueDateTime =
        remote?.emissao ||
        remote?.dataEmissao ||
        remote?.dhEmi ||
        remote?.issuedAt ||
        remote?.dataAutorizacao ||
        remote?.dhRecbto ||
        null;

      if (remoteIssueDateTime) {
        patch.nfe_issue_datetime = remoteIssueDateTime;
        patch.nfe_issue_date = fmtDate(remoteIssueDateTime);
      } else if (summary.issueDate) {
        patch.nfe_issue_date = fmtDate(summary.issueDate);
      }

      if (errors.length) {
        patch.nfe_errors = errors;
      }

      if (payments.length) {
        patch.nfe_payments = payments;
      }

      if (timeline.length) {
        patch.nfe_timeline = timeline;
      }

      if (Object.keys(patch).length) {
        await ordersApi.update(id, patch);

        // 🔄 Sync invoicesIssued depois que a NF-e foi atualizada na orders
        try {
          const statusUpper = String(
            patch.nfe_status || summary.statusNFe || ''
          ).toUpperCase();

          const canSync =
            statusUpper.includes('CONCLUID') ||
            statusUpper.includes('AUTORIZAD');

          if (canSync) {
            const sync = await invoicesIssuedApi.upsertFromOrder(id);

            if (sync?.ok) {
              console.log('[getOrderNfeDetails] invoicesIssued sincronizada:', id);
            } else {
              console.warn('[getOrderNfeDetails] invoicesIssued não sincronizada:', sync);
            }
          }
        } catch (syncErr) {
          reportOrdersError(
            '[getOrderNfeDetails] erro sync invoicesIssued:',
            syncErr?.message || syncErr
          );
        }
      }
    } catch (e) {
      reportOrdersError(
        '[getOrderNfeDetails] WARN ao atualizar JSONB NF-e:',
        e.message || e
      );
    }

    // helper pra garantir sempre array na resposta
    const norm = (v) => (Array.isArray(v) ? v : v ? [v] : []);

    return res.json({
      ok: true,
      summary,
      errors: norm(errors),
      payments: norm(payments),
      timeline: norm(timeline),
      raw: {
        header,
        items,
        remote,
      },
    });
  } catch (err) {
    reportOrdersError('[getOrderNfeDetails] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// DANFE — GET /api/orders/:id/nfe/danfe
// ======================================================================
export async function getOrderDanfe(req, res) {
  try {
    console.log('====================================================');
    console.log('[DANFE][CONTROLLER] NEW getOrderDanfe EXECUTING');
    console.log('[DANFE][CONTROLLER] FILE:', import.meta.url);
    console.log('====================================================');

    const id = Number(req.params.id);

    console.log('[DANFE][CONTROLLER] Order ID:', id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetro :id inválido',
      });
    }

    // 1) Busca pedido
    const out = await ordersApi.getById(id);

    console.log('[DANFE][CONTROLLER] ordersApi.getById OK:', out?.ok);

    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }

    console.log('[DANFE][CONTROLLER] out keys:', Object.keys(out));

    const header = out.header || {};

    console.log('[DANFE][CONTROLLER] header keys:', Object.keys(header));

    console.log('[DANFE][CONTROLLER] out.shipping:', out.shipping);
    console.log('[DANFE][CONTROLLER] header.shipping:', header.shipping);

    // 2) Carrega XML
    let xmlContent = null;

    if (header.nfe_xml_url) {
      console.log('[DANFE][CONTROLLER] Download XML:', header.nfe_xml_url);

      const resp = await axios.get(header.nfe_xml_url, {
        responseType: 'text',
      });

      xmlContent = resp.data;
    }

    if (!xmlContent) {
      return res.status(400).json({
        ok: false,
        error: 'XML não encontrado para este pedido.',
      });
    }

    // 3) Status
    const prot = {
      status: header.nfe_status || null,
      nfe_status: header.nfe_status || null,
    };

    const safeText = (v) => {
      const s = String(v ?? '').trim();
      return s || null;
    };

    const formatMoneyBR = (v) =>
      Number(v || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    let paymentText =
      safeText(header.payment_text) ||
      safeText(header.payment_description) ||
      safeText(header.payment_method_text) ||
      safeText(header.payment_methods_text) ||
      safeText(header.payments_text) ||
      safeText(header.forma_pagamento_texto) ||
      safeText(header.forma_pagamento) ||
      safeText(header.payment_text_display) ||
      null;

    const payments = Array.isArray(out.payments)
      ? out.payments
      : Array.isArray(header.payments)
        ? header.payments
        : [];

    if (!paymentText && payments.length) {
      const partes = payments.map((p) => {
        const nome =
          safeText(p.name) ||
          safeText(p.payment_name) ||
          safeText(p.payment_method_name) ||
          safeText(p.method_name) ||
          safeText(p.description) ||
          safeText(p.label) ||
          'PAGAMENTO';

        const valor =
          p.amount ??
          p.value ??
          p.valor ??
          p.total ??
          null;

        if (valor != null && valor !== '') {
          return `${nome} - R$ ${formatMoneyBR(valor)}`;
        }

        return nome;
      }).filter(Boolean);

      if (partes.length) {
        paymentText = partes.join(' | ');
      }
    }

    if (!paymentText) {
      const paymentParts = [
        safeText(header.payment_form_name),
        safeText(header.payment_term_name),
      ].filter(Boolean);

      if (paymentParts.length) {
        paymentText = paymentParts.join(' | ');
      }
    }

    const orderPayments =
      Array.isArray(out.payments) ? out.payments : [];

    const orderInstallments =
      Array.isArray(out.installments)
        ? out.installments
        : [];

    const orderDuplicatas =
      Array.isArray(out.duplicatas)
        ? out.duplicatas
        : [];

    const orderShipping =
      out.shipping ||
      out.header?.shipping ||
      header.shipping ||
      null;

    console.log('================ SHIPPING DEBUG ================');
    console.log('[DANFE][CTRL] out.shipping =', out.shipping);
    console.log('[DANFE][CTRL] header.shipping =', header.shipping);
    console.log('[DANFE][CTRL] FINAL orderShipping =', orderShipping);
    console.log('===============================================');

    console.log('[DANFE][CTRL] statusDb =', header.nfe_status);
    console.log('[DANFE][CTRL] paymentText =', paymentText);
    console.log('[DANFE][CTRL] orderPayments =', orderPayments);
    console.log('[DANFE][CTRL] orderInstallments =', orderInstallments);
    console.log('[DANFE][CTRL] orderDuplicatas =', orderDuplicatas);

    console.log('[DANFE][CTRL] CALLING generateDanfeFromXml...');

    const { buffer, filename } =
      await generateDanfeFromXml({
        xmlContent,
        prot,
        paymentText,

        complementaryInfo:
          header.complementary_info ||
          header.notes ||
          null,

        orderItems:
          Array.isArray(out.items)
            ? out.items
            : [],

        orderPayments,
        orderInstallments,
        orderDuplicatas,

        orderShipping,

        numero:
          header.nfe_number ||
          header.nfe_numero ||
          null,

        serie:
          header.nfe_serie ||
          header.serie ||
          '1',

        chave:
          header.nfe_key ||
          header.nfe_chave ||
          '',
      });

    console.log('[DANFE][CTRL] DANFE GENERATED SUCCESS');

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename || `danfe-${id}.pdf`}"`
    );

    return res.send(buffer);

  } catch (err) {
    reportOrdersError('================ DANFE ERROR ================');
    reportOrdersError(err);
    reportOrdersError('=============================================');

    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
}

export async function returnToBudget(req, res) {
  try {
    const id = Number(req.params.id);
    const out = await ordersApi.returnToBudget(id);

    if (!out?.ok) {
      const msg = out?.error || 'Falha ao retornar pedido para orçamento';
      const code =
        msg === 'NOT_FOUND' ? 404 :
          /bloqueada/i.test(msg) ? 409 :
            /vinculado/i.test(msg) ? 409 :
              400;

      return res.status(code).json({ ok: false, error: msg });
    }

    return res.json(out);
  } catch (err) {
    reportOrdersError('[ordersController.returnToBudget] ERR:', err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}

// ======================================================================
// ITENS DO PEDIDO — usado pelo modal Products Logistics
// GET /api/orders/:id/items
// ======================================================================
export async function listOrderItems(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    // ✅ usa o motor existente (header + items)
    const out = await ordersApi.getById(id);
    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json({ ok: false, error: out?.error || 'NOT_FOUND' });
    }

    const items = Array.isArray(out.items) ? out.items : [];

    // ✅ Normaliza campos para o modal (não quebra se nomes mudarem)
    const norm = (it) => ({
      product_code:
        it.product_code ??
        it.sku ??
        it.productCode ??
        it.code ??
        '',

      product_name:
        it.product_name ??
        it.description ??
        it.name ??
        it.productName ??
        '—',

      quantity:
        Number(
          it.quantity ??
          it.qtd ??
          it.qty ??
          it.amount ??
          0
        ) || 0,

      unit:
        it.unit ??
        it.unidade ??
        it.um ??
        it.uom ??
        'UN',
    });

    const rows = items.map(norm).filter(x => String(x.product_code || '').trim());

    return res.json({ ok: true, data: rows });
  } catch (err) {
    reportOrdersError('[listOrderItems] EXC:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

function companyData() {
  return {
    name: 'LLV SOLUCOES COMERCIAIS LTDA',
    cnpj: '68.123.137/0001-77',
    addressLine: 'RUA ARISTIDES NOGUEIRA DE OLIVEIRA, 62 - N SRA DO ROSARIO',
    contacts: 'MATHEUS LEME - MG - CEP 35670-000',
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

async function loadOrderForSeparationPdf(orderId) {
  const out = await ordersApi.getById(orderId);

  if (!out?.ok) return null;

  const header = out.header || {};
  const customer = out.customer || {};
  const itemsRaw = Array.isArray(out.items) ? out.items : [];

  const normalizedItems = [];

  for (const item of itemsRaw) {
    const sku = String(
      firstNonEmpty(
        item.sku,
        item.product_code,
        item.product_sku,
        item.code
      ) || ''
    ).trim();

    let location = firstNonEmpty(
      item.location,
      item.localizacao,
      item.addressing,
      item.endereco_estoque,
      item.stock_location
    );

    let lotCode = firstNonEmpty(
      item.lot_code,
      item.lote,
      item.batch,
      item.batch_code
    );

    /*
     * Tenta enriquecer o lote quando o getById não trouxe.
     *
     * ATENÇÃO — esta consulta estava quebrada e falhava SEMPRE (o catch
     * escondia o erro), de modo que o PDF de separação saía sem lote.
     * Referenciava colunas que não existem no schema (verificado em
     * 16/09/2026): psl.id (a PK é lot_id), psl.codigo_lote, oi.id (é
     * order_item_id), ps.sku e ps.location.
     *
     * A localização NÃO é mais obtida aqui: public."productsStock" tem
     * apenas product_stock_id, stock_qty, stock_min, stock_max e as datas —
     * não existe coluna de localização. No banco inteiro o único `location`
     * está em public."productsBoxes". Reintroduzir a localização exige
     * decidir a regra de negócio (caixa? corredor/prateleira de
     * locationsBarCode?), então segue valendo o que vier do getById.
     */
    if (sku && !lotCode) {
      try {
        const extra = await pool.query(
          `
          SELECT COALESCE(psl.lot_code, '') AS lot_code
          FROM public."orderItems" oi
          LEFT JOIN public."productsStockLots" psl
            ON psl.lot_id = oi.lot_id
          WHERE oi.order_id = $1
            AND oi.sku = $2
          ORDER BY oi.order_item_id ASC
          LIMIT 1
          `,
          [orderId, sku]
        );

        const row = extra.rows?.[0];
        if (row) {
          lotCode = lotCode || row.lot_code || '';
        }
      } catch (err) {
        console.warn('[loadOrderForSeparationPdf] WARN extra stock data:', err?.message || err);
      }
    }

    normalizedItems.push({
      order_item_id: firstNonEmpty(item.order_item_id, item.id, item.item_id),
      sku,
      description: firstNonEmpty(
        item.description,
        item.descricao,
        item.product_name,
        item.nome,
        item.name
      ) || '',
      unit: firstNonEmpty(
        item.unit,
        item.unidade,
        item.um,
        item.uom
      ) || '',
      quantity: Number(firstNonEmpty(
        item.quantity,
        item.quantidade,
        item.qty
      ) || 0),
      unit_price: Number(firstNonEmpty(
        item.unit_price,
        item.valor_unitario,
        item.price
      ) || 0),
      total: Number(firstNonEmpty(
        item.total,
        item.total_amount,
        item.valor_total
      ) || 0),

      image_path: firstNonEmpty(
        item.image_path,
        item.imagem_path,
        item.product_image_path
      ) || '',

      image_url: firstNonEmpty(
        item.image_url,
        item.imagem_url,
        item.product_image_url
      ) || '',

      location: location || '',
      lot_code: lotCode || '',
      status_separacao: firstNonEmpty(
        item.status_separacao,
        item.pick_status
      ) || 'PENDENTE',
    });
  }

  return {
    order_id: firstNonEmpty(header.id, header.order_id, header.number, orderId),
    number: firstNonEmpty(header.number, header.order_number, header.id, orderId),
    created_at: firstNonEmpty(header.created_at, header.createdAt),
    issue_date: firstNonEmpty(header.issue_date, header.date, header.created_at),
    total_amount: Number(firstNonEmpty(
      header.total_amount,
      header.total,
      header.valor_total
    ) || 0),
    status: firstNonEmpty(header.status, header.order_status) || '',
    notes: firstNonEmpty(
      header.notes,
      header.complementary_info,
      header.observacoes
    ) || '',

    customer_name: firstNonEmpty(
      customer.nome_razao_social,
      customer.customer_name,
      customer.nome_fantasia,
      customer.name,
      header.customer_name,
      header.cliente_nome,
      header.nome_cliente
    ) || '',

    customer_tax_id: firstNonEmpty(
      customer.cnpj_cpf,
      customer.customer_tax_id,
      customer.documento,
      customer.cpf_cnpj,
      header.cnpj_cpf,
      header.customer_document,
      header.customer_tax_id
    ) || '',

    seller_name: firstNonEmpty(
      header.seller_name,
      header.vendedor,
      header.nome_vendedor
    ) || '',

    items: normalizedItems,
  };
}

export async function downloadOrderSeparationPdf(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID do pedido inválido.',
      });
    }

    const order = await loadOrderForSeparationPdf(id);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: 'Pedido não encontrado.',
      });
    }

    await generateOrderSeparationPdf(order, {
      output: 'response',
      res,
      company: companyData(),
    });
  } catch (error) {
    reportOrdersError('[downloadOrderSeparationPdf] erro:', error);

    if (res.headersSent) {
      return res.destroy(error);
    }

    return res.status(500).json({
      ok: false,
      error: 'Falha ao gerar PDF de separação do pedido.',
      details: error?.message || String(error),
    });
  }
}
