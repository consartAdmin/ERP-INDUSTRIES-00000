// controllers/pedidosController.js
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 📦 pedidosController.js – Controlador para Pedidos (ESM)                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import db from '../config/db.js';

// Helpers
const n = (v, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const pick = (...vals) => vals.find(v => v !== undefined && v !== null);

// Como budgets NÃO tem cliente_id, usamos os campos do próprio orçamento
const onlyDigits = (s='') => String(s || '').replace(/\D+/g, '');

async function getClienteFromOrcamento(client, orc) {
  // 1) Se o orçamento já tem cliente_id, use
  if (orc.cliente_id) {
    const r = await client.query(
      `SELECT cliente_id, nome_fantasia, cnpj_cpf
         FROM clientes
        WHERE cliente_id = $1
        LIMIT 1`,
      [orc.cliente_id]
    );
    if (r.rowCount) {
      const c = r.rows[0];
      return {
        clienteId: c.cliente_id,
        clienteNome: orc.cliente_nome || c.nome_fantasia || null,
        clienteCnpj: onlyDigits(orc.cliente_cnpj) || onlyDigits(c.cnpj_cpf) || null,
      };
    }
  }

  // 2) Resolver pelo documento vindo do orçamento
  const doc = onlyDigits(orc.cliente_cnpj);
  if (doc) {
    const r = await client.query(
      `SELECT cliente_id, nome_fantasia, cnpj_cpf
         FROM clientes
        WHERE REGEXP_REPLACE(cnpj_cpf, '\\D', '', 'g') = $1
        LIMIT 1`,
      [doc]
    );
    if (r.rowCount) {
      const c = r.rows[0];
      return {
        clienteId: c.cliente_id,
        clienteNome: orc.cliente_nome || c.nome_fantasia || null,
        clienteCnpj: onlyDigits(c.cnpj_cpf) || doc || null,
      };
    }
  }

  // 3) (opcional) fallback por nome — menos confiável
  if (orc.cliente_nome) {
    const r = await client.query(
      `SELECT cliente_id, nome_fantasia, cnpj_cpf
         FROM clientes
        WHERE UNACCENT(LOWER(nome_fantasia)) = UNACCENT(LOWER($1))
        LIMIT 1`,
      [orc.cliente_nome]
    );
    if (r.rowCount) {
      const c = r.rows[0];
      return {
        clienteId: c.cliente_id,
        clienteNome: orc.cliente_nome,
        clienteCnpj: onlyDigits(c.cnpj_cpf) || onlyDigits(orc.cliente_cnpj) || null,
      };
    }
  }

  // 4) Não resolvido
  return {
    clienteId: null,
    clienteNome: orc.cliente_nome || null,
    clienteCnpj: onlyDigits(orc.cliente_cnpj) || null,
  };
}

/* =============================================================================
 * 🔄 Transformar orçamento (budget) em pedido
 * ========================================================================== */
export async function transformarEmPedido(req, res) {
  const { id } = req.params;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const { rows: orcs } = await client.query(
      `SELECT * FROM budgets WHERE id = $1`,
      [id]
    );
    if (!orcs.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: '❌ Orçamento não encontrado.' });
    }
    const o = orcs[0];

    const { clienteId, clienteNome, clienteCnpj } = await getClienteFromOrcamento(client, o);

