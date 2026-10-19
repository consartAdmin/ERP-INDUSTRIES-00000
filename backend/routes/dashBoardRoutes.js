// ╔══════════════════════════════════════════════════════════════════╗
// ║ dashBoardRoutes.js — Rotas de KPIs / Dashboards da Home         ║
// ║ KPI: vendas, receber, pagar, inadimplências, NFC-e              ║
// ╚══════════════════════════════════════════════════════════════════╝

import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

/* Utilitário: ano/mês atuais */
function hojeYM() {
  const now = new Date();
  return {
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  };
}

function dataIsoValida(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
    ? text
    : '';
}

function periodoMesAtual() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function resolverPeriodo(req) {
  const defaults = periodoMesAtual();
  const startDate = dataIsoValida(req.query?.startDate) || defaults.startDate;
  const endDate = dataIsoValida(req.query?.endDate) || defaults.endDate;

  if (startDate > endDate) {
    const error = new Error('A data inicial não pode ser maior que a data final.');
    error.status = 400;
    throw error;
  }

  return { startDate, endDate };
}

// Status de NF-e que NÃO entram na venda
const NFE_EXCLUIR = [
  'CANCELADO',
  'CANCELADA',
  'CANCELLED',
  'DENIED',
  'REJEITADO',
  'REJEITADA',
  'REJECTED',
];

/* ----------------------------------------------------------------------
 * TOTAL À RECEBER DO DIA
 * ------------------------------------------------------------------- */
router.get('/total-receber-dia', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(value - COALESCE(amount_paid, 0)), 0) AS valor
      FROM public."accountsReceivable"
      WHERE due_date = CURRENT_DATE
        AND status IN ('PENDING', 'OVERDUE', 'PARTIAL')
    `);
    return res.json({ ok: true, valor: rows[0]?.valor || 0 });
  } catch (err) {
    console.error('[DASHBOARD] total-receber-dia error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao calcular Total à Receber do dia' });
  }
});

/* ----------------------------------------------------------------------
 * TOTAL À PAGAR DO DIA
 * ------------------------------------------------------------------- */
router.get('/total-pagar-dia', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(total_value - COALESCE(amount_paid, 0)), 0) AS valor
      FROM public."accountsPayable"
      WHERE due_date = CURRENT_DATE
        AND status IN ('PENDING', 'OVERDUE', 'PARTIAL')
    `);
    return res.json({ ok: true, valor: rows[0]?.valor || 0 });
  } catch (err) {
    console.error('[DASHBOARD] total-pagar-dia error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao calcular Total à Pagar do dia' });
  }
});

/* TOTAL GERAL EM ABERTO — RECEBER */
router.get('/total-receber', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(GREATEST(value - COALESCE(amount_paid, 0), 0)), 0) AS valor,
        COUNT(*)::int AS quantidade
      FROM public."accountsReceivable"
      WHERE UPPER(COALESCE(status, '')) IN ('PENDING', 'OVERDUE', 'PARTIAL')
        AND GREATEST(value - COALESCE(amount_paid, 0), 0) > 0
    `);
    return res.json({
      ok: true,
      valor: Number(rows[0]?.valor || 0),
      quantidade: Number(rows[0]?.quantidade || 0),
    });
  } catch (err) {
    console.error('[DASHBOARD] total-receber error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao calcular Total à Receber' });
  }
});

/* TOTAL GERAL EM ABERTO — PAGAR */
router.get('/total-pagar', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(GREATEST(total_value - COALESCE(amount_paid, 0), 0)), 0) AS valor,
        COUNT(*)::int AS quantidade
      FROM public."accountsPayable"
      WHERE UPPER(COALESCE(status, '')) IN ('PENDING', 'OVERDUE', 'PARTIAL')
        AND GREATEST(total_value - COALESCE(amount_paid, 0), 0) > 0
    `);
    return res.json({
      ok: true,
      valor: Number(rows[0]?.valor || 0),
      quantidade: Number(rows[0]?.quantidade || 0),
    });
  } catch (err) {
    console.error('[DASHBOARD] total-pagar error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao calcular Total à Pagar' });
  }
});

