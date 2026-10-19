// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ 📂 ordersKanbanController.js – Controller do Kanban de Pedidos (CONSART)  ║
// ║ Usa o DAL em services/apis/ordersKanbanApi.js                              ║
// ║ ✅ PDF isolado: generationPdf/generationOrdersKanbanPdf.js                 ║
// ║ ✅ Normalização robusta de filtros                                         ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as kanbanApi from '../repositories/ordersKanban/ordersKanban.index.js';
import pool from '../config/db.js';

import { generateOrdersKanbanPendingsPdf } from '../generationPdf/generationOrdersKanbanPdf.js';

import { generateOrderSeparationPdf } from '../generationPdf/generationOrdersSeparationPdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 🔤 Normalização
// ============================================================================
const norm = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * UI pode mandar: "abertas", "somente abertas", "pendentes", "open", etc.
 * API/DAL espera: "todas" | "pendentes" | "concluidas"
 */
const normalizePendenciasParam = (value) => {
  const v = norm(value || 'todas');

  // abertas / pendentes
  if (
    v === 'abertas' ||
    v === 'aberta' ||
    v.includes('somente abertas') ||
    v.includes('abert') ||
    v.includes('pend') ||
    v === 'open' ||
    v.includes('open')
  ) {
    return 'pendentes';
  }

  // concluídas / finalizadas
  if (v.includes('concl') || v.includes('finaliz') || v.includes('comp') || v.includes('done')) {
    return 'concluidas';
  }

  return 'todas';
};

// ============================================================================
// 🩺 Healthcheck
// ============================================================================
export const health = async (_req, res) => {
  const started = Date.now();
  try {
    await kanbanApi.pingDb();
    return res.json({
      status: 'ok',
      db: true,
      uptime_ms: Date.now() - started,
      now: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ORDERS-KANBAN][HEALTH] Erro:', err);
    return res.status(500).json({
      status: 'degraded',
      db: false,
      error: err.message,
      uptime_ms: Date.now() - started,
      now: new Date().toISOString(),
    });
  }
};

// ============================================================================
// 📦 CARDS
// ============================================================================
export const listarCards = async (_req, res) => {
  try {
    const cards = await kanbanApi.listCards();
    res.json(cards);
  } catch (err) {
    console.error('[❌ ERRO LISTAR CARDS]', err);
    res.status(500).json({ erro: 'Erro ao listar cards de pedidos', detalhe: err.message });
  }
};

// PUT /api/orders-kanban/cards/:id  { customer_id, separation_number, note }
export const editarCard = async (req, res) => {
  const { id } = req.params;
  const { customer_id, separation_number, note } = req.body || {};

  try {
    const card = await kanbanApi.updateCard(Number(id), { customer_id, separation_number, note });
    if (!card) return res.status(404).json({ erro: 'Card não encontrado.' });
    return res.status(200).json(card);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ erro: err.message });
    console.error(`[KANBAN] ❌ Erro ao editar card ${id}:`, err);
    return res.status(500).json({ erro: 'Erro interno ao editar card.', detalhe: err.message });
  }
};

// POST /api/orders-kanban/cards/from-budget  { budget_id }
export const importarOrcamento = async (req, res) => {
  const budgetId = req.body?.budget_id;

  try {
    const card = await kanbanApi.createCardFromBudget(budgetId);
    return res.status(201).json(card);
  } catch (err) {
    if ([400, 404, 409].includes(err.statusCode)) {
      return res.status(err.statusCode).json({ erro: err.message });
    }
    console.error('[KANBAN] ❌ Erro ao importar orçamento:', err);
    return res.status(500).json({ erro: 'Erro interno ao importar orçamento.', detalhe: err.message });
  }
};

export const criarCard = async (req, res) => {
  const { cliente_id, customer_id, numero_separacao, separation_number, observacao, note, status } = req.body;

  try {
    const finalCustomerId = customer_id ?? cliente_id;
    const finalSeparation = separation_number ?? numero_separacao;
    const finalNote = note ?? observacao ?? '';

    if (!finalCustomerId || !status) {
      return res.status(400).json({ erro: 'Cliente e status são obrigatórios.' });
    }

    const card = await kanbanApi.createCard({
      customer_id: finalCustomerId,
      separation_number: finalSeparation,
      note: finalNote,
      status,
    });

    res.status(201).json(card);
  } catch (err) {
    console.error('[KANBAN] ❌ Erro ao criar card no banco:', err);
    res.status(500).json({ erro: 'Erro interno ao criar card.', detalhe: err.message });
  }
};

