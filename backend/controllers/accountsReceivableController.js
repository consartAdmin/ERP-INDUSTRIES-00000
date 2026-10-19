// ╔══════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableController.js — Controller REST                ║
// ║ CONSART ERP — /api/accounts-receivable                           ║
// ║                                                                  ║
// ║ ✅ Download direto de boleto (1 clique)                           ║
// ║ ✅ Força Content-Disposition: attachment                          ║
// ║ ✅ Compatível com Asaas                                           ║
// ║ ✅ Coluna "Banco" (account_bank) no Excel                         ║
// ║ ✅ Filtro "Conta Bancária" (bankAccountId) na lista e exports     ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

import path from 'node:path';
import fs from 'node:fs';

import {
  listAccountsReceivable,
  getById,
  createAccount,
  updateAccount,
  updateBoletoValueAndDueDate,
  receivePayment,
  syncFromAsaas,
  cancelAsaasBoleto,
  updateBoletoLocalInfo,
  listCashCategories,
  listCashSubcategories,
  listCashDocumentTypes,
  listChartOfAccounts,
  listBankAccounts,
} from '../repositories/accountsReceivable/accountsReceivable.index.js';

import { getBoletoPdf } from '../repositories/asaas/asaas.index.js';
import { generateAccountsReceivablePdf } from '../generationPdf/generationAccountsReceivablePdf.js';

import ExcelJS from 'exceljs';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function boom(res, err, ctx = 'ACCOUNTS-RECEIVABLE') {
  console.error(`[${ctx}]`, err);
  return res.status(500).json({
    ok: false,
    message: 'Erro interno ao processar contas a receber.',
    error: err?.message || String(err),
  });
}

function safeFileName(name) {
  return String(name || 'boleto.pdf')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBoleto(row) {
  const bt = String(row?.billing_type || row?.billingType || '').toUpperCase();
  if (bt === 'BOLETO') return true;

  const hasLocal = String(row?.boleto_pdf_url_local || '').trim();
  if (hasLocal) return true;

  const hasSlip = String(row?.bank_slip_url || '').trim();
  if (hasSlip) return true;

  return false;
}

/* ------------------------------------------------------------------ */
/* LIST                                                               */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable
export async function list(req, res) {
  try {
    const {
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      page,
      pageSize,
      orderBy,
      orderDirection,
    } = req.query;

    const result = await listAccountsReceivable({
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      page,
      pageSize,
      orderBy,
      orderDirection,
    });

    return res.json({
      ok: true,
      items: result.data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.pages,
    });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/LIST');
  }
}

/* ------------------------------------------------------------------ */
/* GET ONE                                                            */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable/:id
export async function getOne(req, res) {
  try {
    const { id } = req.params;
    const row = await getById(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Conta não encontrada.',
      });
    }

    return res.json(row);
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/GET');
  }
}

/* ------------------------------------------------------------------ */
/* CREATE                                                             */
/* ------------------------------------------------------------------ */

// POST /api/accounts-receivable
export async function create(req, res) {
  try {
    const payload = req.body || {};

    if (!payload.customer_id || !payload.due_date || !payload.value) {
      return res.status(400).json({
        ok: false,
        message: 'Preencha Cliente, Vencimento e Valor.',
      });
    }

    const row = await createAccount(payload);
    return res.status(201).json({ ok: true, data: row });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/CREATE');
  }
}

/* ------------------------------------------------------------------ */
/* UPDATE                                                             */
/* ------------------------------------------------------------------ */

// PUT /api/accounts-receivable/:id
export async function update(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const row = await updateAccount(id, payload);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Conta não encontrada.',
      });
    }

    return res.json({ ok: true, data: row });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/UPDATE');
  }
}

/* ------------------------------------------------------------------ */
/* RECEIVE PAYMENT                                                    */
/* ------------------------------------------------------------------ */

// POST /api/accounts-receivable/:id/receive
export async function receive(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const row = await receivePayment(id, payload);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Conta não encontrada.',
      });
    }

    return res.json({
      ok: true,
      message: 'Recebimento registrado.',
      data: row,
    });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/RECEIVE');
  }
}

/* ------------------------------------------------------------------ */
/* SYNC ASAAS                                                         */
/* ------------------------------------------------------------------ */

// POST /api/accounts-receivable/sync-asaas
export async function syncAsaasHandler(req, res) {
  // ?stream=1 → NDJSON: uma linha por evento de progresso e, no fim,
  // { type: 'done', result } (ou { type: 'error', message }).
  if (String(req.query?.stream) === '1') {
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };

    try {
      const result = await syncFromAsaas({ onProgress: send });
      send({ type: 'done', result });
    } catch (err) {
      console.error('[ACCOUNTS-RECEIVABLE/SYNC-ASAAS][STREAM]', err);
      send({ type: 'error', message: err?.message || 'Falha ao sincronizar com o Asaas.' });
    }

    return res.end();
  }

  try {
    // Sincroniza só as contas Asaas em aberto (Pendente/Vencido); filtros da tela não se aplicam.
    const result = await syncFromAsaas();
    return res.json(result);
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/SYNC-ASAAS');
  }
}

/* ------------------------------------------------------------------ */
/* BOLETO — DOWNLOAD DIRETO (1 CLIQUE)                                */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable/:id/boleto
export async function downloadBoleto(req, res) {
  try {
    const { id } = req.params;

    // 1) Busca a conta no banco
    const row = await getById(id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Conta não encontrada.',
      });
    }

    if (!isBoleto(row)) {
      return res.status(400).json({
        ok: false,
        message: 'Esta conta não é do tipo BOLETO.',
      });
    }

    // 2) Descobre o paymentId do Asaas e o arquivo local (se já existir)
    const paymentId =
      row?.asaas_payment_id ||
      row?.asaasPaymentId ||
      row?.payment_id ||
      row?.paymentId ||
      null;

    const localUrl =
      row?.boleto_pdf_url_local ||
      row?.boletoPdfUrlLocal ||
      row?.boleto_url_local ||
      null;

    const localAbs =
      row?.boleto_pdf_abs_path ||
      row?.boletoPdfAbsPath ||
      row?.boleto_abs_path ||
      null;

    if (!paymentId) {
      return res.status(400).json({
        ok: false,
        message: 'Esta conta não possui asaas_payment_id para baixar o boleto.',
      });
    }

    // 3) Resolve o PDF (local → fallback Asaas → salva em /public/boletos)
    const result = await getBoletoPdf({
      paymentId,
      boleto_pdf_url_local: localUrl,
      boleto_pdf_abs_path: localAbs,
      logger: console,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({
        ok: false,
        message: 'Não foi possível obter o boleto.',
        error: result.error,
      });
    }

    const absPath = result.absPath;

    // Segurança extra
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({
        ok: false,
        message: 'Arquivo do boleto não encontrado no servidor.',
      });
    }

    // 4) Se o fallback baixou agora, atualiza a conta com os novos campos locais
    // (evita baixar de novo na próxima vez)
    try {
      const needUpdate =
        (result.urlLocal && result.urlLocal !== localUrl) ||
        (result.absPath && result.absPath !== localAbs);

      if (needUpdate && typeof updateBoletoLocalInfo === 'function') {
        await updateBoletoLocalInfo(id, {
          boleto_pdf_url_local: result.urlLocal || null,
          boleto_pdf_abs_path: result.absPath || null,
        });
      }
    } catch (e) {
      console.warn('[ACCOUNTS-RECEIVABLE/BOLETO] Falha ao atualizar info local do boleto:', e?.message || e);
    }

    // 5) Nome do arquivo:
    // BOLETO + Nº NF-e + Cliente
    const invoiceNumber = String(
      row?.invoice_number ||
      row?.document_number ||
      paymentId
    ).trim();

    const customerName = String(
      row?.customer_name ||
      'CLIENTE'
    ).trim();

    const fileName = safeFileName(
      `BOLETO ${invoiceNumber} ${customerName}.pdf`
    );

    // 6) Força download (1 clique)
    // res.download define Content-Disposition: attachment
    return res.download(absPath, fileName);
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/BOLETO');
  }
}

/* ------------------------------------------------------------------ */
/* BOLETO — ATUALIZAR VENCIMENTO E VALOR                              */
/* ------------------------------------------------------------------ */

// PATCH /api/accounts-receivable/:id/boleto
export async function updateBoleto(req, res) {
  try {
    const { id } = req.params;

    const {
      due_date,
      value,
    } = req.body || {};

    const normalizedId = Number(id);
    const normalizedValue = Number(value);

    if (
      !Number.isInteger(normalizedId) ||
      normalizedId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: 'ID da conta a receber inválido.',
      });
    }

    if (
      !due_date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(due_date))
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Informe um vencimento válido.',
      });
    }

    if (
      !Number.isFinite(normalizedValue) ||
      normalizedValue <= 0
    ) {
      return res.status(400).json({
        ok: false,
        message: 'Informe um valor maior que zero.',
      });
    }

    const result =
      await updateBoletoValueAndDueDate(
        normalizedId,
        {
          due_date: String(due_date),
          value: normalizedValue,
        }
      );

    return res.json({
      ok: true,
      message:
        'Vencimento e valor do boleto atualizados com sucesso.',
      data: result,
    });
  } catch (err) {
    const statusCode =
      Number(err?.statusCode || err?.status) || 500;

    console.error(
      '[ACCOUNTS-RECEIVABLE/UPDATE-BOLETO]',
      err
    );

    return res.status(
      statusCode >= 400 && statusCode <= 599
        ? statusCode
        : 500
    ).json({
      ok: false,
      message:
        err?.message ||
        'Não foi possível atualizar o boleto.',
    });
  }
}