/* ----------------------------------------------------------------------
 * FLUXO FINANCEIRO DIÁRIO — GRÁFICOS
 * ------------------------------------------------------------------- */
router.get('/fluxo-financeiro', async (req, res) => {
  try {
    const { startDate, endDate } = resolverPeriodo(req);

    const receivablesSql = `
      WITH days AS (
        SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS date
      ), expected AS (
        SELECT due_date::date AS date, COALESCE(SUM(value), 0)::numeric AS value
        FROM public."accountsReceivable"
        WHERE due_date BETWEEN $1::date AND $2::date
          AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'CANCELED')
        GROUP BY due_date::date
      ), settled AS (
        SELECT payment_date::date AS date, COALESCE(SUM(amount_paid), 0)::numeric AS value
        FROM public."accountsReceivable"
        WHERE payment_date BETWEEN $1::date AND $2::date
          AND COALESCE(amount_paid, 0) > 0
        GROUP BY payment_date::date
      )
      SELECT d.date, COALESCE(e.value, 0) AS expected, COALESCE(s.value, 0) AS settled
      FROM days d
      LEFT JOIN expected e ON e.date = d.date
      LEFT JOIN settled s ON s.date = d.date
      ORDER BY d.date
    `;

    const payablesSql = `
      WITH days AS (
        SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS date
      ), expected AS (
        SELECT due_date::date AS date, COALESCE(SUM(total_value), 0)::numeric AS value
        FROM public."accountsPayable"
        WHERE due_date BETWEEN $1::date AND $2::date
          AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED', 'CANCELED')
        GROUP BY due_date::date
      ), settled AS (
        SELECT payment_date::date AS date, COALESCE(SUM(amount_paid), 0)::numeric AS value
        FROM public."accountsPayable"
        WHERE payment_date BETWEEN $1::date AND $2::date
          AND COALESCE(amount_paid, 0) > 0
        GROUP BY payment_date::date
      )
      SELECT d.date, COALESCE(e.value, 0) AS expected, COALESCE(s.value, 0) AS settled
      FROM days d
      LEFT JOIN expected e ON e.date = d.date
      LEFT JOIN settled s ON s.date = d.date
      ORDER BY d.date
    `;

    const [receivablesResult, payablesResult] = await Promise.all([
      pool.query(receivablesSql, [startDate, endDate]),
      pool.query(payablesSql, [startDate, endDate]),
    ]);

    const normalizeRows = (rows) => rows.map((row) => ({
      date: row.date,
      expected: Number(row.expected || 0),
      settled: Number(row.settled || 0),
    }));

    return res.json({
      ok: true,
      period: { startDate, endDate },
      receivables: normalizeRows(receivablesResult.rows),
      payables: normalizeRows(payablesResult.rows),
    });
  } catch (err) {
    console.error('[DASHBOARD] fluxo-financeiro error:', err);
    return res.status(Number(err?.status) || 500).json({
      ok: false,
      error: err?.message || 'Erro ao carregar fluxo financeiro',
    });
  }
});

/* ----------------------------------------------------------------------
 * 1) VENDAS DO DIA
 *    • Fonte oficial: public."invoicesIssued"
 *    • Soma total_amount das NF-e emitidas no dia
 *    • Exclui canceladas/rejeitadas/denegadas
 * ------------------------------------------------------------------- */
router.get('/vendas-dia', async (req, res) => {
  try {
    const sql = `
      SELECT
        COALESCE(SUM(ii.total_amount), 0) AS valor,
        COUNT(*)::int AS quantidade
      FROM public."invoicesIssued" ii
      WHERE ii.issued_date = CURRENT_DATE
        AND ii.cancelled_at IS NULL
        AND COALESCE(ii.nfe_status, '') <> ALL($1::text[])
    `;

    const { rows } = await pool.query(sql, [NFE_EXCLUIR]);
    const row = rows[0] || {};

    return res.json({
      ok: true,
      valor: row.valor || 0,
      quantidade: Number(row.quantidade || 0),
    });
  } catch (err) {
    console.error('[DASHBOARD] vendas-dia error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao calcular vendas do dia' });
  }
});

