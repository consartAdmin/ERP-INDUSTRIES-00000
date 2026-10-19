// verifyRepoExports.mjs — compara as exportações do antigo services/apis/<name>.js
// (versão no commit base do git) com repositories/<repoDir>/<repoDir>.index.js.
// Uso: node scripts/verifyRepoExports.mjs <nameApi> <repoDir> [gitRef]
// Ex.: node scripts/verifyRepoExports.mjs customersCreditApi customersCredit 66dd4c1

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [name, repoDir, ref = '66dd4c1'] = process.argv.slice(2);
if (!name || !repoDir) {
  console.error('Uso: node scripts/verifyRepoExports.mjs <nameApi> <repoDir> [gitRef]');
  process.exit(2);
}

const apisDir = path.resolve('services/apis');
const newFile = path.resolve('repositories', repoDir, `${repoDir}.index.js`);
// Arquivo temporário na mesma pasta do original para que imports relativos continuem válidos.
// <name> pode incluir subpasta (ex.: budgets/budgetsApi).
const oldFile = path.join(apisDir, path.dirname(name), `__orig_${path.basename(name)}.js`);

const describe = (mod) => {
  const named = Object.keys(mod).filter((k) => k !== 'default').sort();
  const def = mod.default;
  let defaultKeys = null;
  if (def && typeof def === 'object') defaultKeys = Object.keys(def).sort();
  return { named, defaultType: typeof def, defaultKeys };
};

try {
  const original = execSync(`git show ${ref}:backend/services/apis/${name}.js`, { encoding: 'utf8' });
  writeFileSync(oldFile, original);

  const before = describe(await import(pathToFileURL(oldFile).href));
  const after = describe(await import(pathToFileURL(newFile).href));

  const a = JSON.stringify(before);
  const b = JSON.stringify(after);
  if (a === b) {
    console.log(`OK  ${name}: ${before.named.length} named exports, default=${before.defaultType}`);
  } else {
    console.log(`DIFF ${name}\n  before: ${a}\n  after:  ${b}`);
    process.exitCode = 1;
  }
} finally {
  try { unlinkSync(oldFile); } catch {}
}
// O pool do pg mantém o processo vivo; encerra após limpar o arquivo temporário.
setTimeout(() => process.exit(), 50);
