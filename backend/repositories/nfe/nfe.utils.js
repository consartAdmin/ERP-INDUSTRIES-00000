// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfe.utils.js — Helpers gerais NF-e                                   ║
// ║ ✔ Modo de estoque, arredondamento, somatórios                        ║
// ║ ✔ IBGE da cidade + config da empresa (ENV)                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { resolveFeature } from '../appFeatures/appFeatures.index.js';

/* =========================================================================
 * 🔧 Helpers gerais
 * ========================================================================= */
export async function resolveActiveStockMode() {
  const feature = await resolveFeature({
    featureCode: 'PRODUCT_STOCK_MODE',
    scopeType: 'GLOBAL',
    scopeId: 1,
  });

  if (!feature) {
    throw new Error(
      '[NFE] Feature STOCK_MODE não cadastrada.'
    );
  }

  if (!feature.enabled) {
    throw new Error(
      '[NFE] Feature STOCK_MODE desativada.'
    );
  }

  const mode = String(
    feature.optionCode || ''
  )
    .trim()
    .toUpperCase();

  const isSimple =
    mode === 'STOCK_SIMPLE';

  const isWithLot =
    mode === 'STOCK_WITH_LOT';

  if (!isSimple && !isWithLot) {
    throw new Error(
      `[NFE] STOCK_MODE inválido: "${mode}".`
    );
  }

  return {
    mode,
    isSimple,
    isWithLot,
    requireLot: isWithLot,
    feature,
  };
}

export function round2(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

export function round4(v) {
  return Math.round(Number(v || 0) * 10000) / 10000;
}

export function money(v) {
  return round2(Number(v || 0));
}

export function nearlyEqual(a, b, tolerance = 0.01) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
}

export function sum(arr, getter) {
  return (Array.isArray(arr) ? arr : []).reduce(
    (acc, item) => acc + Number(getter(item) || 0),
    0,
  );
}

export function onlyDigits(v) {
  return (v ?? '').toString().replace(/\D+/g, '');
}

export function toUpperSafe(v) {
  return String(v || '').trim().toUpperCase();
}

export function toStr(v) {
  return v == null ? '' : String(v);
}

/* =========================================================================
 * 🏙️ Código IBGE do Município
 * ========================================================================= */
export function pickCodigoCidadeIbgeFromSources(customer = {}, header = {}) {
  const candidates = [
    customer.code_ibge,
    customer.ibge_code,
    customer.codigo_ibge,
    customer.customer_codigo_ibge,
    customer.city_ibge,
    customer.municipio_ibge,
    customer.ibge,

    header.code_ibge,
    header.ibge_code,
    header.codigo_ibge,
    header.customer_codigo_ibge,
    header.customer_ibge_code,
    header.customer_city_ibge,
    header.customer_municipio_ibge,
    header.customer_ibge,
    header.ibge,
  ];

  for (const v of candidates) {
    const d = onlyDigits(v);
    if (d && d.length === 7) return d;
  }
  return null;
}

export function resolveCodigoCidadeIbge(uf, cidade, customer = {}, header = {}) {
  const fromData = pickCodigoCidadeIbgeFromSources(customer, header);

  if (!fromData) {
    throw new Error(
      `[NFE] Código IBGE do município ausente. Cidade=${cidade} UF=${uf}. Corrija o cadastro do cliente.`,
    );
  }

  return fromData;
}

/* =========================================================================
 * 🏢 Empresa
 * ========================================================================= */
export function getEmpresaConfig() {
  return {
    EMPRESA_CNPJ: process.env.EMPRESA_CNPJ || '00000000000000',
    EMPRESA_RAZAO: process.env.EMPRESA_RAZAO || 'RAZAO SOCIAL PADRÃO',
    EMPRESA_FANTASIA: process.env.EMPRESA_FANTASIA || 'NOME FANTASIA PADRÃO',
    RESPONSAVEL_CNPJ:
      process.env.RESPONSAVEL_CNPJ ||
      process.env.EMPRESA_CNPJ ||
      '00000000000000',
    RESPONSAVEL_NOME:
      process.env.RESPONSAVEL_NOME ||
      process.env.EMPRESA_FANTASIA ||
      'RESPONSÁVEL PADRÃO',
    RESPONSAVEL_EMAIL:
      process.env.RESPONSAVEL_EMAIL ||
      process.env.EMPRESA_EMAIL ||
      'contato@consart.com.br',
    RESPONSAVEL_TELEFONE:
      process.env.RESPONSAVEL_TELEFONE ||
      process.env.EMPRESA_FONE ||
      null,
  };
}
