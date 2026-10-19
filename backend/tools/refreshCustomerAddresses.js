/**
 * Atualiza enderecos de clientes usando o CEP (ViaCEP).
 *
 * Coloque este arquivo em backend/tools/refreshCustomerAddresses.js.
 *
 * Preview (nao altera o banco):
 *   node tools/refreshCustomerAddresses.js
 *
 * Aplicar depois de revisar o preview:
 *   node tools/refreshCustomerAddresses.js --apply
 *
 * Opcoes:
 *   --limit=100          processa no maximo 100 clientes
 *   --customer-id=122   processa somente um cliente
 *   --skip-errors       no modo apply, ignora CEPs rejeitados
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env', override: true });

const { default: pool } = await import('../config/db.js');

const APPLY = process.argv.includes('--apply');
const SKIP_ERRORS = process.argv.includes('--skip-errors');
const LIMIT = readPositiveInteger('limit');
const CUSTOMER_ID = readPositiveInteger('customer-id');
const REQUEST_DELAY_MS = 150;

const STREET_TYPES = new Map([
  ['RUA', 'RUA'], ['R', 'RUA'],
  ['AV', 'AVENIDA'], ['AVENIDA', 'AVENIDA'],
  ['AL', 'ALAMEDA'], ['ALAMEDA', 'ALAMEDA'],
  ['TRAVESSA', 'TRAVESSA'], ['TV', 'TRAVESSA'],
  ['RODOVIA', 'RODOVIA'], ['RDV', 'RODOVIA'],
  ['ESTRADA', 'ESTRADA'], ['EST', 'ESTRADA'],
  ['VIA', 'VIA'],
  ['PRAÇA', 'PRAÇA'], ['PRACA', 'PRAÇA'], ['PÇA', 'PRAÇA'], ['PCA', 'PRAÇA'],
  ['LARGO', 'LARGO'], ['VIELA', 'VIELA'], ['PASSAGEM', 'PASSAGEM'],
  ['BECO', 'BECO'], ['CONJUNTO', 'CONJUNTO'], ['QUADRA', 'QUADRA'],
  ['SETOR', 'SETOR'], ['SERVIDÃO', 'SERVIDÃO'], ['SERVIDAO', 'SERVIDÃO'],
]);

function readPositiveInteger(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return null;
  const value = Number(arg.slice(prefix.length));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${prefix} deve receber um numero inteiro positivo`);
  }
  return value;
}

const onlyDigits = (value) => String(value ?? '').replace(/\D/g, '');
const clean = (value) => String(value ?? '').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function splitStreetTypeAndName(value) {
  const full = clean(value);
  if (!full) return { street_type: '', street_name: '' };

  const parts = full.split(/\s+/);
  const first = (parts[0] || '').toUpperCase().replace(/\./g, '');
  const type = STREET_TYPES.get(first);

  if (type && parts.length > 1) {
    return { street_type: type, street_name: parts.slice(1).join(' ') };
  }

  return { street_type: '', street_name: full };
}

async function lookupCep(cep, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        headers: { Accept: 'application/json' },
        timeout: 15000,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.erro) throw new Error('CEP nao encontrado');
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1000);
    }
  }
  throw lastError;
}

function buildPatch(row, viaCep) {
  const street = splitStreetTypeAndName(viaCep.logradouro);
  const patch = {
    postal_code: onlyDigits(viaCep.cep).slice(0, 8),
    street_type: street.street_type,
    street_name: street.street_name,
    neighborhood: clean(viaCep.bairro),
    city: clean(viaCep.localidade),
    state: clean(viaCep.uf).toUpperCase().slice(0, 2),
    ibge_city_code: onlyDigits(viaCep.ibge).slice(0, 7),
  };

  // Alguns CEPs gerais nao possuem rua ou bairro. Nesses casos, preserva o valor atual.
  for (const field of ['street_type', 'street_name', 'neighborhood', 'city', 'state']) {
    if (!patch[field]) patch[field] = clean(row[field]);
  }
  return patch;
}

function changedFields(row, patch) {
  return ['postal_code', 'street_type', 'street_name', 'neighborhood', 'city', 'state']
    .filter((field) => clean(row[field]) !== clean(patch[field]));
}

async function loadCustomers() {
  const params = [];
  const where = [`regexp_replace(COALESCE(postal_code, ''), '[^0-9]', '', 'g') ~ '^[0-9]{8}$'`];
  if (CUSTOMER_ID) {
    params.push(CUSTOMER_ID);
    where.push(`customer_id = $${params.length}`);
  }
  params.push(LIMIT || 2147483647);

  const result = await pool.query(`
    SELECT customer_id, trade_name, postal_code, street_type, street_name,
           neighborhood, city, state
      FROM public."customers"
     WHERE ${where.join(' AND ')}
     ORDER BY customer_id
     LIMIT $${params.length}
  `, params);
  return result.rows;
}

async function applyChanges(changes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of changes) {
      const p = item.after;
      await client.query(`
        UPDATE public."customers"
           SET postal_code = $2,
               street_type = $3,
               street_name = $4,
               neighborhood = $5,
               city = $6,
               state = $7,
               updated_at = NOW()
         WHERE customer_id = $1
      `, [item.customer_id, p.postal_code, p.street_type, p.street_name,
          p.neighborhood, p.city, p.state]);

      if (p.state && p.city) {
        await client.query(`
          INSERT INTO public."customersIbge"
            (customer_id, uf, city, codigo_ibge, source, confidence, updated_at)
          VALUES ($1, $2, $3, $4, 'viacep_batch', 100, NOW())
          ON CONFLICT (customer_id) DO UPDATE SET
            uf = EXCLUDED.uf,
            city = EXCLUDED.city,
            codigo_ibge = COALESCE(EXCLUDED.codigo_ibge,
                                   public."customersIbge".codigo_ibge),
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence,
            updated_at = NOW()
        `, [item.customer_id, p.state, p.city, p.ibge_city_code || null]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(APPLY ? 'MODO APPLY: o banco sera atualizado.' : 'MODO PREVIEW: nenhuma alteracao sera gravada.');
  if (APPLY && SKIP_ERRORS) {
    console.log('SKIP ERRORS: clientes com CEP rejeitado ficarao inalterados.');
  }
  const customers = await loadCustomers();
  const cache = new Map();
  const changes = [];
  const errors = [];

  for (let index = 0; index < customers.length; index += 1) {
    const row = customers[index];
    const cep = onlyDigits(row.postal_code).slice(0, 8);
    try {
      if (!cache.has(cep)) {
        cache.set(cep, await lookupCep(cep));
        await sleep(REQUEST_DELAY_MS);
      }
      const after = buildPatch(row, cache.get(cep));
      const fields = changedFields(row, after);
      if (fields.length) {
        changes.push({
          customer_id: row.customer_id,
          trade_name: row.trade_name,
          changed_fields: fields,
          before: Object.fromEntries(fields.map((f) => [f, row[f]])),
          after,
        });
      }
      console.log(`[${index + 1}/${customers.length}] cliente ${row.customer_id}: ${fields.length ? fields.join(', ') : 'sem mudanca'}`);
    } catch (error) {
      errors.push({ customer_id: row.customer_id, cep, error: error.message });
      console.error(`[${index + 1}/${customers.length}] cliente ${row.customer_id}: ERRO ${error.message}`);
    }
  }

  console.log('\nRESUMO');
  console.log(`Clientes lidos: ${customers.length}`);
  console.log(`CEPs unicos consultados: ${cache.size}`);
  console.log(`Clientes com mudancas: ${changes.length}`);
  console.log(`Erros: ${errors.length}`);
  if (errors.length) console.table(errors);
  console.table(changes.slice(0, 30).map((x) => ({
    customer_id: x.customer_id,
    nome: x.trade_name,
    campos: x.changed_fields.join(', '),
    tipo: x.after.street_type,
    logradouro: x.after.street_name,
    cidade: x.after.city,
    uf: x.after.state,
  })));

  if (!APPLY) {
    console.log('\nPreview concluido. Para aplicar: node tools/refreshCustomerAddresses.js --apply');
    return;
  }

  if (errors.length && !SKIP_ERRORS) {
    throw new Error('Existem erros de consulta. Nada foi alterado. Corrija-os ou execute novamente com --apply --skip-errors.');
  }
  if (errors.length && SKIP_ERRORS) {
    console.warn(`${errors.length} cliente(s) com erro serao ignorados e permanecerao inalterados.`);
  }
  if (!changes.length) {
    console.log('Nada para atualizar.');
    return;
  }
  await applyChanges(changes);
  console.log(`${changes.length} cliente(s) atualizado(s) com sucesso.`);
}

main()
  .catch((error) => {
    console.error('\nFALHA:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });