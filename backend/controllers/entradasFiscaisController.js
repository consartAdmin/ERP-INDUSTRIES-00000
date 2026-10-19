// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 📦 entradasFiscaisController.js – Importação de NF-e de Entrada     ║
/* ║ - Descobre schema dinamicamente (produtos/movimentações/fornecedor) ║
   ║ - Converte unidades via "tabelaUnidades"                            ║
   ║ - Normaliza valores monetários (centavos / BR / US)                 ║
   ║ - Evita 500 quando colunas/tabelas não existem                      ║ */
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

/* ──────────────────────────────────────────────────────────────────── *
 * 💰 Helper: normaliza valores monetários (BR/US, centavos, etc.)
 * ──────────────────────────────────────────────────────────────────── */
function parseValorDinheiro(x) {
  if (typeof x === 'number') return Number.isFinite(x) ? +x : 0;
  if (x == null) return 0;
  let s = String(x).trim().replace(/[^\d,.\-]/g, ''); // remove "R$ ", espaços, etc.
  if (!s) return 0;

  // Caso BR: "1.234,56" -> 1234.56
  if (s.includes(',')) return +(s.replace(/\./g, '').replace(',', '.')) || 0;

  // Apenas pontos: pode ser milhar ou decimal
  if (s.includes('.')) {
    const parts = s.split('.');
    const dec = parts[1];
    if (dec && dec.length <= 2) return +s || 0;  // decimal com 1–2 casas
    return +s.replace(/\./g, '') || 0;           // pontuação era milhar
  }

  // Só dígitos → está em centavos (ex.: "86217" -> 862.17)
  if (/^\d+$/.test(s)) return +(Number(s) / 100).toFixed(2);

  return +s || 0;
}

/* ──────────────────────────────────────────────────────────────────── *
 * Helpers de schema
 * ──────────────────────────────────────────────────────────────────── */