if (!clienteId) {
  await client.query('ROLLBACK');
  return res.status(400).json({
    erro: 'CLIENTE_NAO_RESOLVIDO',
    mensagem: 'Não foi possível associar o cliente ao pedido (cliente_id nulo). Verifique o cadastro e o CNPJ/CPF.'
  });
}

    // busca itens
    let itens = [];
    try {
      const r1 = await client.query(
        `SELECT * FROM "budgetsItens" WHERE budget_id = $1 ORDER BY 1`,
        [id]
      );
      itens = r1.rows;
    } catch {}
    if (!itens.length) {
      try {
        const r2 = await client.query(
          `SELECT * FROM budget_itens WHERE budget_id = $1 ORDER BY 1`,
          [id]
        );
        itens = r2.rows;
      } catch {}
    }
    if (!itens.length) throw new Error('Orçamento sem itens ou tabela de itens não encontrada.');

    const insertPedidoSQL = `
      INSERT INTO pedidos
        (orcamento_id, cliente_id, cliente_nome, cliente_cnpj, data, status,
         forma_pagamento, vendedor, observacoes, tabela_preco_id)
      VALUES
        ($1, $2, $3, $4, NOW(), 'Pendente', $5, $6, $7, $8)
      RETURNING id, numero
    `;
    const { rows: pedRows } = await client.query(insertPedidoSQL, [
      o.id ?? id,
      clienteId,
      clienteNome,
      clienteCnpj,
      o.forma_pagamento ?? null,
      o.vendedor ?? null,
      o.observacoes ?? null,
      o.tabela_preco_id ?? null,
    ]);
    const pedidoId = pedRows[0].id;
    const numeroPedido = pedRows[0].numero ?? null;

    for (const it of itens) {
      const unidade = pick(it.unidade, it.um, it.unidade_venda, it.unidade_multipla) || 'UN';
      const qtd     = n(pick(it.quantidade, it.qtd, it.qtde, it.qCom), 0);
      const vUnit   = n(pick(it.valor_unitario, it.valor, it.vl_unit), 0);
      const descR$  = n(pick(it.desconto, it.desc, it.vDesc), 0);

      const base = qtd * vUnit;
      let descPerc = null;
      if (base > 0 && descR$ > 0) {
        descPerc = Math.min(100, Math.max(0, Number(((descR$ / base) * 100).toFixed(2))));
      }

      await client.query(
        `INSERT INTO "pedidoItens"
           (pedido_id, sku, descricao, unidade,
            quantidade, valor_unitario,
            desconto, desconto_percent,
            grade)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          pedidoId,
          pick(it.sku, it.codigo, it.cProd) ?? null,
          pick(it.descricao, it.descr, it.xProd) ?? null,
          unidade,
          qtd,
          vUnit,
          descR$,
          descPerc,
          pick(it.grade, it.variante) ?? null,
        ]
      );
    }

    try {
      await client.query(
        `UPDATE budgets
            SET status = 'Convertido', pedido_id = $2
          WHERE id = $1`,
        [id, pedidoId]
      );
    } catch {}

    await client.query('COMMIT');
    return res.json({
      ok: true,
      mensagem: '✅ Pedido gerado com sucesso.',
      pedidoId,
      numero: numeroPedido,
    });

  } catch (erro) {
    await client.query('ROLLBACK');
    console.error('[❌ ERRO transformarEmPedido]', erro);
    return res
      .status(500)
      .json({ erro: 'Erro ao transformar orçamento em pedido.', detalhe: String(erro.detail || erro.message || erro) });
  } finally {
    client.release();
  }
}

/* =============================================================================
 * 📋 Listar pedidos
 * ========================================================================== */
export async function listarPedidos(req, res) {
  const {
    q = '',
    data_ini = req.query.data_ini || req.query.inicio || '',
    data_fim = req.query.data_fim || req.query.fim || '',
    page = 1,
    pageSize = 20,
  } = req.query;

  const where = ['p.deleted_at IS NULL'];
  const vals = [];
  let i = 1;

  if (q) {
    where.push(`(p.cliente_nome ILIKE $${i} OR p.cliente_cnpj ILIKE $${i})`);
    vals.push(`%${q}%`); i++;
  }
  if (data_ini) { where.push(`p.data >= $${i}`); vals.push(data_ini); i++; }
  if (data_fim) { where.push(`p.data <= $${i}`); vals.push(data_fim); i++; }
  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.max(1, Number(pageSize));
  const offset = (Math.max(1, Number(page)) - 1) * limit;

  const sqlCount = `SELECT COUNT(*)::int AS qt FROM pedidos p ${whereSQL};`;

  const sqlRows = `
    SELECT
      p.id, p.numero, p.data,
      p.cliente_nome,
      p.cliente_cnpj,
      p.status,
      COALESCE(SUM(i.total_item), 0)::numeric(12,2) AS total
    FROM pedidos p
    LEFT JOIN "pedidoItens" i ON i.pedido_id = p.id
    ${whereSQL}
    GROUP BY p.id, p.numero, p.data, p.cliente_nome, p.cliente_cnpj, p.status
    ORDER BY p.id DESC
    LIMIT ${limit} OFFSET ${offset};
  `;

  try {
    const [{ rows: [{ qt }] }, { rows }] = await Promise.all([
      db.query(sqlCount, vals),
      db.query(sqlRows, vals),
    ]);

    return res.json({ total: qt, page: Number(page), pageSize: limit, rows });
  } catch (err) {
    console.error('[ERR#PEDIDOS-LISTAR]', err);
    return res.status(500).json({ erro: 'Erro ao buscar pedidos.', detalhe: String(err.message || err) });
  }
}

/* =============================================================================
 * 🔎 Detalhar por número
 * ========================================================================== */
export async function detalharPorNumero(req, res) {
  const numero = Number(req.params.numero);
  if (!Number.isFinite(numero)) {
    return res.status(400).json({ erro: 'Número inválido.' });
  }
  try {
    const ped = await db.query(
      `SELECT * FROM pedidos WHERE numero = $1 AND deleted_at IS NULL`,
      [numero]
    );
    if (!ped.rows[0]) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    const itens = await db.query(
      `SELECT id, pedido_id, sku, descricao, unidade, grade,
              quantidade, valor_unitario,
              COALESCE(desconto,0) AS desconto,
              COALESCE(desconto_percent,0)::numeric(12,2) AS desconto_percent,
              COALESCE(total_item, quantidade*valor_unitario - COALESCE(desconto,0))::numeric(12,2) AS total
         FROM "pedidoItens"
        WHERE pedido_id = $1
        ORDER BY id`,
      [ped.rows[0].id]
    );

    return res.json({ pedido: ped.rows[0], itens: itens.rows });
  } catch (e) {
    console.error('[ERR#PEDIDOS-DETALHAR-NUM]', e);
    return res.status(500).json({ erro: 'Erro ao detalhar pedido.', detalhe: e.message });
  }
}

/* =============================================================================
 * 🗑️ Soft delete
 * ========================================================================== */
export async function excluirPedido(req, res) {
  const id = Number(req.params.id);
  const motivo = (req.body?.motivo || '').toString().slice(0, 500);

  try {
    const r = await db.query(
      `SELECT id, numero, status, nfe_serie, nfe_numero, deleted_at
         FROM pedidos
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ erro: 'NAO_ENCONTRADO' });

    const ped = r.rows[0];
    if (ped.deleted_at) return res.status(404).json({ erro: 'JA_EXCLUIDO' });

    const faturado =
      ped.nfe_serie != null && ped.nfe_numero != null ||
      (ped.status || '').toUpperCase() === 'FATURADO';
    if (faturado) {
      return res.status(409).json({
        erro: 'PEDIDO_FATURADO',
        mensagem: 'Pedido já faturado. Cancele a NF antes de excluir.'
      });
    }

    const rDel = await db.query(
      `UPDATE pedidos
          SET status = 'EXCLUIDO',
              deleted_at = NOW(),
              deleted_reason = NULLIF($2,'')
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id`,
      [id, motivo]
    );
    if (!rDel.rowCount) return res.status(404).json({ erro: 'NAO_ENCONTRADO' });

    res.json({ ok: true, id });
  } catch (e) {
    console.error('[pedidosController.excluirPedido]', e);
    res.status(500).json({ erro: 'ERRO_INTERNO', mensagem: e.message });
  }
}