/* ----------------------------------------------------------------------
 * 2) VENDAS DO MÊS
 *    • Fonte oficial: public."invoicesIssued"
 *    • Soma total_amount das NF-e emitidas no mês
 *    • Exclui canceladas/rejeitadas/denegadas
 * ------------------------------------------------------------------- */
router.get('/vendas-mes', async (req, res) => {
  try {
    const { ano, mes } = hojeYM();

    const sql = `
      SELECT
        COALESCE(SUM(ii.total_amount), 0) AS valor,
        COUNT(*)::int AS quantidade
      FROM public."invoicesIssued" ii
      WHERE EXTRACT(YEAR FROM ii.issued_date) = $1
        AND EXTRACT(MONTH FROM ii.issued_date) = $2
        AND ii.cancelled_at IS NULL
        AND COALESCE(ii.nfe_status, '') <> ALL($3::text[])
    `;

    const { rows } = await pool.query(sql, [ano, mes, NFE_EXCLUIR]);
    const row = rows[0] || {};

    return res.json({
      ok: true,
      valor: row.valor || 0,
      quantidade: Number(row.quantidade || 0),
    });
  } catch (err) {
    console.error('[DASHBOARD] vendas-mes error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao calcular vendas do mês' });
  }
});

/* ----------------------------------------------------------------------
 * 3) TOTAL À RECEBER DO MÊS (BRUTO PENDENTE)
 * ------------------------------------------------------------------- */
router.get('/total-receber-mes', async (req, res) => {
  try {
    const { ano, mes } = hojeYM();

    const sql = `
      SELECT 
        COALESCE(
          SUM(
            CASE 
              WHEN status IN ('PENDING','OVERDUE')
                THEN value
              ELSE 0
            END
          ),
        0) AS valor
      FROM public."accountsReceivable"
      WHERE EXTRACT(YEAR FROM due_date) = $1
        AND EXTRACT(MONTH FROM due_date) = $2
    `;

    const { rows } = await pool.query(sql, [ano, mes]);
    return res.json({ ok: true, valor: rows[0].valor });
  } catch (err) {
    console.error('[DASHBOARD] total-receber-mes error:', err);
    res.status(500).json({
      ok: false,
      error: 'Erro ao calcular Total à Receber do mês',
    });
  }
});

/* ----------------------------------------------------------------------
 * 4) TOTAL À PAGAR DO MÊS (Fornecedores)
 * ------------------------------------------------------------------- */
router.get('/total-pagar-mes', async (req, res) => {
  try {
    const { ano, mes } = hojeYM();

    const sql = `
      SELECT 
        COALESCE(
          SUM(
            CASE 
              WHEN status IN ('PENDING','OVERDUE') 
                THEN total_value - COALESCE(amount_paid, 0)
              ELSE 0
            END
          ),
        0) AS valor
      FROM public."accountsPayable"
      WHERE EXTRACT(YEAR FROM due_date) = $1
        AND EXTRACT(MONTH FROM due_date) = $2
    `;

    const { rows } = await pool.query(sql, [ano, mes]);
    return res.json({ ok: true, valor: rows[0].valor });
  } catch (err) {
    console.error('[DASHBOARD] total-pagar-mes error:', err);
    res.status(500).json({
      ok: false,
      error: 'Erro ao calcular Total à Pagar do mês',
    });
  }
});

/* ----------------------------------------------------------------------
 * 5) TOTAL INADIMPLÊNCIAS (Clientes)
 * ------------------------------------------------------------------- */
router.get('/inadimplencia', async (req, res) => {
  try {
    const sql = `
      SELECT
        COALESCE(SUM(value), 0) AS total_aberto,
        COUNT(*)                AS titulos_abertos
      FROM public."accountsReceivable"
      WHERE status = 'OVERDUE'
    `;

    const { rows } = await pool.query(sql);
    const row = rows[0] || {};

    const totalAberto = Number(row.total_aberto) || 0;
    const titulosAbertos = Number(row.titulos_abertos) || 0;

    return res.json({
      ok: true,
      totalAberto,
      titulosAbertos,
    });
  } catch (err) {
    console.error('[DASHBOARD][INADIMPLENCIA]', err);
    return res.status(500).json({
      ok: false,
      message: 'Erro ao calcular Total Inadimplências',
      error: err.message,
    });
  }
});