export const finalizarCard = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await kanbanApi.finishCard(Number(id));

    if (!result) {
      return res.status(404).json({
        ok: false,
        erro: 'Card não encontrado ou já finalizado.'
      });
    }

    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    console.error('[❌ ERRO] finalizarCard:', err);

    if (err.statusCode === 409 || err.code === 'CARD_HAS_OPEN_PENDINGS') {
      return res.status(409).json({
        ok: false,
        code: 'CARD_HAS_OPEN_PENDINGS',
        erro: err.message,
        openPendings: err.openPendings || 0
      });
    }

    return res.status(500).json({
      ok: false,
      erro: 'Erro ao finalizar card.',
      detalhe: err.message
    });
  }
};

export const contarFinalizados = async (req, res) => {
  const { period } = req.query;
  try {
    const total = await kanbanApi.countFinished({ period });
    res.json({ total });
  } catch (err) {
    console.error('[❌ ERRO] contarFinalizados:', err);
    res.status(500).json({ erro: 'Erro ao contar finalizados.' });
  }
};

export const excluirCard = async (req, res) => {
  const { id } = req.params;
  try {
    const ok = await kanbanApi.deleteCard(Number(id));
    if (!ok) return res.status(404).json({ erro: 'Card não encontrado.' });
    res.status(204).send();
  } catch (err) {
    console.error(`[❌ ERRO EXCLUIR CARD] ID ${id}:`, err);
    res.status(500).json({ erro: 'Erro ao excluir card' });
  }
};

export const atualizarColunaCard = async (req, res) => {
  const { id } = req.params;
  const { coluna_id, column_id } = req.body;

  try {
    const columnId = column_id ?? coluna_id;

    const moved = await kanbanApi.moveCardToColumn({
      cardId: Number(id),
      columnId: Number(columnId),
    });

    if (!moved) return res.status(404).json({ erro: 'Card ou coluna não encontrados.' });
    res.json(moved);
  } catch (err) {
    console.error(`[❌ ERRO MOVER CARD ID ${id}]`, err);
    res.status(500).json({ erro: 'Erro ao mover card', detalhe: err.message });
  }
};

export const atualizarUrgente = async (req, res) => {
  const { id } = req.params;
  const { urgente, is_urgent } = req.body;

  try {
    const result = await kanbanApi.setCardUrgent({
      cardId: Number(id),
      isUrgent: is_urgent ?? urgente,
    });
    if (!result) return res.status(404).json({ erro: 'Card não encontrado.' });
    res.json(result);
  } catch (err) {
    console.error('[❌ ERRO] atualizarUrgente:', err);
    res.status(500).json({ erro: 'Erro ao atualizar urgência.' });
  }
};

// ============================================================================
// 📊 COLUNAS / STATUS
// ============================================================================
export const listarStatus = async (_req, res) => {
  try {
    const colunas = await kanbanApi.listColumns();
    res.json(colunas);
  } catch (err) {
    console.error('[KANBAN] ❌ Erro ao buscar colunas:', err);
    res.status(500).json({ erro: 'Erro ao buscar colunas.' });
  }
};

export const listarColunasFiltro = async (_req, res) => {
  try {
    const colunas = await kanbanApi.listColumnsWithCounts();
    res.json(colunas);
  } catch (err) {
    console.error('[❌ ERRO] listarColunasFiltro:', err);
    res.status(500).json({ erro: 'Erro ao listar colunas' });
  }
};

// ============================================================================
// 📌 PENDÊNCIAS
// ============================================================================
export async function buscarPendenciasPorCard(req, res) {
  const cardId = Number(req.params.id);
  const pendencias = normalizePendenciasParam(req.query.pendencias);

  if (!cardId || Number.isNaN(cardId)) {
    return res.status(400).json({ ok: false, erro: 'ID do card inválido.' });
  }

  try {
    const pendings = await kanbanApi.getPendingsByCard(cardId, pendencias);
    return res.status(200).json({ ok: true, pendings, pendencias });
  } catch (err) {
    console.error('[❌ ERRO BUSCAR PENDÊNCIAS] Card', cardId, err);
    return res.status(500).json({ ok: false, erro: 'Erro ao buscar pendências', detalhe: err.message });
  }
}

export const concluirPendencia = async (req, res) => {
  const { id } = req.params;
  try {
    const pending = await kanbanApi.completePending(Number(id));
    if (!pending) return res.status(404).json({ erro: 'Pendência não encontrada.' });
    return res.status(200).json({ mensagem: 'Pendência concluída com sucesso.', pending });
  } catch (err) {
    console.error(`[❌ ERRO] ao concluir pendência ${id}:`, err);
    return res.status(500).json({ erro: 'Erro interno ao concluir pendência.' });
  }
};

