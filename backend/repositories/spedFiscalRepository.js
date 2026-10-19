// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscalRepository.js                                             ║
// ║ Descrição: Repositório do módulo SPED Fiscal                        ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

async function ensureBaseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sped_fiscal_lotes (
      id BIGSERIAL PRIMARY KEY,
      empresa_id BIGINT NOT NULL,
      competencia_mes INT NOT NULL,
      competencia_ano INT NOT NULL,
      uf VARCHAR(2) NOT NULL,
      finalidade VARCHAR(20) NOT NULL DEFAULT 'original',
      versao_guia VARCHAR(20) NOT NULL,
      versao_layout VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'rascunho',
      arquivo_path TEXT,
      hash_arquivo TEXT,
      total_erros INT NOT NULL DEFAULT 0,
      total_alertas INT NOT NULL DEFAULT 0,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      gerado_em TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sped_fiscal_inconsistencias (
      id BIGSERIAL PRIMARY KEY,
      lote_id BIGINT NOT NULL REFERENCES sped_fiscal_lotes(id) ON DELETE CASCADE,
      tipo VARCHAR(20) NOT NULL,
      bloco VARCHAR(10),
      registro VARCHAR(10),
      chave_ref TEXT,
      mensagem TEXT NOT NULL,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sped_fiscal_parametros (
      id BIGSERIAL PRIMARY KEY,
      empresa_id BIGINT NOT NULL,
      uf VARCHAR(2) NOT NULL,
      codigo_finalidade_arquivo VARCHAR(10),
      perfil_apresentacao VARCHAR(10),
      indicador_tipo_atividade VARCHAR(10),
      inventario_motivo VARCHAR(10),
      gerar_bloco_h BOOLEAN NOT NULL DEFAULT FALSE,
      gerar_bloco_d BOOLEAN NOT NULL DEFAULT FALSE,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getCompany(companyId) {
  await ensureBaseTables();

  const { rows } = await pool.query(
    `
      SELECT
        id,
        corporate_name           AS razao_social,
        trade_name               AS nome_fantasia,
        cnpj,
        state_registration       AS ie,
        municipal_registration   AS im,
        state                    AS uf,
        city_ibge_code           AS cod_mun,
        zip_code                 AS cep,
        address                  AS endereco,
        address_number           AS numero,
        address_complement       AS complemento,
        district                 AS bairro,
        phone                    AS telefone,
        email,
        tax_regime_code,
        nfe_environment,
        nfe_series,
        next_nfe_number,
        default_cfop_sale,
        default_cfop_purchase,
        sped_profile,
        sped_activity_type,
        logo_url,
        slogan,
        document_notes,
        pdf_footer,
        accountant_name,
        accountant_cpf,
        accountant_crc,
        accountant_email,
        accountant_phone,
        is_active
      FROM enterprises
      WHERE id = $1
      LIMIT 1
    `,
    [companyId]
  );

  return rows[0] || null;
}

async function getParticipants(companyId, period) {
  const queries = [
    `
      SELECT
        c.id::text AS codigo,
        c.nome_fantasia AS nome,
        c.cnpj_cpf AS cnpj,
        NULL::text AS cpf,
        c.ie_rg AS ie,
        c.cod_municipio AS cod_mun,
        c.endereco,
        c.numero,
        c.complemento,
        c.bairro,
        '1058'::text AS cod_pais,
        ''::text AS suframa
      FROM clientes c
      ORDER BY c.nome_fantasia
      LIMIT 5000
    `,
    `
      SELECT
        f.id::text AS codigo,
        f.razao_social AS nome,
        f.cnpj_cpf AS cnpj,
        NULL::text AS cpf,
        f.ie_rg AS ie,
        f.cod_municipio AS cod_mun,
        f.endereco,
        f.numero,
        f.complemento,
        f.bairro,
        '1058'::text AS cod_pais,
        ''::text AS suframa
      FROM fornecedores f
      ORDER BY f.razao_social
      LIMIT 5000
    `
  ];

  const result = [];

  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql);
      result.push(...rows);
    } catch (_) { }
  }

  const map = new Map();
  for (const row of result) {
    if (!row.codigo) continue;
    map.set(String(row.codigo), row);
  }

  return [...map.values()];
}

