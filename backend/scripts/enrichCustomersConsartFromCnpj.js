// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enrichCustomersConsartFromCnpj.js — CONSART ERP                      ║
// ║ Completa os dados vazios dos clientes de public."customersConsart"  ║
// ║ consultando o CNPJ (tax_id com 14 dígitos).                          ║
// ║                                                                      ║
// ║ Só preenche colunas NULL/vazias — nunca sobrescreve o que já existe. ║
// ║ Pode rodar quantas vezes quiser.                                     ║
// ║                                                                      ║
// ║ Rodar a partir de backend/:                                          ║
// ║   node scripts/enrichCustomersConsartFromCnpj.js          → só mostra║
// ║   node scripts/enrichCustomersConsartFromCnpj.js --apply  → grava    ║
// ║                                                                      ║
// ║ Opções:                                                              ║
// ║   --apply            grava no banco (sem ele é dry run)              ║
// ║   --limit N          processa no máximo N clientes                   ║
// ║   --id <customer_id> processa só esse cliente                        ║
// ║   --delay ms         pausa entre consultas                           ║
// ║                      (padrão: 21000 no public, 1500 no sefaz)        ║
// ║   --provider public|sefaz                                            ║
// ║       public (padrão) → GET publica.cnpj.ws (mesma fonte da rota     ║
// ║                         /api/public-cnpj e do sefazApi.js do front). ║
// ║                         Limite grátis: 3 consultas/minuto por IP.    ║
// ║       sefaz           → repositories/sefaz/sefaz.index.js            ║
// ║                         (hoje é um MOCK: só conhece o CNPJ da BH3).  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import '../config/loadEnv.js';
import pool from '../config/db.js';
import sefazApi from '../repositories/sefaz/sefaz.index.js';
import { consultarCnpjPublic } from '../repositories/cnpjPublic/cnpjPublic.index.js';
import { TB_CONSART } from '../repositories/customers/customers.table.js';

// ──────────────────────────────────────────────────────────────────────
// Argumentos
// ──────────────────────────────────────────────────────────────────────
function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : null;
}

const APPLY = process.argv.includes('--apply');
const PROVIDER = String(argValue('--provider') || 'public').toLowerCase();
const LIMIT = argValue('--limit') ? Number(argValue('--limit')) : null;
const ONLY_ID = argValue('--id') ? Number(argValue('--id')) : null;
const DELAY_MS = argValue('--delay') != null
  ? Number(argValue('--delay'))
  : (PROVIDER === 'public' ? 21000 : 1500);

// Espera quando o provedor devolve 429 (rate limit) e quantas vezes tenta de novo.
const RATE_LIMIT_WAIT_MS = Number(process.env.ENRICH_RATE_LIMIT_WAIT_MS || 60000);
const RATE_LIMIT_RETRIES = 2;

// ──────────────────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onlyDigits = (v) => String(v ?? '').replace(/\D+/g, '');

function clean(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}

function isEmpty(v) {
  return v == null || String(v).trim() === '';
}

// Tamanho máximo das colunas (customers.schema.js) — evita erro de VARCHAR.
const MAX_LEN = {
  trade_name: 255,
  legal_name: 255,
  email: 255,
  postal_code: 15,
  street_type: 50,
  street_name: 255,
  street_number: 20,
  address_complement: 255,
  neighborhood: 100,
  city: 100,
  state: 50,
  phone_number: 50,
  state_registration: 100,
  municipal_registration: 100,
};

/** Mesma normalização do customers.sanitizers.js (state 2 letras, CEP 8 dígitos). */
function sanitize(col, value) {
  let v = clean(value);
  if (v == null) return null;
  if (col === 'state') v = v.toUpperCase().slice(0, 2);
  if (col === 'postal_code') v = onlyDigits(v).slice(0, 8) || null;
  if (col === 'email') v = v.toLowerCase();
  if (col === 'street_type') v = v.toUpperCase();
  if (v && MAX_LEN[col]) v = v.slice(0, MAX_LEN[col]);
  return v || null;
}

