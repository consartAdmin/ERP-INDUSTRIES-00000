// ╔══════════════════════════════════════════════════════════════════════╗
// ║ blocoD.mapper.js                                                    ║
// ║ Descrição: Mapeamento do Bloco D                                    ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { line } from '../spedFiscal.generator.js';

export function mapBlocoD(ctx) {
  const transportDocs = Array.isArray(ctx.transportDocuments) ? ctx.transportDocuments : [];
  const lines = [];

  lines.push(line('D001', transportDocs.length ? '0' : '1'));

  return lines;
}