/* ----------------------------------------------------------------------
 * 6) INADIMPLÊNCIA DESPESAS (Fornecedores)
 * ------------------------------------------------------------------- */
router.get('/inadimplencia-despesas', async (req, res) => {
  try {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('OVERDUE')) AS atrasados,
        COUNT(*) AS total
      FROM public."accountsPayable"
    `;

    const { rows } = await pool.query(sql);
    const atrasados = Number(rows[0].atrasados || 0);
    const total = Number(rows[0].total || 0);

    const perc = total > 0 ? (atrasados / total) * 100 : 0;

    return res.json({
      ok: true,
      percentual: perc,
      titulosEmAtraso: atrasados,
    });
  } catch (err) {
    console.error('[DASHBOARD] inadimplencia-despesas error:', err);
    res.status(500).json({
      ok: false,
      error: 'Erro ao calcular inadimplência de despesas',
    });
  }
});

/* ----------------------------------------------------------------------
 * 7) KPI NFC-e — Total do mês (somente AUTORIZADA)
 * ------------------------------------------------------------------- */
router.get('/nfce-mes', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        COALESCE(SUM(recebido - COALESCE(troco, 0)), 0) AS total,
        COUNT(*)::int AS quantidade
      FROM public."pdvSales"
      WHERE nfce_status = 'AUTORIZADA'
        AND created_at >= date_trunc('month', now())
        AND created_at <  (date_trunc('month', now()) + INTERVAL '1 month');
      `
    );

    const row = rows[0] || { total: 0, quantidade: 0 };
    res.json(row);
  } catch (err) {
    console.error('[dashboard] /nfce-mes erro:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/* ----------------------------------------------------------------------
 * 8) KPI NFC-e — Total do dia (somente AUTORIZADA)
 * ------------------------------------------------------------------- */
router.get('/nfce-dia', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        COALESCE(SUM(recebido - COALESCE(troco, 0)), 0) AS total,
        COUNT(*)::int AS quantidade
      FROM public."pdvSales"
      WHERE nfce_status = 'AUTORIZADA'
        AND DATE(created_at) = CURRENT_DATE;
      `
    );

    const row = rows[0] || { total: 0, quantidade: 0 };
    res.json(row);
  } catch (err) {
    console.error('[dashboard] /nfce-dia erro:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/* ----------------------------------------------------------------------
 * 12) ALERTA DE ESTOQUE ABAIXO DO MÍNIMO
 * ------------------------------------------------------------------- */
router.get('/stock-alerts', async (req, res) => {
  try {
    const sql = `
      SELECT
        ps.product_stock_id,
        p.product_id,
        p.product_code,
        p.description,

        COALESCE(ps.stock_qty, 0) AS current_qty,
        COALESCE(ps.stock_min, 0) AS stock_min,
        COALESCE(ps.stock_max, 0) AS stock_max,

        (
          COALESCE(ps.stock_min, 0)
          -
          COALESCE(ps.stock_qty, 0)
        ) AS replenish_needed

      FROM public."products" p
      JOIN public."productsStock" ps
        ON p.product_stock_id = ps.product_stock_id

      WHERE
        COALESCE(ps.stock_qty, 0)
          < COALESCE(ps.stock_min, 0)

      ORDER BY
        replenish_needed DESC,
        p.description ASC

      LIMIT 20;
    `;

    const { rows } = await pool.query(sql);

    return res.json({
      ok: true,
      count: rows.length,
      alerts: rows
    });

  } catch (err) {
    console.error(
      '[DASHBOARD] stock-alerts error:',
      err
    );

    return res.status(500).json({
      ok: false,
      error: 'Erro ao carregar alertas de estoque'
    });
  }
});

export default router;