/** Separa "AVENIDA BIAS FORTES" em tipo + nome (mesma regra do customersRegistration.js). */
function splitStreet(logradouro) {
  const s = clean(logradouro);
  if (!s) return { type: null, name: null };
  const m = s.match(/^([A-Za-zÀ-ÿ.]{2,15})\s+(.*)$/);
  if (!m) return { type: null, name: s };
  return { type: m[1].replace('.', '').toUpperCase(), name: m[2] };
}

// ──────────────────────────────────────────────────────────────────────
// Provedores → objeto com as colunas de customers
// ──────────────────────────────────────────────────────────────────────

/** IE ativa da UF do estabelecimento (ou a primeira) — igual ao sefazApi.js do front. */
function pickInscricaoEstadual(list = [], uf = '') {
  if (!Array.isArray(list) || !list.length) return null;
  const match = list.find((ie) => ie?.ativo && ie?.estado?.sigla === uf)
    || list.find((ie) => ie?.ativo)
    || list[0];
  return match?.inscricao_estadual || null;
}

/** publica.cnpj.ws → colunas de customers */
function mapPublic(raw) {
  const d = raw?.dados || raw?.data || raw || {};
  const est = d.estabelecimento || {};
  const uf = est.estado?.sigla || est.uf || null;

  let street = { type: clean(est.tipo_logradouro), name: clean(est.logradouro) };
  if (!street.type && street.name) street = splitStreet(street.name);

  let phone = null;
  if (est.telefone1) phone = est.ddd1 ? `(${est.ddd1}) ${est.telefone1}` : est.telefone1;

  return {
    legal_name: d.razao_social,
    trade_name: est.nome_fantasia || d.razao_social,
    email: est.email,
    phone_number: phone,
    postal_code: est.cep,
    street_type: street.type,
    street_name: street.name,
    street_number: est.numero,
    address_complement: est.complemento,
    neighborhood: est.bairro,
    city: est.cidade?.nome || est.cidade,
    state: uf,
    state_registration: pickInscricaoEstadual(est.inscricoes_estaduais, uf),
  };
}

/** repositories/sefaz (searchSefazByCnpj) → colunas de customers */
function mapSefaz(d = {}) {
  let street = { type: clean(d.tipo_logradouro), name: clean(d.logradouro) };
  if (!street.type && street.name) street = splitStreet(street.name);

  const ie = clean(d.inscricao_estadual);
  return {
    legal_name: d.razao_social || d.nome,
    trade_name: d.fantasia || d.razao_social || d.nome,
    email: d.email,
    phone_number: d.telefone,
    postal_code: d.cep,
    street_type: street.type,
    street_name: street.name,
    street_number: d.numero,
    address_complement: d.complemento,
    neighborhood: d.bairro,
    city: d.municipio,
    state: d.uf,
    // ignora o placeholder do mock
    state_registration: ie && !/AQUI/i.test(ie) ? ie : null,
    municipal_registration: d.inscricao_municipal,
  };
}

function isRateLimit(err) {
  const msg = String(err?.message || err);
  return err?.response?.status === 429 || /\b429\b|rate.?limit|too many/i.test(msg);
}