async function getProducts(companyId, period) {
  const queries = [
    `
      SELECT
        p.sku::text AS codigo,
        p.nome AS descricao,
        p.descricao_complementar,
        COALESCE(p.unidade_venda, p.unidade, 'UN') AS unidade,
        COALESCE(p.tipo_item, '00') AS tipo_item,
        p.ncm,
        p.ex_ipi,
        p.genero,
        p.cod_lsit,
        p.aliq_icms,
        p.cest
      FROM produtos p
      ORDER BY p.nome
      LIMIT 10000
    `,
    `
      SELECT
        p.codigo::text AS codigo,
        p.descricao,
        p.descricao_complementar,
        COALESCE(p.unidade, 'UN') AS unidade,
        COALESCE(p.tipo_item, '00') AS tipo_item,
        p.ncm,
        p.ex_ipi,
        p.genero,
        p.cod_lsit,
        p.aliq_icms,
        p.cest
      FROM products p
      ORDER BY p.descricao
      LIMIT 10000
    `
  ];

  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql);
      if (rows.length) return rows;
    } catch (_) { }
  }

  return [];
}

async function getFiscalDocuments(companyId, period) {
  const queries = [
    `
      SELECT
        o.id,
        o.numero::text AS numero,
        o.serie::text AS serie,
        o.nfe_chave AS chave,
        o.emissao_em AS data_emissao,
        o.emissao_em AS data_entrada_saida,
        COALESCE(o.valor_total, 0) AS valor_total,
        COALESCE(o.valor_produtos, o.valor_total, 0) AS valor_mercadorias,
        COALESCE(o.valor_frete, 0) AS valor_frete,
        COALESCE(o.valor_seguro, 0) AS valor_seguro,
        COALESCE(o.valor_outras_despesas, 0) AS outras_despesas,
        COALESCE(o.valor_desconto, 0) AS valor_desconto,
        COALESCE(o.base_icms, 0) AS valor_bc_icms,
        COALESCE(o.valor_icms, 0) AS valor_icms,
        COALESCE(o.base_icms_st, 0) AS valor_bc_icms_st,
        COALESCE(o.valor_icms_st, 0) AS valor_icms_st,
        COALESCE(o.valor_ipi, 0) AS valor_ipi,
        COALESCE(o.valor_pis, 0) AS valor_pis,
        COALESCE(o.valor_cofins, 0) AS valor_cofins,
        '55'::text AS cod_mod,
        '00'::text AS cod_sit,
        '1'::text AS ind_oper,
        '0'::text AS ind_emit,
        COALESCE(o.cliente_id::text, '') AS participante_codigo,
        '0'::text AS ind_pgto,
        '9'::text AS ind_frt
      FROM orders o
      WHERE o.emissao_em >= $1
        AND o.emissao_em < ($2::date + INTERVAL '1 day')
        AND COALESCE(o.nfe_status, '') IN ('AUTORIZADA', 'EMITIDA', '')
      ORDER BY o.emissao_em, o.id
    `,
    `
      SELECT
        n.id,
        n.numero::text AS numero,
        n.serie::text AS serie,
        n.chave_acesso AS chave,
        n.data_emissao,
        n.data_entrada_saida,
        COALESCE(n.valor_total, 0) AS valor_total,
        COALESCE(n.valor_produtos, n.valor_total, 0) AS valor_mercadorias,
        COALESCE(n.valor_frete, 0) AS valor_frete,
        COALESCE(n.valor_seguro, 0) AS valor_seguro,
        COALESCE(n.outras_despesas, 0) AS outras_despesas,
        COALESCE(n.valor_desconto, 0) AS valor_desconto,
        COALESCE(n.base_icms, 0) AS valor_bc_icms,
        COALESCE(n.valor_icms, 0) AS valor_icms,
        COALESCE(n.base_icms_st, 0) AS valor_bc_icms_st,
        COALESCE(n.valor_icms_st, 0) AS valor_icms_st,
        COALESCE(n.valor_ipi, 0) AS valor_ipi,
        COALESCE(n.valor_pis, 0) AS valor_pis,
        COALESCE(n.valor_cofins, 0) AS valor_cofins,
        COALESCE(n.modelo, '55')::text AS cod_mod,
        COALESCE(n.cod_situacao, '00')::text AS cod_sit,
        COALESCE(n.ind_oper, '1')::text AS ind_oper,
        COALESCE(n.ind_emit, '0')::text AS ind_emit,
        COALESCE(n.participante_codigo::text, '') AS participante_codigo,
        COALESCE(n.ind_pgto, '0')::text AS ind_pgto,
        COALESCE(n.ind_frete, '9')::text AS ind_frt
      FROM notas_fiscais n
      WHERE n.data_emissao >= $1
        AND n.data_emissao < ($2::date + INTERVAL '1 day')
      ORDER BY n.data_emissao, n.id
    `
  ];

  let docs = [];

  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql, [period.dateStart, period.dateEnd]);
      if (rows.length) {
        docs = rows;
        break;
      }
    } catch (_) { }
  }

  for (const doc of docs) {
    doc.items = await getDocumentItems(doc.id, doc.numero);
  }

  return docs;
}

