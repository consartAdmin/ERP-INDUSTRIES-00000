// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.generator.js                                             ║
// ║ Descrição: Geração do TXT SPED Fiscal                               ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import layout from './spedFiscal.layout2026.js';
import { mapBloco0 } from './spedFiscal.mappers/bloco0.mapper.js';
import { mapBlocoC } from './spedFiscal.mappers/blocoC.mapper.js';
import { mapBlocoD } from './spedFiscal.mappers/blocoD.mapper.js';
import { mapBlocoE } from './spedFiscal.mappers/blocoE.mapper.js';
import { mapBlocoH } from './spedFiscal.mappers/blocoH.mapper.js';
import { mapBloco1 } from './spedFiscal.mappers/bloco1.mapper.js';
import { mapBloco9 } from './spedFiscal.mappers/bloco9.mapper.js';

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function formatDateDDMMYYYY(value) {
  if (!value) return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';

    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const yyyy = String(value.getFullYear());

    return `${dd}${mm}${yyyy}`;
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}${mm}${yyyy}`;
  }

  if (/^\d{8}$/.test(text)) {
    return text;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${dd}${mm}${yyyy}`;
  }

  return '';
}

export function formatDecimal(value, places = 2) {
  if (value === null || value === undefined || value === '') return '';

  const n = Number(value);
  if (Number.isNaN(n)) return '';

  return n.toFixed(places).replace('.', ',');
}

export function sanitizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function line(...fields) {
  return `|${fields.map(value => value ?? '').join('|')}|`;
}

export function countByRegister(lines = []) {
  const map = new Map();

  for (const row of lines) {
    if (typeof row !== 'string') continue;

    const match = row.match(/^\|([^|]+)\|/);
    if (!match) continue;

    const register = match[1];
    map.set(register, (map.get(register) || 0) + 1);
  }

  return map;
}

function closeBlock(lines = [], closingRegister) {
  const normalizedLines = Array.isArray(lines) ? [...lines] : [];
  const alreadyClosed = normalizedLines.some(
    row => typeof row === 'string' && row.startsWith(`|${closingRegister}|`),
  );

  if (!alreadyClosed) {
    // The closing record counts every line in its block, including itself.
    normalizedLines.push(line(closingRegister, normalizedLines.length + 1));
  }

  return normalizedLines;
}

function emptyBlock(openingRegister, closingRegister) {
  return [
    line(openingRegister, '1'),
    line(closingRegister, 2),
  ];
}

export function generateSpedTxt(context) {
  const bloco0 = closeBlock(mapBloco0(context), '0990');
  const blocoB = emptyBlock('B001', 'B990');
  const blocoC = closeBlock(mapBlocoC(context), 'C990');
  const blocoD = closeBlock(mapBlocoD(context), 'D990');
  const blocoE = closeBlock(mapBlocoE(context), 'E990');
  const blocoG = emptyBlock('G001', 'G990');
  const blocoH = closeBlock(mapBlocoH(context), 'H990');
  const blocoK = emptyBlock('K001', 'K990');
  const bloco1 = closeBlock(mapBloco1(context), '1990');

  const partialLines = [
    ...bloco0,
    ...blocoB,
    ...blocoC,
    ...blocoD,
    ...blocoE,
    ...blocoG,
    ...blocoH,
    ...blocoK,
    ...bloco1,
  ];

  const registerCounter = countByRegister(partialLines);
  const bloco9 = mapBloco9(context, partialLines, registerCounter);
  const allLines = [...partialLines, ...bloco9];

  const lineBreak = layout.txtLineBreak || '\r\n';

  // O PVA EFD ICMS/IPI exige que inclusive o último registro (9999)
  // termine com o caractere configurado de final de linha.
  return `${allLines.join(lineBreak)}${lineBreak}`;
}
