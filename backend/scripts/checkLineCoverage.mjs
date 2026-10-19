// checkLineCoverage.mjs — confere se cada linha de código do services/apis/<nameApi>.js
// original (no gitRef) aparece em algum arquivo de repositories/<repoDir>/.
// Ignora linhas vazias, comentários, imports/exports e chaves soltas.
// Uso: node scripts/checkLineCoverage.mjs <nameApi> <repoDir> [gitRef=HEAD]

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [name, repoDir, ref = 'HEAD'] = process.argv.slice(2);
if (!name || !repoDir) {
  console.error('Uso: node scripts/checkLineCoverage.mjs <nameApi> <repoDir> [gitRef]');
  process.exit(2);
}

const norm = (l) => l.trim().replace(/^export\s+(default\s+)?/, '').replace(/[;,]$/, '');
const isNoise = (l) =>
  !l ||
  l.startsWith('//') || l.startsWith('/*') || l.startsWith('*') || l.startsWith('*/') ||
  l.startsWith('import ') || l.startsWith('export ') || l.startsWith('from ') ||
  /^[{}()[\];,]+$/.test(l) || l === "'use strict'" || l === '"use strict"';

const original = execSync(`git show ${ref}:backend/services/apis/${name}.js`, { encoding: 'utf8' });
const dir = path.resolve('repositories', repoDir);
const newLines = new Set(
  readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .flatMap((f) => readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).map(norm)),
);

const missing = original
  .split(/\r?\n/)
  .map((raw, i) => ({ i: i + 1, l: norm(raw) }))
  .filter(({ l }) => !isNoise(l) && !newLines.has(l));

if (!missing.length) {
  console.log(`COVERED ${name}`);
} else {
  console.log(`MISSING ${name}: ${missing.length} linha(s)`);
  for (const { i, l } of missing.slice(0, 15)) console.log(`  L${i}: ${l.slice(0, 110)}`);
  process.exitCode = 1;
}
