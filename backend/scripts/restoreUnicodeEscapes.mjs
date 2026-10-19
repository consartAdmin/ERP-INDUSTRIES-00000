// restoreUnicodeEscapes.mjs — reverte caracteres combinantes (U+0300–U+036F) gravados
// literalmente em repositories/**.js para a forma de escape usada no código original.
// (A ferramenta de escrita converte escapes unicode em caracteres literais.)
// Uso: node scripts/restoreUnicodeEscapes.mjs [pasta=repositories]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BS = String.fromCharCode(92); // barra invertida
const root = process.argv[2] || 'repositories';

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : [],
  );

const isCombining = (cp) => cp >= 0x300 && cp <= 0x36f;

let files = 0;
for (const f of walk(root)) {
  const src = readFileSync(f, 'utf8');
  let changed = false;
  let out = '';
  for (const ch of src) {
    const cp = ch.codePointAt(0);
    if (isCombining(cp)) {
      out += BS + 'u' + cp.toString(16).padStart(4, '0');
      changed = true;
    } else {
      out += ch;
    }
  }
  if (changed) {
    writeFileSync(f, out);
    files++;
    console.log('fixed', f);
  }
}
console.log(`${files} arquivo(s) corrigidos.`);
