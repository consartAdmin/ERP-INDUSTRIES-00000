// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bloco9.mapper.js — Mapeamento e totalização do Bloco 9             ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { line } from '../spedFiscal.generator.js';

export function mapBloco9(ctx, partialLines = [], registerCounter = new Map()) {
  const counters = new Map(registerCounter);

  // The 9900 records must also total the four register types in Block 9.
  const total9900Records = counters.size + 4;
  counters.set('9001', 1);
  counters.set('9900', total9900Records);
  counters.set('9990', 1);
  counters.set('9999', 1);

  const lines = [line('9001', '0')];

  for (const [register, count] of counters.entries()) {
    lines.push(line('9900', register, count));
  }

  // 9001 + all 9900 records + 9990 itself + 9999.
  // Although 9999 is outside Block 9, the official guide requires it in
  // QTD_LIN_9.
  lines.push(line('9990', lines.length + 2));

  // Every line in the file, including 9999 itself.
  lines.push(line('9999', partialLines.length + lines.length + 1));

  return lines;
}
