// rewireApiImports.mjs — troca os imports de services/apis/<nameApi>.js
// por repositories/<repoDir>/<repoDir>.index.js em todo o backend (exceto public/ e node_modules/).
// Uso: node scripts/rewireApiImports.mjs <nameApi> <repoDir> [--dry]

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const [name, repoDir, flag] = process.argv.slice(2);
if (!name || !repoDir) {
  console.error('Uso: node scripts/rewireApiImports.mjs <nameApi> <repoDir> [--dry]');
  process.exit(2);
}
const dry = flag === '--dry';

const root = path.resolve('.');
const target = path.resolve('services/apis', `${name}.js`);
const newTarget = path.resolve('repositories', repoDir, `${repoDir}.index.js`);
const SKIP = new Set(['node_modules', 'public', '.git']);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith("__orig_")) continue;
    const full = path.join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; } // arquivo removido durante a varredura
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(m?js)$/.test(entry)) yield full;
  }
}

// from '...'  |  import('...')  |  export ... from '...'
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;

let changed = 0;
for (const file of walk(root)) {
  if (path.resolve(file) === target) continue;
  const src = readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  let hits = 0;
  const out = src.replace(SPEC_RE, (m, pre, q, spec) => {
    if (!spec.startsWith('.')) return m;
    if (path.resolve(dir, spec) !== target) return m;
    let rel = path.relative(dir, newTarget).split(path.sep).join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    hits++;
    return `${pre}${q}${rel}${q}`;
  });
  if (hits) {
    changed++;
    console.log(`${dry ? '[dry] ' : ''}${path.relative(root, file)}  (${hits})`);
    if (!dry) writeFileSync(file, out);
  }
}
console.log(`${changed} arquivo(s) ${dry ? 'seriam alterados' : 'alterados'}.`);
