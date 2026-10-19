// moveFolder.mjs — move uma pasta inteira (git mv) de services/apis/<X>/ para repositories/<X>/,
// corrige os imports relativos DENTRO dos arquivos movidos para a nova profundidade
// e reescreve os imports dos demais arquivos que apontavam para eles.
// Uso: node scripts/moveFolder.mjs <X> [<X> ...]

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' });
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\2/g;
const toRel = (fromDir, target) => {
  let rel = path.relative(fromDir, target).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
};

for (const mod of process.argv.slice(2)) {
  const oldDir = path.resolve('services/apis', mod);
  const newDir = path.resolve('repositories', mod);
  if (!existsSync(oldDir)) { console.log(`SKIP ${mod}: não existe`); continue; }

  const files = readdirSync(oldDir).filter((f) => /\.m?js$/.test(f));
  const moved = new Map(files.map((f) => [path.join(oldDir, f), path.join(newDir, f)]));

  // 1) git mv de cada arquivo (a pasta de destino pode já existir)
  mkdirSync(newDir, { recursive: true });
  for (const f of readdirSync(oldDir)) run(`git mv "services/apis/${mod}/${f}" "repositories/${mod}/${f}"`);

  // 2) corrigir imports relativos dentro dos arquivos movidos
  for (const [oldFile, newFile] of moved) {
    const src = readFileSync(newFile, 'utf8');
    const out = src.replace(SPEC_RE, (m, pre, q, spec) => {
      if (!spec.startsWith('.')) return m;
      const abs = path.resolve(path.dirname(oldFile), spec);
      const target = moved.get(abs) || abs; // irmão movido junto → novo local
      return `${pre}${q}${toRel(newDir, target)}${q}`;
    });
    if (out !== src) writeFileSync(newFile, out);
  }

  // 3) reescrever quem importava esses arquivos
  for (const [oldFile, newFile] of moved) {
    const res = run(`node scripts/rewireImport.mjs "${path.relative('.', oldFile)}" "${path.relative('.', newFile)}"`)
      .trim().split(/\r?\n/).pop();
    console.log(`${mod}/${path.basename(oldFile)}  ${res}`);
  }
}
