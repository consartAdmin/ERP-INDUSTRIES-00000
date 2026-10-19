// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInbox.sql.js — Fragmentos SQL: filtros, colunas, JOINs, ORDER BY  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { MIN_XML_LEN, DEFAULT_SORT_COLUMN } from './nfeInbox.constants.js';
import { onlyDigits, escapeLike } from './nfeInbox.sanitizers.js';

export function buildListFilters({
  cnpjEmpresa,
  situacao,
  manifestacao,
  dataIni,
  dataFim,
  q,
} = {}) {
  const values = [];
  const where = [];

  if (cnpjEmpresa) {
    values.push(onlyDigits(cnpjEmpresa));
    where.push(`ni.cnpj_empresa = $${values.length}`);
  }

  if (situacao) {
    values.push(String(situacao));
    where.push(`ni.situacao = $${values.length}`);
  }

  if (manifestacao) {
    // Compara a operação dentro do JSONB, não o JSON serializado:
    // ILIKE sobre manifestacao::text casaria também com nomes de chave
    // e nunca usaria o índice GIN.
    values.push(String(manifestacao));
    where.push(`ni.manifestacao->>'operacao' = $${values.length}`);
  }

  if (dataIni) {
    values.push(dataIni);
    where.push(`COALESCE(ni.data_autorizacao, ni.data_emissao) >= $${values.length}::date`);
  }

  if (dataFim) {
    values.push(dataFim);
    where.push(`COALESCE(ni.data_autorizacao, ni.data_emissao) < ($${values.length}::date + INTERVAL '1 day')`);
  }

  if (q) {
    const search = String(q).trim();
    const qDigits = onlyDigits(search);

    if (qDigits.length === 44) {
      values.push(qDigits);
      where.push(`ni.chave_nfe = $${values.length}`);
    } else {
      values.push(`%${escapeLike(search)}%`);
      const textIdx = values.length;

      const conds = [
        `COALESCE(ni.numero, '') ILIKE $${textIdx} ESCAPE '\\'`,
        `COALESCE(ni.emitente_razao, '') ILIKE $${textIdx} ESCAPE '\\'`,
        `COALESCE(ni.destinatario_razao, '') ILIKE $${textIdx} ESCAPE '\\'`,
        `COALESCE(ni.chave_nfe, '') ILIKE $${textIdx} ESCAPE '\\'`,
      ];

      // CNPJ é gravado só com dígitos: buscar "12.345.678/0001-99" na coluna
      // crua nunca casa. Compara a forma normalizada em paralelo.
      if (qDigits.length >= 8) {
        values.push(`%${qDigits}%`);
        const digitIdx = values.length;
        conds.push(
          `COALESCE(ni.emitente_cnpj, '') LIKE $${digitIdx}`,
          `COALESCE(ni.destinatario_cnpj, '') LIKE $${digitIdx}`
        );
      }

      where.push(`(${conds.join(' OR ')})`);
    }
  }

  return {
    values,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  };
}

// ======================================================================
// Projeção da listagem
// xml_completo (TEXT, dezenas/centenas de KB por nota) fica FORA daqui:
// com limit=100 a grade trafegaria megabytes por página sem necessidade —
// a flag has_xml já diz ao frontend se existe XML para baixar.
// Listar coluna a coluna também elimina o `entrada_criada` duplicado que
// `ni.*` criava junto da coluna calculada.
// ======================================================================
export const LIST_COLUMNS = `
  ni.id,
  ni.cnpj_empresa,
  ni.chave_nfe,
  ni.nsu,
  ni.situacao,
  ni.tipo_operacao,
  ni.modelo,
  ni.serie,
  ni.numero,
  ni.emitente_cnpj,
  ni.emitente_razao,
  ni.destinatario_cnpj,
  ni.destinatario_razao,
  ni.data_emissao,
  ni.data_autorizacao,
  ni.valor_total,
  ni.xml_resumido,
  ni.manifestacao,
  ni.manifestado_em,
  ni.origem,
  ni.entrada_criada AS entrada_criada_flag,
  ni.created_at,
  ni.updated_at
`;