async function lookup(cnpj, uf) {
  for (let attempt = 0; ; attempt++) {
    try {
      if (PROVIDER === 'sefaz') {
        return mapSefaz(await sefazApi.searchSefazByCnpj({ cnpj, uf }));
      }
      return mapPublic(await consultarCnpjPublic(cnpj));
    } catch (err) {
      if (isRateLimit(err) && attempt < RATE_LIMIT_RETRIES) {
        console.warn(`   ⏳ rate limit do provedor — aguardando ${RATE_LIMIT_WAIT_MS / 1000}s e tentando de novo...`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      throw err;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Diferenças: só colunas vazias no banco e com valor no provedor
// ──────────────────────────────────────────────────────────────────────
function buildChanges(row, data) {
  const changes = {};
  for (const [col, rawValue] of Object.entries(data)) {
    if (!(col in row)) continue; // coluna não existe na tabela
    if (!isEmpty(row[col])) continue; // nunca sobrescreve
    const v = sanitize(col, rawValue);
    if (v != null) changes[col] = v;
  }
  return changes;
}

// ──────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!['public', 'sefaz'].includes(PROVIDER)) {
    throw new Error(`--provider inválido: ${PROVIDER} (use public ou sefaz)`);
  }

  console.log('──────────────────────────────────────────────────────────');
  console.log(`[enrich] tabela   = ${TB_CONSART}`);
  console.log(`[enrich] provedor = ${PROVIDER}${PROVIDER === 'sefaz' ? ' (mock local)' : ''}`);
  console.log(`[enrich] modo     = ${APPLY ? 'APPLY (grava no banco)' : 'DRY RUN (não grava nada)'}`);
  console.log(`[enrich] delay    = ${DELAY_MS} ms${LIMIT ? ` | limit = ${LIMIT}` : ''}${ONLY_ID ? ` | id = ${ONLY_ID}` : ''}`);
  console.log('──────────────────────────────────────────────────────────');

  const params = [];
  let where = '';
  if (ONLY_ID) {
    params.push(ONLY_ID);
    where = `WHERE customer_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM ${TB_CONSART} ${where} ORDER BY customer_id`,
    params
  );

  const summary = { checked: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
  let lookups = 0;

  for (const row of rows) {
    if (LIMIT && summary.checked + summary.errors >= LIMIT) break;

    const cnpj = onlyDigits(row.tax_id);
    const label = `#${row.customer_id} ${row.trade_name || row.legal_name || '(sem nome)'}`;

    if (cnpj.length !== 14) {
      summary.skipped++;
      continue;
    }

    if (lookups > 0 && DELAY_MS > 0) await sleep(DELAY_MS);
    lookups++;

    let data;
    try {
      data = await lookup(cnpj, row.state ? String(row.state).trim().toUpperCase() : null);
    } catch (err) {
      summary.errors++;
      console.error(`✖ ${label} [${cnpj}] erro na consulta: ${err?.message || err}`);
      continue;
    }

    summary.checked++;
    const changes = buildChanges(row, data);
    const cols = Object.keys(changes);

    if (!cols.length) {
      summary.unchanged++;
      console.log(`· ${label} [${cnpj}] nada a preencher`);
      continue;
    }

    console.log(`${APPLY ? '✔' : '→'} ${label} [${cnpj}] ${APPLY ? 'preenchendo' : 'preencheria'} ${cols.length} campo(s):`);
    for (const c of cols) console.log(`     ${c.padEnd(20)} = ${changes[c]}`);

    if (APPLY) {
      try {
        // Condição "ainda vazio" no próprio UPDATE: não sobrescreve nem se
        // alguém editou o cliente entre o SELECT e agora.
        const sets = cols.map((c, i) =>
          `"${c}" = CASE WHEN NULLIF(BTRIM("${c}"::text), '') IS NULL THEN $${i + 2} ELSE "${c}" END`
        );
        const hasUpdatedAt = 'updated_at' in row;
        await pool.query(
          `UPDATE ${TB_CONSART}
              SET ${sets.join(', ')}${hasUpdatedAt ? ', updated_at = now()' : ''}
            WHERE customer_id = $1`,
          [row.customer_id, ...cols.map((c) => changes[c])]
        );
        summary.updated++;
      } catch (err) {
        summary.errors++;
        console.error(`✖ ${label} [${cnpj}] erro no UPDATE: ${err?.message || err}`);
      }
    } else {
      summary.updated++;
    }
  }

  console.log('──────────────────────────────────────────────────────────');
  console.log(`[enrich] RESUMO ${APPLY ? '' : '(dry run — "atualizados" = seriam atualizados)'}`);
  console.log(`  consultados       : ${summary.checked}`);
  console.log(`  atualizados       : ${summary.updated}`);
  console.log(`  sem alteração     : ${summary.unchanged}`);
  console.log(`  pulados (sem CNPJ): ${summary.skipped}`);
  console.log(`  erros             : ${summary.errors}`);
  if (!APPLY) console.log('  Nada foi gravado. Rode com --apply para gravar.');
  console.log('──────────────────────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error('[enrich] falha geral:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