/* ------------------------------------------------------------------ */
/* CANCEL ASAAS BOLETO                                                */
/* ------------------------------------------------------------------ */

// DELETE /api/accounts-receivable/:id/boleto
export async function cancelBoleto(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const result = await cancelAsaasBoleto(id, { reason });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      ok: false,
      message: 'Não foi possível cancelar o boleto.',
      error: err?.message || String(err),
    });
  }
}

/* ------------------------------------------------------------------ */
/* EXPORT PDF                                                         */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable/export/pdf
export async function exportPdf(req, res) {
  try {
    const {
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      orderBy = 'created_at',
      orderDirection = 'desc',
    } = req.query;

    const result = await listAccountsReceivable({
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      orderBy,
      orderDirection,
      page: 1,
      pageSize: 20000,
    });

    // Cada linha já inclui account_bank (nome do banco).
    const items = result.data || [];
    const pdf = await generateAccountsReceivablePdf({
      rows: items,
      filters: {
        status,
        search,
        bankAccountId,
        dateType,
        fromDate,
        toDate,
        fromIssueDate,
        toIssueDate,
        fromDueDate,
        toDueDate,
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="contas-a-receber.pdf"'
    );
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(pdf);
  } catch (err) {
    return boom(res, err, 'EXPORT-PDF');
  }
}

/* ------------------------------------------------------------------ */
/* EXPORT EXCEL                                                       */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable/export/excel
export async function exportExcel(req, res) {
  try {
    const {
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      orderBy = 'created_at',
      orderDirection = 'desc',
    } = req.query;

    // pega TODOS os registros (sem paginação), na mesma ordem da tela
    const result = await listAccountsReceivable({
      status,
      search,
      bankAccountId,
      dateType,
      fromDate,
      toDate,
      fromIssueDate,
      toIssueDate,
      fromDueDate,
      toDueDate,
      orderBy,
      orderDirection,
      page: 1,
      pageSize: 10000, // ou mais se quiser
    });

    const items = result.data || [];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contas a Receber');

    // 🔹 Cabeçalhos
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Banco', key: 'banco', width: 20 },
      { header: 'Fatura', key: 'fatura', width: 20 },
      { header: 'Emissão', key: 'emissao', width: 15 },
      { header: 'Vencimento', key: 'vencimento', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Valor', key: 'valor', width: 15 },
      { header: 'Recebido', key: 'recebido', width: 15 },
      { header: 'Saldo', key: 'saldo', width: 15 },
    ];

    // 🔹 Dados
    for (const item of items) {
      const saldo = Number(item.value || 0) - Number(item.paid_value || 0);

      worksheet.addRow({
        id: item.id,
        cliente: item.customer_name,
        banco: item.account_bank || '',
        fatura: item.invoice_number,
        emissao: item.issue_date,
        vencimento: item.due_date,
        status: item.status,
        valor: item.value,
        recebido: item.paid_value,
        saldo: saldo,
      });
    }

    // 🔹 Estilo header
    worksheet.getRow(1).font = { bold: true };

    // 🔹 Download
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=contas_receber.xlsx'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    return boom(res, err, 'EXPORT-EXCEL');
  }
}

/* ------------------------------------------------------------------ */
/* CATEGORIAS E SUBCATEGORIAS DO CAIXA                               */
/* ------------------------------------------------------------------ */

// GET /api/accounts-receivable/cash-categories
export async function cashCategories(req, res) {
  try {
    const rows = await listCashCategories();
    return res.json({ ok: true, items: rows });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/CASH-CATEGORIES');
  }
}

// GET /api/accounts-receivable/cash-subcategories?category_id=1
export async function cashSubcategories(req, res) {
  try {
    const rows = await listCashSubcategories({
      categoryId: req.query.category_id,
    });

    return res.json({ ok: true, items: rows });
  } catch (err) {
    if (err?.message === 'category_id inválido.') {
      return res.status(400).json({ ok: false, message: err.message });
    }

    return boom(res, err, 'ACCOUNTS-RECEIVABLE/CASH-SUBCATEGORIES');
  }
}

// GET /api/accounts-receivable/cash-document-types
export async function cashDocumentTypes(req, res) {
  try {
    const rows = await listCashDocumentTypes();
    return res.json({ ok: true, items: rows });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/CASH-DOCUMENT-TYPES');
  }
}

// GET /api/accounts-receivable/bank-accounts
export async function bankAccounts(req, res) {
  try {
    const rows = await listBankAccounts();
    return res.json({ ok: true, items: rows });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/BANK-ACCOUNTS');
  }
}

// GET /api/accounts-receivable/chart-of-accounts
export async function chartOfAccounts(req, res) {
  try {
    const rows = await listChartOfAccounts();
    return res.json({ ok: true, items: rows });
  } catch (err) {
    return boom(res, err, 'ACCOUNTS-RECEIVABLE/CHART-OF-ACCOUNTS');
  }
}