// ======================================================================
// JOIN com inboundInvoices
// LATERAL + LIMIT 1: access_key não é única em inboundInvoices (reentrada,
// correção, importação repetida). Com LEFT JOIN simples uma chave duplicada
// multiplicava a linha em list() enquanto count() — que não tem JOIN —
// continuava contando 1, desalinhando a paginação.
// ======================================================================
export const INBOUND_JOIN = `
  LEFT JOIN LATERAL (
    SELECT i.inbound_id
    FROM public."inboundInvoices" i
    WHERE i.access_key = ni.chave_nfe
    ORDER BY i.inbound_id DESC
    LIMIT 1
  ) inv ON true
  LEFT JOIN LATERAL (
    SELECT e.expenseentryid
    FROM public."expenseEntries" e
    WHERE e.documentkey = ni.chave_nfe
      AND UPPER(COALESCE(e.status, '')) <> 'CANCELED'
    ORDER BY e.expenseentryid DESC
    LIMIT 1
  ) exp ON true
`;

// Nota lançada como Entrada Fiscal (estoque) OU como Entrada de Despesa
// (uso e consumo) conta como "Já lançada" nos dois módulos.
export const ENTRADA_CRIADA_EXPR = `
  (inv.inbound_id IS NOT NULL OR exp.expenseentryid IS NOT NULL OR ni.entrada_criada = true)
`;

// substr antes do length permite detoast parcial do TEXT: char_length()
// sobre a coluna inteira obrigava a descompactar todo o XML linha a linha.
export const HAS_XML_EXPR = `
  (length(substr(ni.xml_completo, 1, ${MIN_XML_LEN + 1})) > ${MIN_XML_LEN})
`;

// ======================================================================
// Ordenação
// O mapa abaixo é a única fonte de SQL de ordenação. Nada vindo do
// cliente é interpolado na query: `sort` é apenas uma chave de busca
// neste objeto e `order` só pode produzir os literais ASC ou DESC.
// ======================================================================
const SORT_COLUMNS = Object.freeze({
  // Mesma regra usada na exibição: autorização com fallback para emissão.
  data_autorizacao: `COALESCE(ni.data_autorizacao, ni.data_emissao)`,

  chave_nfe: `ni.chave_nfe`,

  // numero é VARCHAR: ordenar como texto colocaria '1000' antes de '999'.
  // Extrai só dígitos e ordena numericamente; não-numéricos viram NULL.
  // ::numeric (e não ::bigint) porque a coluna aceita até 20 dígitos.
  numero: `NULLIF(regexp_replace(COALESCE(ni.numero, ''), '\\D', '', 'g'), '')::numeric`,

  emitente_razao: `COALESCE(ni.emitente_razao, ni.emitente_cnpj)`,

  destinatario_razao: `COALESCE(ni.destinatario_razao, ni.destinatario_cnpj)`,

  valor_total: `ni.valor_total`,

  // Coluna calculada no SELECT: precisa repetir a expressão, senão o
  // ORDER BY cairia na coluna-base e ignoraria o JOIN de inboundInvoices.
  entrada_criada: ENTRADA_CRIADA_EXPR,

  // manifestacao é JSONB; extrai a operação com cast como fallback.
  manifestacao: `COALESCE(ni.manifestacao->>'operacao', ni.manifestacao::text)`,
});

/** Colunas aceitas em `sort` (espelha o whitelist do frontend). */
export const SORTABLE_COLUMNS = Object.freeze(Object.keys(SORT_COLUMNS));

export function buildOrderBy(sort, order) {
  const expr =
    SORT_COLUMNS[String(sort || '').trim()] ||
    SORT_COLUMNS[DEFAULT_SORT_COLUMN];

  const dir =
    String(order || '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // ni.id como desempate: sem ele, registros com valores iguais podem
  // trocar de posição entre páginas, repetindo ou escondendo linhas.
  //
  // NULLS LAST é obrigatório aqui E na definição do índice
  // idx_nfeinbox_data_ord_v2: em índice, DESC significa DESC NULLS FIRST,
  // e o planner só aproveita o índice se as duas cláusulas baterem.
  return `ORDER BY ${expr} ${dir} NULLS LAST, ni.id DESC`;
}
