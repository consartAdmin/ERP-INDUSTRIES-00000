// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInboxUpsert.repository.js — upsertFromParsedNfe / saveXml...ById  ║
// ║ Tabela: public."nfeInbox"                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, MIN_XML_LEN } from './nfeInbox.constants.js';
import { onlyDigits, cnpj14, toNumber } from './nfeInbox.sanitizers.js';

// ======================================================================
// Salvar XML completo por ID
// RETURNING enxuto: devolver * ecoaria de volta o XML recém-enviado.
// ======================================================================
export async function saveXmlCompletoById(id, xmlText) {
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return null;

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET xml_completo = $2,
        updated_at = now()
    WHERE id = $1
    RETURNING id, chave_nfe, updated_at;
    `,
    [idNum, xmlText || null]
  );

  return rows[0] || null;
}

// ======================================================================
// UPSERT a partir de objeto normalizado (PlugNotas/DF-e)
// ======================================================================
export async function upsertFromParsedNfe(parsed = {}) {
  const {
    cnpj_empresa,
    chave_nfe,

    nsu,
    situacao,
    tipo_operacao,

    modelo,
    serie,
    numero,

    data_emissao,
    data_autorizacao,

    emitente_cnpj,
    emitente_razao,
    destinatario_cnpj,
    destinatario_razao,

    valor_total,

    xml_resumido,
    xml_completo,

    manifestacao,
    manifestado_em,

    origem,
    entrada_criada,
  } = parsed;

  const chave = onlyDigits(chave_nfe);
  if (!chave || chave.length !== 44) {
    throw new Error('upsertFromParsedNfe: chave_nfe inválida/obrigatória (44 dígitos)');
  }

  const cnpjEmpresaFinal = onlyDigits(cnpj_empresa || destinatario_cnpj || '');
  if (!cnpjEmpresaFinal || cnpjEmpresaFinal.length !== 14) {
    throw new Error('upsertFromParsedNfe: cnpj_empresa inválido/obrigatório (14 dígitos)');
  }

  // null quando o parse não trouxe situação: o default 'PENDENTE' só vale no
  // INSERT. No UPDATE, sobrescrever com 'PENDENTE' rebaixava nota já
  // manifestada/concluída a cada sincronização de resumo.
  const situacaoFinal = situacao ? String(situacao) : null;

  const sql = `
    INSERT INTO ${TB} (
      cnpj_empresa,
      chave_nfe,
      nsu,
      situacao,
      tipo_operacao,
      modelo,
      serie,
      numero,
      data_emissao,
      data_autorizacao,
      emitente_cnpj,
      emitente_razao,
      destinatario_cnpj,
      destinatario_razao,
      valor_total,
      xml_resumido,
      xml_completo,
      manifestacao,
      manifestado_em,
      origem,
      entrada_criada,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      COALESCE($4, 'PENDENTE'),
      $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
      $16::jsonb,
      $17,
      $18::jsonb,
      $19,$20,$21,
      now()
    )
    ON CONFLICT (chave_nfe) DO UPDATE SET
      cnpj_empresa       = EXCLUDED.cnpj_empresa,
      nsu                = COALESCE(EXCLUDED.nsu, ${TB}.nsu),
      situacao           = COALESCE(EXCLUDED.situacao, ${TB}.situacao),
      tipo_operacao      = COALESCE(EXCLUDED.tipo_operacao, ${TB}.tipo_operacao),
      modelo             = COALESCE(EXCLUDED.modelo, ${TB}.modelo),
      serie              = COALESCE(EXCLUDED.serie, ${TB}.serie),
      numero             = COALESCE(EXCLUDED.numero, ${TB}.numero),
      data_emissao       = COALESCE(EXCLUDED.data_emissao, ${TB}.data_emissao),
      data_autorizacao   = COALESCE(EXCLUDED.data_autorizacao, ${TB}.data_autorizacao),
      emitente_cnpj      = COALESCE(EXCLUDED.emitente_cnpj, ${TB}.emitente_cnpj),
      emitente_razao     = COALESCE(EXCLUDED.emitente_razao, ${TB}.emitente_razao),
      destinatario_cnpj  = COALESCE(EXCLUDED.destinatario_cnpj, ${TB}.destinatario_cnpj),
      destinatario_razao = COALESCE(EXCLUDED.destinatario_razao, ${TB}.destinatario_razao),
      valor_total        = COALESCE(EXCLUDED.valor_total, ${TB}.valor_total),

      xml_resumido       = COALESCE(EXCLUDED.xml_resumido, ${TB}.xml_resumido),

      xml_completo       = CASE
        WHEN EXCLUDED.xml_completo IS NOT NULL
         AND length(substr(EXCLUDED.xml_completo, 1, ${MIN_XML_LEN + 1})) > ${MIN_XML_LEN}
          THEN EXCLUDED.xml_completo
        ELSE ${TB}.xml_completo
      END,

      manifestacao       = COALESCE(EXCLUDED.manifestacao, ${TB}.manifestacao),
      manifestado_em     = COALESCE(EXCLUDED.manifestado_em, ${TB}.manifestado_em),
      origem             = COALESCE(EXCLUDED.origem, ${TB}.origem),

      entrada_criada     = COALESCE(EXCLUDED.entrada_criada, ${TB}.entrada_criada),
      updated_at         = now()
    RETURNING *;
  `;

  const values = [
    cnpjEmpresaFinal,
    chave,

    toNumber(nsu),
    situacaoFinal,
    tipo_operacao || null,

    modelo || null,
    serie || null,
    numero != null && numero !== '' ? String(numero) : null,

    data_emissao || null,
    data_autorizacao || null,

    cnpj14(emitente_cnpj),
    emitente_razao || null,
    cnpj14(destinatario_cnpj),
    destinatario_razao || null,

    toNumber(valor_total),

    xml_resumido != null ? JSON.stringify(xml_resumido) : null,
    xml_completo || null,

    manifestacao != null ? JSON.stringify(manifestacao) : null,
    manifestado_em || null,

    origem || null,
    typeof entrada_criada === 'boolean' ? entrada_criada : null,
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}