// PATCH /api/orders-kanban/pendings/:id/reopen
export const reabrirPendencia = async (req, res) => {
  const { id } = req.params;
  try {
    const pending = await kanbanApi.reopenPending(Number(id));
    if (!pending) return res.status(404).json({ erro: 'Pendência não encontrada.' });
    return res.status(200).json({ mensagem: 'Pendência reaberta com sucesso.', pending });
  } catch (err) {
    console.error(`[❌ ERRO] ao reabrir pendência ${id}:`, err);
    return res.status(500).json({ erro: 'Erro interno ao reabrir pendência.' });
  }
};

// PUT /api/orders-kanban/pendings/:id
export const editarPendencia = async (req, res) => {
  const { id } = req.params;
  const { product_code, barcode_id, quantity, note } = req.body || {};

  try {
    const pending = await kanbanApi.updatePending(Number(id), {
      productCode: product_code,
      barcodeId: barcode_id,
      quantity,
      note,
    });
    if (!pending) {
      return res.status(404).json({ ok: false, erro: 'Pendência não encontrada ou já concluída.' });
    }
    return res.status(200).json({ ok: true, pending });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ ok: false, erro: err.message });
    }
    console.error(`[❌ ERRO] ao editar pendência ${id}:`, err);
    return res.status(500).json({ ok: false, erro: 'Erro interno ao editar pendência.', detalhe: err.message });
  }
};

export const excluirPendencia = async (req, res) => {
  const { id } = req.params;
  try {
    const ok = await kanbanApi.deletePending(Number(id));
    if (!ok) return res.status(404).json({ erro: 'Pendência não encontrada.' });
    return res.status(204).end();
  } catch (err) {
    console.error(`[❌ ERRO] ao excluir pendência ${id}:`, err);
    return res.status(500).json({ erro: 'Erro interno ao excluir pendência.', detalhe: err.message });
  }
};

// GET /api/orders-kanban/pendings/count?coluna_id=...&pendencias=abertas|pendentes|concluidas|todas
export const contarPendencias = async (req, res) => {
  try {
    const { coluna_id } = req.query;

    // ✅ normaliza igual você já faz em outros endpoints
    const pendenciasNorm = normalizePendenciasParam(req.query.pendencias || 'todas');
    // normalizePendenciasParam retorna: 'todas' | 'pendentes' | 'concluidas'

    const data = await kanbanApi.countPendings({
      columnId: coluna_id || null,
      pendenciasFilter: pendenciasNorm, // ✅ agora o DAL filtra certo
    });

    return res.json({ ok: true, ...data, pendencias: pendenciasNorm });
  } catch (err) {
    console.error('[❌ ERRO] contarPendencias:', err);
    return res.status(500).json({ ok: false, erro: 'Erro ao contar pendências', detalhe: err.message });
  }
};

