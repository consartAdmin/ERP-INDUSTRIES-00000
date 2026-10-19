// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sefazApi.js — Consulta cadastral de CNPJ para Fornecedores          ║
// ║ PRODNEX ERP — usa o backend GET /api/public-cnpj/:cnpj              ║
// ║ Mantém a interface: searchSefazByCnpj / searchSefazByIe             ║
// ╚══════════════════════════════════════════════════════════════════════╝

const PUBLIC_CNPJ_API = '/api/public-cnpj';

/**
 * Remove tudo que não for dígito.
 */
function onlyDigits(v = '') {
  return String(v).replace(/\D+/g, '');
}

/**
 * Escolhe a IE ativa da UF do estabelecimento (ou a primeira disponível).
 */
function pickInscricaoEstadual(list = [], uf = '') {
  if (!Array.isArray(list) || !list.length) return null;
  const match = list.find((ie) => ie?.ativo && ie?.estado?.sigla === uf)
    || list.find((ie) => ie?.ativo)
    || list[0];
  return match?.inscricao_estadual || null;
}

/**
 * Normaliza o payload da API pública (publica.cnpj.ws) para o formato
 * usado pelas telas de fornecedores.
 */
function normalizeCadastro(raw, cnpjDigits) {
  const d = raw?.dados || raw?.data || raw || {};
  const est = d.estabelecimento || {};
  const uf = est.estado?.sigla || est.uf || null;

  const tipoLogradouro = est.tipo_logradouro ? String(est.tipo_logradouro).toUpperCase() : null;
  const logradouro = est.logradouro || null;
  const logradouroCompleto = [tipoLogradouro, logradouro].filter(Boolean).join(' ') || null;

  let telefone = null;
  if (est.telefone1) telefone = est.ddd1 ? `(${est.ddd1}) ${est.telefone1}` : est.telefone1;

  return {
    cnpj: cnpjDigits,
    cpfCnpj: cnpjDigits,

    nome: d.razao_social || null,
    razao_social: d.razao_social || null,
    fantasia: est.nome_fantasia || null,

    inscricao_estadual: pickInscricaoEstadual(est.inscricoes_estaduais, uf),
    inscricao_municipal: null,

    email: est.email ? String(est.email).toLowerCase() : null,
    telefone,

    cep: est.cep ? onlyDigits(est.cep) : null,
    tipo_logradouro: tipoLogradouro,
    logradouro,
    logradouro_completo: logradouroCompleto,
    numero: est.numero || null,
    complemento: est.complemento || null,
    bairro: est.bairro || null,
    municipio: est.cidade?.nome || null,
    uf,
  };
}

/**
 * Consulta por CNPJ via backend.
 * @param {Object} params
 * @param {string} params.cnpj
 * @param {string|null} params.uf
 */
async function searchSefazByCnpj({ cnpj, uf = null }) { // eslint-disable-line no-unused-vars
  const digits = onlyDigits(cnpj);

  if (digits.length !== 14) {
    throw new Error('CNPJ inválido (14 dígitos obrigatórios).');
  }

  const response = await fetch(`${PUBLIC_CNPJ_API}/${digits}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.error) {
    throw new Error(json?.message || `Falha na consulta de CNPJ (HTTP ${response.status}).`);
  }

  return normalizeCadastro(json, digits);
}

/**
 * Consulta por IE + UF — ainda não implementada.
 */
async function searchSefazByIe({ uf, ie }) { // eslint-disable-line no-unused-vars
  throw new Error('Consulta por IE ainda não implementada.');
}

export default {
  searchSefazByCnpj,
  searchSefazByIe,
};
