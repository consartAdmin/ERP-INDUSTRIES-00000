// moveCatalogs.mjs — move services/apis/<X>/catalog_schema.<Y>.js para
// repositories/<X>/<Y>.catalog.js (git mv) e reescreve os imports.
// Uso: node scripts/moveCatalogs.mjs <X> [<X> ...]

import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' });

for (const mod of process.argv.slice(2)) {
  const src = `services/apis/${mod}`;
  if (!existsSync(src)) { console.log(`SKIP ${mod}: pasta não existe`); continue; }
  mkdirSync(`repositories/${mod}`, { recursive: true });
  for (const f of readdirSync(src)) {
    const m = f.match(/^catalog_schema\.(.+)\.js$/);
    if (!m) continue;
    const from = `${src}/${f}`;
    const to = `repositories/${mod}/${m[1]}.catalog.js`;
    run(`git mv "${from}" "${to}"`);
    const out = run(`node scripts/rewireImport.mjs "${from}" "${to}"`).trim().split(/\r?\n/).pop();
    console.log(`${from} -> ${to}  (${out})`);
  }
}