async function getDocumentItems(documentId, numero) {
  const queries = [
    `
      SELECT
        oi.sku::text AS codigo_produto,
        COALESCE(oi.descricao, p.nome, p.descricao) AS descricao,
        COALESCE(oi.quantidade, 0) AS quantidade,
        COALESCE(oi.unidade, 'UN') AS unidade,
        COALESCE(oi.valor_unitario * oi.quantidade, oi.valor_total, 0) AS valor_item,
        COALESCE(oi.valor_desconto, 0) AS valor_desconto,
        '1'::text AS movimenta_estoque,
        COALESCE(oi.cst_icms, oi.csosn, '') AS cst_icms,
        COALESCE(oi.csosn, '') AS csosn,
        COALESCE(oi.cfop, '') AS cfop,
        ''::text AS codigo_natureza,
        COALESCE(oi.base_icms, 0) AS valor_bc_icms,
        COALESCE(oi.aliq_icms, 0) AS aliq_icms,
        COALESCE(oi.valor_icms, 0) AS valor_icms,
        COALESCE(oi.base_icms_st, 0) AS valor_bc_icms_st,
        COALESCE(oi.aliq_icms_st, 0) AS aliq_st,
        COALESCE(oi.valor_icms_st, 0) AS valor_icms_st,
        ''::text AS apuracao_ipi,
        COALESCE(oi.cst_ipi, '') AS cst_ipi,
        COALESCE(oi.cod_enq, '') AS cod_enq,
        COALESCE(oi.base_ipi, 0) AS valor_bc_ipi,
        COALESCE(oi.aliq_ipi, 0) AS aliq_ipi,
        COALESCE(oi.valor_ipi, 0) AS valor_ipi,
        COALESCE(oi.cst_pis, '') AS cst_pis,
        COALESCE(oi.base_pis, 0) AS valor_bc_pis,
        COALESCE(oi.aliq_pis, 0) AS aliq_pis,
        0::numeric AS quant_bc_pis,
        0::numeric AS aliq_pis_reais,
        COALESCE(oi.valor_pis, 0) AS valor_pis,
        COALESCE(oi.cst_cofins, '') AS cst_cofins,
        COALESCE(oi.base_cofins, 0) AS valor_bc_cofins,
        COALESCE(oi.aliq_cofins, 0) AS aliq_cofins,
        0::numeric AS quant_bc_cofins,
        0::numeric AS aliq_cofins_reais,
        COALESCE(oi.valor_cofins, 0) AS valor_cofins,
        ''::text AS cod_cta,
        COALESCE(oi.valor_reducao_bc, 0) AS valor_reducao_bc
      FROM order_items oi
      LEFT JOIN produtos p ON p.sku::text = oi.sku::text
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `,
    `
      SELECT
        ni.codigo_produto::text AS codigo_produto,
        ni.descricao,
        COALESCE(ni.quantidade, 0) AS quantidade,
        COALESCE(ni.unidade, 'UN') AS unidade,
        COALESCE(ni.valor_total, 0) AS valor_item,
        COALESCE(ni.valor_desconto, 0) AS valor_desconto,
        '1'::text AS movimenta_estoque,
        COALESCE(ni.cst_icms, ni.csosn, '') AS cst_icms,
        COALESCE(ni.csosn, '') AS csosn,
        COALESCE(ni.cfop, '') AS cfop,
        ''::text AS codigo_natureza,
        COALESCE(ni.base_icms, 0) AS valor_bc_icms,
        COALESCE(ni.aliq_icms, 0) AS aliq_icms,
        COALESCE(ni.valor_icms, 0) AS valor_icms,
        COALESCE(ni.base_icms_st, 0) AS valor_bc_icms_st,
        COALESCE(ni.aliq_icms_st, 0) AS aliq_st,
        COALESCE(ni.valor_icms_st, 0) AS valor_icms_st,
        ''::text AS apuracao_ipi,
        COALESCE(ni.cst_ipi, '') AS cst_ipi,
        COALESCE(ni.cod_enq, '') AS cod_enq,
        COALESCE(ni.base_ipi, 0) AS valor_bc_ipi,
        COALESCE(ni.aliq_ipi, 0) AS aliq_ipi,
        COALESCE(ni.valor_ipi, 0) AS valor_ipi,
        COALESCE(ni.cst_pis, '') AS cst_pis,
        COALESCE(ni.base_pis, 0) AS valor_bc_pis,
        COALESCE(ni.aliq_pis, 0) AS aliq_pis,
        0::numeric AS quant_bc_pis,
        0::numeric AS aliq_pis_reais,
        COALESCE(ni.valor_pis, 0) AS valor_pis,
        COALESCE(ni.cst_cofins, '') AS cst_cofins,
        COALESCE(ni.base_cofins, 0) AS valor_bc_cofins,
        COALESCE(ni.aliq_cofins, 0) AS aliq_cofins,
        0::numeric AS quant_bc_cofins,
        0::numeric AS aliq_cofins_reais,
        COALESCE(ni.valor_cofins, 0) AS valor_cofins,
        ''::text AS cod_cta,
        COALESCE(ni.valor_reducao_bc, 0) AS valor_reducao_bc
      FROM nota_fiscal_itens ni
      WHERE ni.nota_fiscal_id = $1
      ORDER BY ni.id
    `
  ];

  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql, [documentId]);
      if (rows.length) return rows;
    } catch (_) { }
  }

  return [];
}