/* =============================================================================
 * ♻️ RESTORE – PATCH /api/pedidos/:id/restore
 * ========================================================================== */
export async function restaurarPedido(req, res) {
  const id = Number(req.params.id);
  try {
    const r = await db.query(
      `UPDATE pedidos
          SET deleted_at = NULL,
              deleted_reason = NULL,
              status = CASE WHEN status = 'EXCLUIDO' THEN 'ABERTO' ELSE status END
        WHERE id = $1
        RETURNING id`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ erro: 'NAO_ENCONTRADO' });
    res.json({ ok: true, id });
  } catch (e) {
    console.error('[pedidosController.restaurarPedido]', e);
    res.status(500).json({ erro: 'ERRO_INTERNO', mensagem: e.message });
  }
}

/* =============================================================================
 * 🔥 Hard delete
 * ========================================================================== */
export async function excluirPedidoHard(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID_INVALIDO' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE budgets SET pedido_id = NULL WHERE pedido_id = $1', [id]);
    await client.query('DELETE FROM "pedidoItens" WHERE pedido_id = $1', [id]);
    const r = await client.query('DELETE FROM pedidos WHERE id = $1', [id]);

    await client.query('COMMIT');
    if (!r.rowCount) return res.status(404).json({ erro: 'NAO_ENCONTRADO' });
    return res.json({ ok: true, id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[pedidosController.excluirPedidoHard]', e);
    const isCheck = /check constraint/i.test(e.message || '');
    return res.status(500).json({
      erro: 'ERRO_INTERNO',
      mensagem: e.message,
      hint: isCheck
        ? 'Se aparecer CHECK em DELETE, há um TRIGGER que faz INSERT/UPDATE em "pedidos" durante o delete.'
        : undefined
    });
  } finally {
    client.release();
  }
}

/* =============================================================================
 * 🔎 Obter pedido por ID ou por número (?by=numero)
 *    Rota: GET /api/pedidos/:id
 * ========================================================================== */
export async function obterPorIdOuNumero(req, res) {
  const raw = req.params.id;
  const by = String(req.query.by || '').toLowerCase(); // 'numero' ou ''
  const num = Number(raw);

  if (!Number.isFinite(num)) {
    return res.status(400).json({ ok:false, erro: 'PARAM_INVALIDO', detalhe: 'Parâmetro :id precisa ser numérico.' });
  }

  try {
    let ped;
    if (by === 'numero') {
      const r = await db.query(
        `SELECT * FROM pedidos WHERE numero = $1 AND deleted_at IS NULL LIMIT 1`,
        [num]
      );
      ped = r.rows[0];
    } else {
      const r = await db.query(
        `SELECT * FROM pedidos WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [num]
      );
      ped = r.rows[0];
    }

    if (!ped) {
      return res.status(404).json({ ok:false, erro: 'Pedido não encontrado.' });
    }

    const rItens = await db.query(
      `SELECT id, pedido_id, sku, descricao, unidade, grade,
              quantidade, valor_unitario,
              COALESCE(desconto,0) AS desconto,
              COALESCE(desconto_percent,0)::numeric(12,2) AS desconto_percent,
              COALESCE(total_item, quantidade*valor_unitario - COALESCE(desconto,0))::numeric(12,2) AS total
         FROM "pedidoItens"
        WHERE pedido_id = $1
        ORDER BY id`,
      [ped.id]
    );

    return res.json({ ok:true, pedido: ped, itens: rItens.rows });
  } catch (e) {
    console.error('[ERR#PEDIDOS-OBTER-ID-OU-NUMERO]', e);
    return res.status(500).json({ ok:false, erro: 'Erro ao buscar pedido.', detalhe: e.message });
  }
}