async function columnExists(client, table, column) {
  const q = `
    SELECT 1
      FROM information_schema.columns
     WHERE (table_schema = current_schema() OR table_schema = 'public')
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`;
  const r = await client.query(q, [table.replace(/"/g, ''), column]);
  return r.rowCount > 0;
}

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE (table_schema = current_schema() OR table_schema = 'public')
        AND table_name = $1
      LIMIT 1`,
    [table.replace(/"/g, '')]
  );
  return r.rowCount > 0;
}

function firstNonEmpty(row, keys) {
  for (const k of keys) {
    if (k && k in row) {
      const v = (row[k] ?? '').toString().trim();
      if (v) return v;
    }
  }
  return '';
}

/**
 * Detecta colunas relevantes na tabela produtos e monta SELECTs seguros.
 */
async function detectProdutoSchema(client) {
  const table = 'produtos';

  const hasId     = await columnExists(client, table, 'id');
  const hasSku    = await columnExists(client, table, 'sku');
  const hasRefFab = await columnExists(client, table, 'ref_fab');

  // coluna de descrição (primeira que existir)
  const descCandidates = ['descricao', 'nome', 'nome_produto', 'titulo'];
  let descCol = null;
  for (const c of descCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists(client, table, c)) { descCol = c; break; }
  }

  // colunas candidatas a UNIDADE BASE / VENDA
  const unitColsBaseCandidates  = ['um_estoque', 'unidade_estoque', 'unidade_base', 'um_base', 'unidade', 'um'];
  const unitColsVendaCandidates = ['unidade_venda', 'um_venda', 'unidade', 'um'];

  const unitColsBase  = [];
  const unitColsVenda = [];
  for (const c of unitColsBaseCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists(client, table, c)) unitColsBase.push(c);
  }
  for (const c of unitColsVendaCandidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await columnExists(client, table, c)) unitColsVenda.push(c);
  }

  // Monta SELECTs que só incluem colunas que EXISTEM
  const baseCols = [];
  if (hasId)  baseCols.push('id');
  if (hasSku) baseCols.push('sku');
  if (descCol) baseCols.push(`"${descCol}" AS __desc`);

  // Unidades (cada uma com alias próprio; resolvemos em JS)
  for (const c of unitColsBase)  baseCols.push(`"${c}" AS __base_${c}`);
  for (const c of unitColsVenda) baseCols.push(`"${c}" AS __venda_${c}`);

  const selectList = baseCols.length ? baseCols.join(', ') : (hasSku ? 'sku' : '*');
  const selectForId  = `SELECT ${selectList} FROM ${table} WHERE id = $1 LIMIT 1`;
  const whereSkuRef  = hasRefFab ? 'WHERE TRIM(ref_fab) = $1 OR sku = $1' : 'WHERE sku = $1';
  const selectForSku = `SELECT ${selectList} FROM ${table} ${whereSkuRef} LIMIT 1`;

  return {
    hasId, hasSku, hasRefFab,
    descCol,
    unitColsBase,
    unitColsVenda,
    selectForId,
    selectForSku
  };
}

/* ──────────────────────────────────────────────────────────────────── *
 * Conversão de unidades (tabelaUnidades)
 * ──────────────────────────────────────────────────────────────────── */
async function obterFatorConversao(client, de, para) {
  const norm = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/\./g, '');

  const nde = norm(de);
  const npa = norm(para);
  if (!nde || !npa || nde === npa) return 1;

  const getFator = async (sigla) => {
    const semPonto = sigla.replace(/\./g, '');
    const sql = `
      SELECT fator::numeric
        FROM "tabelaUnidades"
       WHERE UPPER(unidade) = $1
          OR REPLACE(UPPER(unidade), '.', '') = $2
       ORDER BY id
       LIMIT 1`;
    const r = await client.query(sql, [sigla, semPonto]);
    return r.rowCount ? Number(r.rows[0].fator) || 1 : 1;
  };

  const [fDe, fPara] = await Promise.all([getFator(nde), getFator(npa)]);
  const fator = fDe / fPara;
  return Number.isFinite(fator) && fator > 0 ? fator : 1;
}

/* ──────────────────────────────────────────────────────────────────── *
 * Controller principal
 * ──────────────────────────────────────────────────────────────────── */
export const importarNotaFiscal = async (req, res) => {
  const {
    chave_acesso, numero_nf, serie,
    emitente, destinatario, valor_total,
    itens = [], duplicatas = []
  } = req.body;

  const client = await pool.connect();
  let onde = 'init';

  try {
    // Detecta schema das tabelas envolvidas
    onde = 'detect-schema';
    const hasEntradaId  = await columnExists(client, 'entradasFiscais', 'id');
    const entradaPkCol  = hasEntradaId
      ? 'id'
      : (await columnExists(client, 'entradasFiscais', 'entrada_id')) ? 'entrada_id' : null;
    if (!entradaPkCol) throw new Error('Tabela "entradasFiscais" sem PK (id/entrada_id).');

    const movTableExists = await tableExists(client, 'movimentacoesEstoque');
    const movHasIdProd   = movTableExists && await columnExists(client, 'movimentacoesEstoque', 'id_produto');
    const movHasSkuProd  = movTableExists && await columnExists(client, 'movimentacoesEstoque', 'sku');

    const prodSchema = await detectProdutoSchema(client);

    console.log('[NF-import] schema:', {
      entradaPkCol,
      produtos: {
        hasId: prodSchema.hasId,
        hasSku: prodSchema.hasSku,
        hasRefFab: prodSchema.hasRefFab,
        descCol: prodSchema.descCol,
        unitColsBase: prodSchema.unitColsBase,
        unitColsVenda: prodSchema.unitColsVenda
      },
      movimentacoes: { movHasIdProd, movHasSkuProd }
    });

    onde = 'tx-begin';
    await client.query('BEGIN');

    // 1) Cabeçalho
    onde = 'insert-cabecalho';
    const notaResult = await client.query(
      `INSERT INTO "entradasFiscais"
         (chave_acesso, numero_nf, serie, emitente, destinatario, valor_total)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING ${entradaPkCol}`,
      [chave_acesso, numero_nf, serie, emitente, destinatario, valor_total]
    );
    const entradaId = notaResult.rows[0][entradaPkCol];

    // 2) Itens
    for (const [idx, item] of itens.entries()) {
      onde = `insert-item-${idx}`;
      try {
        await client.query(
          `INSERT INTO "entradasFiscaisItens"
             (entrada_id, sku, descricao, ncm, cfop, unidade, quantidade, valor_unitario, valor_total, ipi, icms, id_produto)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            entradaId,
            item.sku ?? null,
            item.descricao ?? null,
            item.ncm ?? null,
            item.cfop ?? null,
            item.unidade ?? null,
            Number(item.quantidade) || 0,
            Number(item.valor_unitario) || 0,
            Number(item.valor_total) || 0,
            Number(item.ipi) || 0,
            Number(item.icms) || 0,
            item.id_produto ?? null
          ]
        );
      } catch (e) {
        console.warn(`[AVISO] Falha ao inserir item ${idx}:`, e.message);
      }

      // 2.1) Resolve produto (por id se vier, senão sku/ref_fab se existir)
      let pkValue = null, pkKind = null, umEstoque = '';

      if (prodSchema.hasId && item.id_produto) {
        onde = `resolve-prod-por-id-${idx}`;
        const r = await client.query(prodSchema.selectForId, [item.id_produto]);
        if (r.rowCount) {
          const row = r.rows[0];
          pkValue   = row.id;
          pkKind    = 'id';
          umEstoque = firstNonEmpty(row, prodSchema.unitColsBase.map(c => `__base_${c}`))
                   || firstNonEmpty(row, prodSchema.unitColsVenda.map(c => `__venda_${c}`))
                   || '';
        }
      }

      if (!pkValue) {
        onde = `resolve-prod-por-sku-${idx}`;
        const referencia = (item.sku || '').toString().trim();
        if (!referencia) {
          console.warn(`[AVISO] Item ${idx} sem sku/id_produto – estoque ignorado.`);
          continue;
        }
        const r = await client.query(prodSchema.selectForSku, [referencia]);
        if (!r.rowCount) {
          console.warn(`[AVISO] Produto não encontrado (sku${prodSchema.hasRefFab ? '/ref_fab' : ''}=${referencia}).`);
          continue;
        }
        const row = r.rows[0];
        if (prodSchema.hasId) {
          pkValue = row.id; pkKind = 'id';
        } else if (prodSchema.hasSku) {
          pkValue = row.sku; pkKind = 'sku';
        } else {
          console.warn('[AVISO] Tabela produtos sem id/sku — não dá para movimentar estoque.');
          continue;
        }
        umEstoque = firstNonEmpty(row, prodSchema.unitColsBase.map(c => `__base_${c}`))
                 || firstNonEmpty(row, prodSchema.unitColsVenda.map(c => `__venda_${c}`))
                 || '';
      }

      // 2.2) Conversão + update estoque
      const umNF = (item.unidade || '').toString().trim();
      const unidadeBase = (umEstoque || umNF || 'UN');
      const fator = await obterFatorConversao(client, umNF, unidadeBase);
      const qtdConv = (Number(item.quantidade) || 0) * fator;
      if (!qtdConv) {
        console.warn(`[AVISO] Quantidade convertida = 0 (item ${idx}).`);
        continue;
      }

      onde = `update-estoque-${idx}`;
      if (pkKind === 'id') {
        await client.query(
          `UPDATE produtos SET estoque = COALESCE(estoque,0) + $1 WHERE id = $2`,
          [qtdConv, pkValue]
        );
      } else if (pkKind === 'sku') {
        await client.query(
          `UPDATE produtos SET estoque = COALESCE(estoque,0) + $1 WHERE sku = $2`,
          [qtdConv, pkValue]
        );
      }

      // 2.3) Movimentação
      try {
        onde = `movimentacao-${idx}`;
        if (movHasSkuProd && pkKind === 'sku') {
          await client.query(
            `INSERT INTO "movimentacoesEstoque" (sku, tipo, quantidade, origem)
             VALUES ($1, 'ENTRADA', $2, 'NF-e')`,
            [pkValue, qtdConv]
          );
        } else if (movHasIdProd && pkKind === 'id') {
          await client.query(
            `INSERT INTO "movimentacoesEstoque" (id_produto, tipo, quantidade, origem)
             VALUES ($1, 'ENTRADA', $2, 'NF-e')`,
            [pkValue, qtdConv]
          );
        } else {
          console.warn('[AVISO] "movimentacoesEstoque" sem coluna id_produto/sku compatível.');
        }
      } catch (e) {
        console.warn(`[AVISO] Falha ao registrar movimentação do item ${idx}:`, e.message);
      }
    }

    // 3) Duplicatas / Contas a pagar
    for (const [idx, dup] of duplicatas.entries()) {
      const partes = (dup.vencimento || '').split('/');
      const vencISO = (partes.length === 3)
        ? `${partes[2]}-${partes[1]}-${partes[0]}`
        : dup.vencimento;

      onde = `dup-insert-${idx}`;
      await client.query(
        `INSERT INTO "entradasFiscaisDuplicatas" (entrada_id, numero, vencimento, valor)
         VALUES ($1,$2,$3,$4)`,
        [entradaId, dup.numero, vencISO, parseValorDinheiro(dup.valor)]
      );

      // 🔎 Fornecedor: suporta "fornecedores" ou "tabelaFornecedores"
      let fornTable = null;
      if (await tableExists(client, 'fornecedores')) fornTable = 'fornecedores';
      else if (await tableExists(client, 'tabelaFornecedores')) fornTable = 'tabelaFornecedores';

      let fornecedor_id = null, cnpj_cpf = null;

      if (fornTable) {
        // Quais colunas de nome existem?
        const nomeCols = [];
        for (const c of ['nome', 'razao_social', 'nome_fantasia']) {
          // eslint-disable-next-line no-await-in-loop
          if (await columnExists(client, fornTable, c)) nomeCols.push(c);
        }
        // Documento do fornecedor
        let docCol = null;
        if (await columnExists(client, fornTable, 'cnpj_cpf')) docCol = 'cnpj_cpf';
        else if (await columnExists(client, fornTable, 'cnpj')) docCol = 'cnpj';

        if (nomeCols.length) {
          const whereNome = nomeCols.map(() => `"XCOL" ILIKE $1`)
            .join(' OR ')
            .replace(/"XCOL"/g, () => `"${nomeCols.shift()}"`);
          const selectDoc = docCol ? `, "${docCol}" AS cnpj_cpf` : `, NULL::text AS cnpj_cpf`;
          const sqlFor = `
            SELECT id ${selectDoc}
              FROM "${fornTable}"
             WHERE ${whereNome}
             ORDER BY id
             LIMIT 1`;
          const f = await client.query(sqlFor, [emitente]);
          if (f.rowCount) {
            fornecedor_id = f.rows[0].id;
            cnpj_cpf      = f.rows[0].cnpj_cpf || null;
          }
        }
      }

      onde = `contas-pagar-${idx}`;
      await client.query(
        `INSERT INTO "contasPagar"
           (numero_nf, data_emissao, vencimento, valor, status, fornecedor_id, fornecedor_antigo, cnpj_cpf)
         VALUES ($1, CURRENT_DATE, $2, $3, 'EM_ABERTO', $4, $5, $6)`,
        [numero_nf, vencISO, parseValorDinheiro(dup.valor), fornecedor_id, emitente, cnpj_cpf]
      );
    }

    onde = 'tx-commit';
    await client.query('COMMIT');
    return res.status(200).json({ mensagem: 'Nota fiscal importada. Estoque atualizado.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ERRO#ENTRADA-FISCAL]', { onde, msg: error.message });
    return res.status(500).json({
      erro: 'Erro ao importar nota fiscal.',
      detalhes: error.message,
      onde
    });
  } finally {
    client.release();
  }
};
