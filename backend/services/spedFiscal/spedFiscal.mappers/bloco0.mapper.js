// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bloco0.mapper.js                                                    ║
// ║ Descrição: Mapeamento do Bloco 0                                    ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import layout from '../spedFiscal.layout2026.js';

import {
  formatDateDDMMYYYY,
  formatDecimal,
  line,
  onlyDigits,
  sanitizeText,
} from '../spedFiscal.generator.js';

function requireSpedDate(value, fieldName) {
  const formatted = formatDateDDMMYYYY(value);

  if (!/^\d{8}$/.test(formatted)) {
    const error = new Error(
      `[SPED][0000] ${fieldName} inválida. Valor recebido: ${String(value ?? '')}`,
    );

    error.code = 'SPED_0000_INVALID_DATE';
    error.field = fieldName;
    error.received_value = value ?? null;

    throw error;
  }

  return formatted;
}

function formatStateRegistration(value, uf) {
  const digits = onlyDigits(value);

  // PostgreSQL numeric columns remove significant leading zeroes. Minas
  // Gerais uses a fixed 13-digit state registration in the SPED file.
  if (digits && String(uf || '').trim().toUpperCase() === 'MG') {
    return digits.padStart(13, '0');
  }

  return digits;
}

function requireAccountantField(value, fieldName, validator = value => Boolean(value)) {
  if (!validator(value)) {
    const error = new Error(
      `[SPED][0100] ${fieldName} do contabilista não informado ou inválido.`,
    );

    error.code = 'SPED_0100_INVALID_ACCOUNTANT';
    error.field = fieldName;

    throw error;
  }

  return value;
}

export function mapBloco0(ctx) {
  const company = ctx.company || {};
  const accountant = ctx.accountant || {};
  const participants = Array.isArray(ctx.participants) ? ctx.participants : [];
  const products = Array.isArray(ctx.products) ? ctx.products : [];
  const documents = Array.isArray(ctx.documents) ? ctx.documents : [];
  const inventory = Array.isArray(ctx.inventory) ? ctx.inventory : [];

  const dateStart = requireSpedDate(ctx.period?.dateStart, 'DT_INI');
  const dateEnd = requireSpedDate(ctx.period?.dateEnd, 'DT_FIN');

  const unitsSet = new Set();

  for (const product of products) {
    const unit = String(product.unidade || '').trim();
    if (unit) unitsSet.add(unit);
  }

  for (const document of documents) {
    const isOwnIssuedNfe = String(document.cod_mod || '55') === '55'
      && String(document.ind_emit ?? '') === '0';

    if (isOwnIssuedNfe) continue;

    for (const item of Array.isArray(document.items) ? document.items : []) {
      const unit = String(item.unidade || '').trim();
      if (unit) unitsSet.add(unit);
    }
  }

  for (const item of inventory) {
    const unit = String(item.unidade || '').trim();
    if (unit) unitsSet.add(unit);
  }

  const lines = [];

  lines.push(
    line(
      '0000',
      layout.defaults.codVer,
      layout.defaults.codFin,
      dateStart,
      dateEnd,
      sanitizeText(company.razao_social),
      onlyDigits(company.cnpj),
      onlyDigits(company.cpf),
      String(company.uf || '').trim().toUpperCase(),
      formatStateRegistration(company.ie, company.uf),
      onlyDigits(company.cod_mun || layout.defaults.codMunFallback),
      onlyDigits(company.im),
      onlyDigits(company.suframa),
      layout.defaults.indPerfil,
      layout.defaults.indAtiv,
    ),
  );

  lines.push(line('0001', '0'));

  lines.push(
    line(
      '0005',
      sanitizeText(company.nome_fantasia || company.razao_social),
      onlyDigits(company.cep),
      sanitizeText(company.endereco),
      sanitizeText(company.numero),
      sanitizeText(company.complemento),
      sanitizeText(company.bairro),
      onlyDigits(company.telefone),
      onlyDigits(company.fax),
      sanitizeText(company.email),
    ),
  );

  const accountantName = sanitizeText(
    accountant.nome || accountant.name || company.accountant_name,
  );
  const accountantCpf = onlyDigits(
    accountant.cpf || company.accountant_cpf,
  );
  const accountantCrc = sanitizeText(
    accountant.crc || company.accountant_crc,
  );
  const accountantEmail = sanitizeText(
    accountant.email || company.accountant_email,
  );
  const accountantMunicipalityCode = onlyDigits(
    accountant.cod_mun || accountant.city_ibge_code || company.cod_mun,
  );

  requireAccountantField(accountantName, 'NOME');
  requireAccountantField(
    accountantCpf,
    'CPF',
    value => /^\d{11}$/.test(value),
  );
  requireAccountantField(
    accountantCrc,
    'CRC',
    value => Boolean(value) && value.length <= 15,
  );
  requireAccountantField(
    accountantEmail,
    'EMAIL',
    value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  );
  requireAccountantField(
    accountantMunicipalityCode,
    'COD_MUN',
    value => /^\d{7}$/.test(value),
  );

  lines.push(
    line(
      '0100',
      accountantName,
      accountantCpf,
      accountantCrc,
      onlyDigits(accountant.cnpj),
      onlyDigits(accountant.cep),
      sanitizeText(accountant.endereco || accountant.address),
      sanitizeText(accountant.numero || accountant.address_number),
      sanitizeText(accountant.complemento || accountant.address_complement),
      sanitizeText(accountant.bairro || accountant.district),
      onlyDigits(
        accountant.telefone || accountant.phone || company.accountant_phone,
      ),
      onlyDigits(accountant.fax),
      accountantEmail,
      accountantMunicipalityCode,
    ),
  );

  for (const participant of participants) {
    lines.push(
      line(
        '0150',
        participant.codigo || '',
        sanitizeText(participant.nome),
        participant.cod_pais || '1058',
        onlyDigits(participant.cnpj),
        onlyDigits(participant.cpf),
        onlyDigits(participant.ie),
        onlyDigits(participant.cod_mun),
        sanitizeText(participant.suframa),
        sanitizeText(participant.endereco),
        sanitizeText(participant.numero),
        sanitizeText(participant.complemento),
        sanitizeText(participant.bairro),
      ),
    );
  }

  for (const unit of unitsSet) {
    lines.push(line('0190', unit, sanitizeText(unit)));
  }

  for (const product of products) {
    lines.push(
      line(
        '0200',
        product.codigo || '',
        sanitizeText(product.descricao),
        onlyDigits(product.codigo_barra || product.barcode),
        sanitizeText(product.codigo_anterior || product.cod_ant_item),
        sanitizeText(product.unidade),
        product.tipo_item || '00',
        onlyDigits(product.ncm),
        product.ex_ipi || '',
        onlyDigits(product.genero),
        onlyDigits(product.cod_lsit),
        formatDecimal(product.aliq_icms, 2),
        onlyDigits(product.cest),
      ),
    );
  }

  return lines;
}
