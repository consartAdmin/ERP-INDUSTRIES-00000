// finalizeModules.mjs — conclui a migração de módulos já criados em repositories/<X>/:
// verifica exports, reescreve imports, apaga o services/apis/<X>Api.js e testa o carregamento
// de todos os arquivos alterados. Não faz commit.
// Uso: node scripts/finalizeModules.mjs <nameApi>:<repoDir> [<nameApi>:<repoDir> ...]
// Ex.: node scripts/finalizeModules.mjs banksApi:banks productsBoxesApis:productsBoxes

import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const pairs = process.argv.slice(2).map((p) => p.split(':'));
if (!pairs.length || pairs.some(([a, b]) => !a || !b)) {
  console.error('Uso: node scripts/finalizeModules.mjs <nameApi>:<repoDir> ...');
  process.exit(2);
}

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lastLine = (s) => s.trim().split(/\r?\n/).filter(Boolean).pop() || '';

let failed = false;

// 1) verificar todos antes de mexer em qualquer import
for (const [api, dir] of pairs) {
  // Obs.: não roda restoreUnicodeEscapes automaticamente — alguns originais têm acentos
  // combinantes literais (em comentários) e o script os converteria indevidamente.
  // A checagem de cobertura abaixo aponta qualquer linha alterada.
  if (!existsSync(`repositories/${dir}/${dir}.index.js`)) {
    console.log(`MISSING repositories/${dir}/${dir}.index.js`);
    failed = true;
    continue;
  }
  const r = spawnSync('node', ['scripts/verifyRepoExports.mjs', api, dir, 'HEAD'], { encoding: 'utf8' });
  const line = r.stdout.split(/\r?\n/).find((l) => /^(OK|DIFF)/.test(l)) || lastLine(r.stderr);
  console.log(line);
  if (r.status !== 0) failed = true;
  // cobertura de linhas: só informativo (métodos → funções e constantes geram falsos positivos)
  const c = spawnSync('node', ['scripts/checkLineCoverage.mjs', api, dir, 'HEAD'], { encoding: 'utf8' });
  if (c.status !== 0) console.log('   ' + c.stdout.trim().split(/\r?\n/).join('\n   '));
}
if (failed) {
  console.log('\nAbortado: corrija os módulos acima antes de finalizar.');
  process.exit(1);
}

// 2) reescrever imports e apagar os originais
for (const [api, dir] of pairs) {
  console.log(lastLine(run(`node scripts/rewireImport.mjs services/apis/${api}.js repositories/${dir}/${dir}.index.js`)) + `  ← ${api}`);
  run(`git rm -qf services/apis/${api}.js`);
}

// 3) sobras de import para os arquivos apagados
const names = pairs.map(([api]) => api).join('|');
try {
  const left = run(`grep -rnE --include=*.js --include=*.mjs --exclude-dir=node_modules --exclude-dir=public "(from|import\\s*\\()\\s*['\\"][^'\\"]*/(${names})\\.js['\\"]" .`);
  if (left.trim()) { console.log('\nIMPORTS RESTANTES:\n' + left); failed = true; }
} catch { /* grep sem resultados */ }

// 4) testar carregamento: arquivos rastreados alterados (imports reescritos)
//    + os arquivos das pastas deste lote (pastas de outros lotes em andamento ficam de fora)
const dirs = pairs.map(([, dir]) => `repositories/${dir}/`);
const changed = run('git status --porcelain -uall -- .')
  .split(/\r?\n/).filter(Boolean)
  .filter((l) => !/^ ?D/.test(l))
  .map((l) => ({ untracked: l.startsWith('??'), f: l.slice(3).trim().replace(/^.* -> /, '').replace(/^backend\//, '') }))
  .filter(({ untracked, f }) => !untracked || dirs.some((d) => f.startsWith(d)))
  .map(({ f }) => f)
  .filter((f) => /\.m?js$/.test(f) && !f.startsWith('scripts/') && !f.startsWith('public/'));

for (const f of changed) {
  const r = spawnSync('node', ['-e', `import('./${f}').then(()=>process.exit(0)).catch(e=>{console.error('ERR '+e.message);process.exit(1)})`], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) {
    failed = true;
    console.log(`LOAD FAIL ${f}: ${(r.stderr.split(/\r?\n/).find((l) => l.startsWith('ERR ')) || lastLine(r.stderr))}`);
  }
}
console.log(`\n${changed.length} arquivo(s) testados. ${failed ? 'COM FALHAS' : 'Tudo OK'}.`);
process.exit(failed ? 1 : 0);