async function getTransportDocuments(companyId, period) {
  return [];
}

async function getInventory(companyId, period) {
  const queries = [
    `
      SELECT
        p.sku::text AS codigo_produto,
        COALESCE(p.unidade_venda, p.unidade, 'UN') AS unidade,
        COALESCE(ps.qty_on_hand, 0) AS quantidade,
        COALESCE(ps.cost_unit, 0) AS valor_unitario,
        COALESCE(ps.qty_on_hand, 0) * COALESCE(ps.cost_unit, 0) AS valor_total,
        '0'::text AS ind_prop,
        ''::text AS cod_part,
        ''::text AS txt_compl,
        ''::text AS cod_cta
      FROM productsStock ps
      INNER JOIN produtos p ON p.id = ps.product_id
      ORDER BY p.nome
    `,
    `
      SELECT
        p.codigo::text AS codigo_produto,
        COALESCE(p.unidade, 'UN') AS unidade,
        COALESCE(p.estoque_atual, 0) AS quantidade,
        COALESCE(p.preco_custo, 0) AS valor_unitario,
        COALESCE(p.estoque_atual, 0) * COALESCE(p.preco_custo, 0) AS valor_total,
        '0'::text AS ind_prop,
        ''::text AS cod_part,
        ''::text AS txt_compl,
        ''::text AS cod_cta
      FROM products p
      ORDER BY p.descricao
    `
  ];

  for (const sql of queries) {
    try {
      const { rows } = await pool.query(sql);
      if (rows.length) return rows;
    } catch (_) { }
  }

  return [];
}

