// ╔══════════════════════════════════════════════════════════════════════╗
// ║ diagSalesCommissions.js — CONSART ERP (somente leitura)              ║
// ║ Mostra por que "Gerar Comissões" não encontra NF-e num período.      ║
// ║ node scripts/diagSalesCommissions.js 2026-10-01 2026-10-13           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import 'dotenv/config';
import pool from '../config/db.js';

const [dateStart = '2026-10-01', dateEnd = '2026-10-13'] = process.argv.slice(2);

const ISSUED = `COALESCE(
  NULLIF(to_jsonb(ii) ->> 'issued_date', '')::date,
  NULLIF(to_jsonb(ii) ->> 'issued_at', '')::timestamptz::date,
  NULLIF(to_jsonb(ii) ->> 'created_at', '')::timestamptz::date
)`;

async function show(title, sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    console.log(`\n=== ${title}`);
    console.table(rows);
  } catch (err) {
    console.log(`\n=== ${title}\nERRO: ${err.message}`);
  }
}

await show('NF-e emitidas no período (por origem e status)', `
  SELECT
    (ii.order_id IS NOT NULL) AS tem_pedido,
    (ii.budget_id IS NOT NULL) AS tem_orcamento,
    (ii.issued_date IS NOT NULL) AS tem_issued_date,
    (ii.cancelled_at IS NOT NULL) AS cancelada,
    COALESCE(ii.nfe_status, '(vazio)') AS nfe_status,
    COUNT(*) AS qtd
  FROM public."invoicesIssued" ii
  WHERE ${ISSUED} BETWEEN $1::date AND $2::date
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY qtd DESC
`, [dateStart, dateEnd]);

await show('Itens encontrados para essas NF-e', `
  SELECT
    COUNT(DISTINCT ii.invoice_id) AS nfes,
    COUNT(oi.order_item_id) AS itens_pedido,
    (SELECT COUNT(*) FROM public."budgetsItems" bi
      JOIN public."invoicesIssued" i2 ON i2.budget_id = bi.budget_id
      WHERE ${ISSUED.replaceAll('ii)', 'i2)')} BETWEEN $1::date AND $2::date) AS itens_orcamento
  FROM public."invoicesIssued" ii
  LEFT JOIN public."ordersItems" oi ON oi.order_id = ii.order_id
  WHERE ${ISSUED} BETWEEN $1::date AND $2::date
`, [dateStart, dateEnd]);

await show('Colunas de salesCommissionsFromInvoices', `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'salesCommissionsFromInvoices'
  ORDER BY ordinal_position
`);

await show('Índices de salesCommissionsFromInvoices', `
  SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'salesCommissionsFromInvoices'
`);

await show('Comissões já geradas (por mês)', `
  SELECT to_char(issue_date, 'YYYY-MM') AS mes, COUNT(*) AS qtd
  FROM public."salesCommissionsFromInvoices"
  GROUP BY 1 ORDER BY 1 DESC LIMIT 12
`);

await pool.end();