// ============================================================================
// 🧾 PDF – Relatório de Pendências
// ============================================================================
export const gerarPdfTodasPendencias = async (req, res) => {
  try {
    const { coluna_id, coluna, status, status_nome, pendencias = 'todas' } = req.query;

    const filtroColunaId = coluna_id || coluna || null;
    const filtroStatusNome = status_nome || status || null;

    const pendenciasNorm = normalizePendenciasParam(pendencias);

    const pendingsRows = await kanbanApi.listPendingsWithContext({
      columnId: filtroColunaId,
      statusName: filtroStatusNome,
      pendenciasFilter: pendenciasNorm,
    });

    if (!pendingsRows.length) {
      return res.status(404).json({ erro: 'Nenhuma pendência encontrada para o filtro informado.' });
    }

    let filtroDesc = 'Todas';

    if (filtroColunaId) {
      const q = await pool.query('SELECT name FROM public."ordersKanbanColumns" WHERE column_id = $1', [filtroColunaId]);
      const nomeCol = q.rows[0]?.name;
      filtroDesc = nomeCol ? `Coluna: ${nomeCol}` : `Coluna #${filtroColunaId}`;
    } else if (filtroStatusNome) {
      filtroDesc = `Status: ${filtroStatusNome}`;
    }

    if (pendenciasNorm.startsWith('pend')) filtroDesc += ' • Pendências: abertas';
    else if (pendenciasNorm.startsWith('concl')) filtroDesc += ' • Pendências: concluídas';
    else filtroDesc += ' • Pendências: Todas';

    const marcaPath = path.join(__dirname, '../../public/imagens/marcaconsart.png');

    const { buffer, filename } = await generateOrdersKanbanPendingsPdf({
      rows: pendingsRows,
      filtroDesc,
      tz: 'America/Sao_Paulo',
      watermarkPath: marcaPath,
      company: {
        name: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
        cnpj: '34.363.337/0001-85',
        address: 'AV. BIAS FORTES 784, LOURDES – CEP 30.170-012',
        phones: '(31) 3566-0070 / (31) 3566-8888',
        email: 'vendas@bh3distribuidora.com.br',
        site: 'www.bh3distribuidora.com.br',
      },
    });

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return res.end(buffer);
  } catch (err) {
    console.error('[❌ ERRO PDF]', err);
    return res.status(500).json({ erro: 'Erro ao gerar PDF com todas as pendências.', detalhe: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/orders-kanban/cards/:id/pendings
// ---------------------------------------------------------------------------
export async function adicionarPendencia(req, res) {
  const cardId = Number(req.params.id);
  const { product_code, barcode_id, quantity, note, status } = req.body || {};

  if (!cardId || Number.isNaN(cardId)) {
    return res.status(400).json({ ok: false, erro: 'ID do card inválido.' });
  }

  if (!product_code || !quantity) {
    return res.status(400).json({ ok: false, erro: 'product_code e quantity são obrigatórios.' });
  }

  try {
    const pending = await kanbanApi.addPending({
      cardId,
      productCode: product_code,
      barcodeId: barcode_id,
      quantity,
      note,
      status,
    });
    return res.status(201).json({ ok: true, pending });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ ok: false, erro: err.message });
    }
    console.error('[❌ ERRO ADICIONAR PENDÊNCIA]', err);
    return res.status(500).json({ ok: false, erro: 'Erro ao adicionar pendência', detalhe: err.message });
  }
}

// ============================================================================
// 🧾 PDF – Separação do Pedido pelo Card
// ============================================================================
export const gerarPdfSeparacaoCard = async (req, res) => {
  const cardId = Number(req.params.id);

  if (!cardId || Number.isNaN(cardId)) {
    return res.status(400).json({ erro: 'ID do card inválido.' });
  }

  try {
    const cardQuery = await pool.query(
      `
      SELECT
        k.card_id,
        k.customer_id,
        k.separation_number,
        k.note,
        c.trade_name AS customer_name,
        c.legal_name AS customer_legal_name,
        c.tax_id AS customer_tax_id
      FROM public."ordersKanbanCards" k
      LEFT JOIN public.customers c
        ON c.customer_id = k.customer_id
      WHERE k.card_id = $1
      LIMIT 1
      `,
      [cardId]
    );

    const card = cardQuery.rows[0];

    if (!card) {
      return res.status(404).json({ erro: 'Card não encontrado.' });
    }

    const separationNumber = String(card.separation_number || '').trim();

    if (!separationNumber) {
      return res.status(400).json({
        erro: 'Este card não possui Nº Separação.',
      });
    }

    const orderQuery = await pool.query(
      `
      SELECT *
      FROM public."orders"
      WHERE
        CAST(order_id AS TEXT) = $1
        OR CAST(number AS TEXT) = $1
      ORDER BY order_id DESC
      LIMIT 1
      `,
      [separationNumber]
    );

    const order = orderQuery.rows[0];

    if (!order) {
      return res.status(404).json({
        erro: 'Pedido não encontrado para este card.',
        detalhe: `Nº Separação: ${separationNumber}`,
      });
    }

    const itemsQuery = await pool.query(
      `
      SELECT
        oi.*
      FROM public."orderItems" oi
      WHERE oi.order_id = $1
      ORDER BY oi.order_item_id ASC
      `,
      [order.order_id]
    );

    const orderForPdf = {
      ...order,
      customer_name:
        order.customer_name ||
        card.customer_name ||
        card.customer_legal_name ||
        'Cliente não informado',

      customer_tax_id:
        order.customer_tax_id ||
        card.customer_tax_id ||
        '',

      notes:
        order.notes ||
        order.observacoes ||
        order.observation ||
        card.note ||
        '',

      items: itemsQuery.rows,
    };

    return await generateOrderSeparationPdf(orderForPdf, {
      output: 'response',
      res,
      company: {
        name: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
        cnpj: '34.363.337/0001-85',
        address: 'AV. BIAS FORTES 784, LOURDES – CEP 30.170-012',
        phones: '(31) 3566-0070 / (31) 3566-8888',
        email: 'vendas@bh3distribuidora.com.br',
        site: 'www.bh3distribuidora.com.br',
      },
    });
  } catch (err) {
    console.error('[❌ ERRO PDF SEPARAÇÃO CARD]', err);
    return res.status(500).json({
      erro: 'Erro ao gerar PDF de separação do pedido.',
      detalhe: err.message,
    });
  }
};