// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.source.js                                                ║
// ║ Descrição: Fonte de dados da empresa para o SPED Fiscal             ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../../config/db.js';

function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export async function getEnterpriseSource(enterpriseId) {
  const id = Number(enterpriseId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid enterpriseId.');
  }

  const { rows } = await pool.query(
    `
      SELECT
        id,
        corporate_name         AS razao_social,
        trade_name             AS nome_fantasia,
        cnpj,
        state_registration     AS ie,
        municipal_registration AS im,
        state                  AS uf,
        city_ibge_code         AS cod_mun,
        zip_code               AS cep,
        address                AS endereco,
        address_number         AS numero,
        address_complement     AS complemento,
        district               AS bairro,
        phone                  AS telefone,
        email,
        tax_regime_code,
        sped_profile,
        sped_activity_type,
        nfe_environment,
        nfe_series,
        next_nfe_number,
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
    [id]
  );

  const row = rows[0] || null;

  if (!row) return null;

  return {
    id: row.id,
    razao_social: row.razao_social,
    nome_fantasia: row.nome_fantasia,
    cnpj: onlyDigits(row.cnpj),
    ie: row.ie || '',
    im: row.im || '',
    uf: row.uf || '',
    cod_mun: onlyDigits(row.cod_mun || ''),
    cep: onlyDigits(row.cep || ''),
    endereco: row.endereco || '',
    numero: row.numero || '',
    complemento: row.complemento || '',
    bairro: row.bairro || '',
    telefone: onlyDigits(row.telefone || ''),
    email: row.email || '',
    tax_regime_code: row.tax_regime_code || '',
    sped_profile: row.sped_profile || '',
    sped_activity_type: row.sped_activity_type || '',
    nfe_environment: row.nfe_environment || '',
    nfe_series: row.nfe_series || '',
    next_nfe_number: Number(row.next_nfe_number || 1),
    logo_url: row.logo_url || '',
    slogan: row.slogan || '',
    document_notes: row.document_notes || '',
    pdf_footer: row.pdf_footer || '',
    accountant_name: row.accountant_name || '',
    accountant_cpf: row.accountant_cpf || '',
    accountant_crc: row.accountant_crc || '',
    accountant_email: row.accountant_email || '',
    accountant_phone: row.accountant_phone || '',
    is_active: row.is_active !== false
  };
}

export default {
  getEnterpriseSource
};