async function getApuracao(companyId, period) {
  const documents = await getFiscalDocuments(companyId, period);

  const totals = documents.reduce((acc, doc) => {
    acc.vl_tot_debitos += Number(doc.valor_icms || 0);
    acc.vl_tot_creditos += 0;
    acc.vl_icms_recolher += Number(doc.valor_icms || 0);
    return acc;
  }, {
    vl_tot_debitos: 0,
    vl_aj_debitos: 0,
    vl_tot_aj_debitos: 0,
    vl_estornos_cred: 0,
    vl_tot_creditos: 0,
    vl_aj_creditos: 0,
    vl_tot_aj_creditos: 0,
    vl_estornos_deb: 0,
    vl_sld_credor_ant: 0,
    vl_sld_apurado: 0,
    vl_tot_ded: 0,
    vl_icms_recolher: 0,
    vl_sld_credor_transportar: 0,
    debitos_especiais: 0,
  });

  totals.vl_sld_apurado =
    totals.vl_tot_debitos -
    totals.vl_tot_creditos +
    totals.vl_aj_debitos +
    totals.vl_tot_aj_debitos -
    totals.vl_aj_creditos -
    totals.vl_tot_aj_creditos;

  return totals;
}

async function getParameters(companyId, uf) {
  await ensureBaseTables();

  const { rows } = await pool.query(
    `
      SELECT *
      FROM sped_fiscal_parametros
      WHERE empresa_id = $1
        AND uf = $2
        AND ativo = TRUE
      ORDER BY id DESC
      LIMIT 1
    `,
    [companyId, uf]
  );

  return rows[0] || {
    empresa_id: companyId,
    uf,
    gerar_bloco_h: false,
    gerar_bloco_d: false,
    inventario_motivo: '01',
  };
}

async function createLote(data) {
  await ensureBaseTables();

  const { rows } = await pool.query(
    `
      INSERT INTO sped_fiscal_lotes (
        empresa_id,
        competencia_mes,
        competencia_ano,
        uf,
        finalidade,
        versao_guia,
        versao_layout,
        status,
        total_erros,
        total_alertas
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      data.empresa_id,
      data.competencia_mes,
      data.competencia_ano,
      data.uf,
      data.finalidade,
      data.versao_guia,
      data.versao_layout,
      data.status,
      data.total_erros || 0,
      data.total_alertas || 0,
    ]
  );

  return rows[0];
}

async function saveInconsistencies(loteId, issues = []) {
  if (!issues.length) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const issue of issues) {
      await client.query(
        `
          INSERT INTO sped_fiscal_inconsistencias (
            lote_id, tipo, bloco, registro, chave_ref, mensagem
          ) VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          loteId,
          issue.type,
          issue.bloco || '',
          issue.registro || '',
          issue.chave_ref || '',
          issue.mensagem || '',
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {

    await client.query('ROLLBACK');

    console.error('===================================');
    console.error('SPED saveInconsistencies ERROR');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Table:', error.table);
    console.error('Column:', error.column);
    console.error('Constraint:', error.constraint);
    console.error(error);
    console.error('===================================');

    throw error;
  } finally {
    client.release();
  }
}

// O arquivo SPED não é mais gravado em disco: é montado sob demanda no download.
function buildGeneratedFileName({ loteId, company, month, year }) {
  const cnpj = String(company?.cnpj || '').replace(/\D+/g, '') || 'semcnpj';
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);
  return `SPED_FISCAL_${cnpj}_${yyyy}_${mm}_LOTE_${loteId}.txt`;
}

async function updateLoteAfterGeneration(loteId, { status, arquivo_path, hash_arquivo }) {
  await pool.query(
    `
      UPDATE sped_fiscal_lotes
      SET status = $2,
          arquivo_path = $3,
          hash_arquivo = $4,
          gerado_em = NOW()
      WHERE id = $1
    `,
    [loteId, status, arquivo_path, hash_arquivo]
  );
}

async function getGeneratedFileByLoteId(loteId) {
  await ensureBaseTables();

  const { rows } = await pool.query(
    `
      SELECT *
      FROM sped_fiscal_lotes
      WHERE id = $1
      LIMIT 1
    `,
    [loteId]
  );

  return rows[0] || null;
}

export default {
  getCompany,
  getParticipants,
  getProducts,
  getFiscalDocuments,
  getTransportDocuments,
  getInventory,
  getApuracao,
  getParameters,
  createLote,
  saveInconsistencies,
  buildGeneratedFileName,
  updateLoteAfterGeneration,
  getGeneratedFileByLoteId,
};