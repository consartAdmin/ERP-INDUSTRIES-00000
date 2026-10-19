// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backfillInboundFiscalFromXml.js — CONSART ERP                        ║
// ║ Reprocessa os XMLs already salvos e preenche os campos fiscais das   ║
// ║ notas de entrada que foram importadas antes das colunas existirem.   ║
// ║                                                                      ║
// ║ Uso:                                                                 ║
// ║   node backend/scripts/backfillInboundFiscalFromXml.js               ║
// ║     → DRY RUN: não grava nada, apenas relata                         ║
// ║                                                                      ║
// ║   node backend/scripts/backfillInboundFiscalFromXml.js --apply       ║
// ║     → grava as alterações                                            ║
// ║                                                                      ║
// ║ Opções:                                                              ║
// ║   --apply            grava (sem isso, é simulação)                   ║
// ║   --overwrite        sobrescreve valores já preenchidos              ║
// ║                      (padrão: só preenche colunas NULL)              ║
// ║   --key=<chave>      processa apenas uma chave de acesso             ║
// ║   --inbound-id=<id>  processa apenas uma nota                        ║
// ║   --limit=<n>        limita o número de notas processadas            ║
// ║   --verbose          mostra cada item alterado                       ║
// ║   --no-remote        não baixa do xml_url; só usa o disco local      ║
// ║   --cache            salva em public/xml o XML baixado do bucket     ║
// ║                                                                      ║
// ║ O XML é procurado primeiro em disco e, se não existir, baixado de    ║
// ║ inboundInvoices.xml_url (GCS). Tenta HTTP direto e, se o objeto não  ║
// ║ for público, cai para @google-cloud/storage com as credenciais do    ║
// ║ ambiente (GOOGLE_APPLICATION_CREDENTIALS / gcloud auth).             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';

// ======================================================================
// Paths — espelham o inboundInvoicesController
// ======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(BACKEND_ROOT, 'public');

// ======================================================================
// .env
//
// O server.js carrega o .env antes de qualquer coisa; um script avulso
// não. Sem isso, config/db.js cai nos valores padrão e a senha fica
// indefinida ("client password must be a string").
//
// Precisa acontecer ANTES de importar config/db.js — daí o import
// dinâmico do pool logo abaixo.
// ======================================================================
const ENV_CANDIDATES = [
  path.join(BACKEND_ROOT, '.env'),
  path.join(BACKEND_ROOT, '..', '.env'),
  path.join(BACKEND_ROOT, '.env.local'),
];

let loadedEnvPath = null;

try {
  const dotenvModule = await import('dotenv');
  const dotenv = dotenvModule.default ?? dotenvModule;

  for (const candidate of ENV_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      loadedEnvPath = candidate;
      break;
    }
  }
} catch {
  // dotenv ausente: seguimos com o que já estiver no ambiente.
}

const { default: pool } = await import('../config/db.js');

const XML_DIRS = [
  path.join(PUBLIC_ROOT, 'painelNotasFiscais', 'xml'),
  path.join(PUBLIC_ROOT, 'xml'),
];

// ======================================================================
// CLI
// ======================================================================
const ARGV = process.argv.slice(2);

function flag(name) {
  return ARGV.includes(`--${name}`);
}

function option(name, fallback = null) {
  const hit = ARGV.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const APPLY = flag('apply');
const OVERWRITE = flag('overwrite');
const VERBOSE = flag('verbose');
const NO_REMOTE = flag('no-remote');
const CACHE = flag('cache');
const ONLY_KEY = normalizeAccessKey(option('key'));
const ONLY_INBOUND_ID = Number(option('inbound-id')) || null;
const LIMIT = Number(option('limit')) || null;

// ======================================================================
// Helpers numéricos — idênticos ao importador
// ======================================================================
function parseNumberBR(value, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().replace(',', '.');
  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

function parseNullableNumberBR(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseNumberBR(value, null);
}

function normalizeAccessKey(raw) {
  return String(raw || '').replace(/\D+/g, '');
}

// ======================================================================
// Localiza o XML da chave de acesso
// ======================================================================
function findXmlPath(accessKey) {
  const key = normalizeAccessKey(accessKey);
  if (!key) return null;

  for (const dir of XML_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const direct = path.join(dir, `${key}.xml`);
    if (fs.existsSync(direct)) return direct;

    for (const file of fs.readdirSync(dir)) {
      if (file.toLowerCase().endsWith('.xml') && file.includes(key)) {
        return path.join(dir, file);
      }
    }
  }

  return findXmlInDocContabil(key);
}

// ======================================================================
// doc.contabil — arquivo contábil organizado por data/movimento
// (doc.contabil/AAAA/MM/DD/mov-N/<timestamp>-<chave>.xml). Notas migradas
// do legado só têm o XML aqui e um xml_url relativo que não existe mais.
// ======================================================================
const DOC_CONTABIL_ROOT = path.join(BACKEND_ROOT, 'doc.contabil');
let docContabilIndex = null;

function findXmlInDocContabil(key) {
  if (!docContabilIndex) {
    docContabilIndex = new Map();
    const stack = fs.existsSync(DOC_CONTABIL_ROOT) ? [DOC_CONTABIL_ROOT] : [];

    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.name.toLowerCase().endsWith('.xml')) {
          const found = entry.name.match(/\d{44}/);
          if (found && !docContabilIndex.has(found[0])) {
            docContabilIndex.set(found[0], full);
          }
        }
      }
    }
  }

  return docContabilIndex.get(key) || null;
}

// ======================================================================
// XML remoto (GCS)
//
// Em produção o arquivo local é efêmero; a cópia durável fica no bucket
// e o caminho está em inboundInvoices.xml_url.
// ======================================================================
function parseGcsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);

    // https://storage.googleapis.com/<bucket>/<objeto>
    if (/^storage\.googleapis\.com$/i.test(url.hostname)) {
      const parts = url.pathname.replace(/^\//, '').split('/');
      const bucket = parts.shift();
      const object = decodeURIComponent(parts.join('/'));
      return bucket && object ? { bucket, object } : null;
    }

    // https://<bucket>.storage.googleapis.com/<objeto>
    const host = url.hostname.match(/^(.+)\.storage\.googleapis\.com$/i);
    if (host) {
      const object = decodeURIComponent(url.pathname.replace(/^\//, ''));
      return object ? { bucket: host[1], object } : null;
    }

    return null;
  } catch {
    return null;
  }
}

let gcsStorage = null;
let gcsUnavailableReason = null;

async function getGcsStorage() {
  if (gcsStorage) return gcsStorage;
  if (gcsUnavailableReason) return null;

  try {
    const { Storage } = await import('@google-cloud/storage');
    gcsStorage = new Storage();
    return gcsStorage;
  } catch (error) {
    gcsUnavailableReason = error.message;
    return null;
  }
}

async function fetchXmlFromUrl(rawUrl) {
  // 1) HTTP direto — funciona se o objeto for público.
  try {
    const res = await fetch(rawUrl);

    if (res.ok) {
      return { xml: await res.text(), via: 'http' };
    }

    if (res.status !== 401 && res.status !== 403) {
      return { xml: null, reason: `HTTP ${res.status}` };
    }
  } catch (error) {
    // Segue para o SDK autenticado.
    if (VERBOSE) console.warn(`  [HTTP] ${rawUrl}: ${error.message}`);
  }

  // 2) SDK autenticado — usa as credenciais padrão do ambiente.
  const gcs = parseGcsUrl(rawUrl);
  if (!gcs) return { xml: null, reason: 'URL não reconhecida como GCS' };

  const storage = await getGcsStorage();
  if (!storage) {
    return {
      xml: null,
      reason: `sem @google-cloud/storage (${gcsUnavailableReason})`,
    };
  }

  try {
    const [buffer] = await storage
      .bucket(gcs.bucket)
      .file(gcs.object)
      .download();

    return { xml: buffer.toString('utf8'), via: 'gcs' };
  } catch (error) {
    return { xml: null, reason: `GCS: ${error.message}` };
  }
}

async function loadXmlForInvoice(invoice) {
  const diskPath = findXmlPath(invoice.access_key);

  if (diskPath) {
    try {
      return { xml: fs.readFileSync(diskPath, 'utf8'), origin: 'disco' };
    } catch (error) {
      return { xml: null, reason: `erro lendo ${diskPath}: ${error.message}` };
    }
  }

  if (NO_REMOTE) {
    return { xml: null, reason: 'sem XML local (--no-remote)' };
  }

  const url = String(invoice.xml_url || '').trim();

  if (!url || !/^https?:/i.test(url)) {
    return { xml: null, reason: 'sem xml_url' };
  }

  const fetched = await fetchXmlFromUrl(url);

  if (!fetched.xml) {
    return { xml: null, reason: fetched.reason };
  }

  if (CACHE) {
    try {
      const dir = XML_DIRS[XML_DIRS.length - 1];
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${normalizeAccessKey(invoice.access_key)}.xml`),
        fetched.xml,
        'utf8'
      );
    } catch (error) {
      if (VERBOSE) console.warn(`  [CACHE] falhou: ${error.message}`);
    }
  }

  return { xml: fetched.xml, origin: fetched.via === 'gcs' ? 'gcs' : 'url' };
}

// ======================================================================
// Extração fiscal — mesma lógica de extractItemsFromInfNFe
// ======================================================================
function extractInfNFeRoot(parsed) {
  let nfe =
    parsed?.nfeProc?.NFe?.[0] ||
    parsed?.NFe?.[0] ||
    parsed?.NFe ||
    parsed?.nfeProc?.NFe ||
    parsed?.nfeProc ||
    parsed;

  if (Array.isArray(nfe)) nfe = nfe[0];

  const infNFe =
    nfe?.infNFe?.[0] ||
    nfe?.infNFe ||
    parsed?.nfeProc?.NFe?.[0]?.infNFe?.[0] ||
    null;

  return infNFe || null;
}

function findDetList(infNFe) {
  if (!infNFe) return [];
  if (Array.isArray(infNFe.det)) return infNFe.det;
  if (infNFe.det && typeof infNFe.det === 'object') return [infNFe.det];

  const list = [];
  for (const value of Object.values(infNFe)) {
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child === 'object' && child.prod) list.push(child);
      });
    }
  }
  return list;
}

function extractFiscalItems(infNFe) {
  const detList = findDetList(infNFe);

  const nfeKey = String(infNFe?.$?.Id || '').replace(/^NFe/i, '');

  return detList.map((det, idx) => {
    const prod = det.prod?.[0] || {};
    const imposto = det.imposto?.[0] || {};

    // ICMS — o grupo aplicável varia: ICMS00, ICMS10, ICMS60, ICMSSN102…
    const icmsNode = imposto.ICMS?.[0] || {};
    let icmsBlock = {};

    for (const key of Object.keys(icmsNode)) {
      if (key.startsWith('ICMS') && icmsNode[key]?.[0]) {
        icmsBlock = icmsNode[key][0];
        break;
      }
    }

    const ipiNode = imposto.IPI?.[0] || {};
    const ipiTrib = ipiNode.IPITrib?.[0] || ipiNode.IPINT?.[0] || {};
    const ipiValue = parseNumberBR(ipiTrib.vIPI?.[0], 0);

    const pisNode = imposto.PIS?.[0] || {};
    const pisBlock =
      Object.values(pisNode).find((v) => Array.isArray(v) && v[0])?.[0] || {};

    const cofinsNode = imposto.COFINS?.[0] || {};
    const cofinsBlock =
      Object.values(cofinsNode).find((v) => Array.isArray(v) && v[0])?.[0] || {};

    const icmsValue = parseNumberBR(icmsBlock.vICMS?.[0], 0);

    const icmsStBase = parseNullableNumberBR(
      icmsBlock.vBCST?.[0] ?? icmsBlock.vBCSTRet?.[0]
    );

    const icmsStRate = parseNullableNumberBR(
      icmsBlock.pICMSST?.[0] ?? icmsBlock.pST?.[0]
    );

    const icmsStValue = parseNullableNumberBR(
      icmsBlock.vICMSST?.[0] ??
      icmsBlock.vICMSSTRet?.[0] ??
      icmsBlock.vICMSSubstituto?.[0]
    );

    return {
      nfe_item_seq: Number(det?.$?.nItem || idx + 1),
      nf_product_code: String(prod.cProd?.[0] || '').trim(),
      position: idx,

      hasStInXml:
        icmsStBase !== null ||
        icmsStRate !== null ||
        icmsStValue !== null,

      values: {
        nfe_key: nfeKey || null,

        // O nó <imposto> inteiro, no formato xml2js — é o que o importador
        // grava. nfeIssuanceApi lê vICMSSubstituto SOMENTE daqui (não existe
        // coluna para ele) e usa este payload como fonte alternativa do ST.
        raw_tax_payload: imposto,

        icms_origin: icmsBlock.orig?.[0] || null,
        icms_cst: icmsBlock.CST?.[0] || icmsBlock.CSOSN?.[0] || null,
        icms_modality: icmsBlock.modBC?.[0] || null,
        icms_base: parseNullableNumberBR(icmsBlock.vBC?.[0]),
        icms_reduction_rate: parseNullableNumberBR(icmsBlock.pRedBC?.[0]),
        icms_rate: parseNullableNumberBR(icmsBlock.pICMS?.[0]),
        icms: icmsValue,
        icms_value: icmsValue,

        icms_st_modality: icmsBlock.modBCST?.[0] || null,
        icms_st_mva_rate: parseNullableNumberBR(icmsBlock.pMVAST?.[0]),
        icms_st_reduction_rate: parseNullableNumberBR(icmsBlock.pRedBCST?.[0]),
        icms_st_base: icmsStBase,
        icms_st_rate: icmsStRate,
        icms_st_value: icmsStValue,

        fcp_base: parseNullableNumberBR(icmsBlock.vBCFCP?.[0]),
        fcp_rate: parseNullableNumberBR(icmsBlock.pFCP?.[0]),
        fcp_value: parseNullableNumberBR(icmsBlock.vFCP?.[0]),
        fcp_st_base: parseNullableNumberBR(icmsBlock.vBCFCPST?.[0]),
        fcp_st_rate: parseNullableNumberBR(icmsBlock.pFCPST?.[0]),
        fcp_st_value: parseNullableNumberBR(icmsBlock.vFCPST?.[0]),

        ipi_cst: ipiTrib.CST?.[0] || null,
        ipi_base: parseNullableNumberBR(ipiTrib.vBC?.[0]),
        ipi_rate: parseNullableNumberBR(ipiTrib.pIPI?.[0]),
        ipi: ipiValue,
        ipi_value: ipiValue,

        pis_cst: pisBlock.CST?.[0] || null,
        pis_base: parseNullableNumberBR(pisBlock.vBC?.[0]),
        pis_rate: parseNullableNumberBR(pisBlock.pPIS?.[0]),
        pis_value: parseNullableNumberBR(pisBlock.vPIS?.[0]),

        cofins_cst: cofinsBlock.CST?.[0] || null,
        cofins_base: parseNullableNumberBR(cofinsBlock.vBC?.[0]),
        cofins_rate: parseNullableNumberBR(cofinsBlock.pCOFINS?.[0]),
        cofins_value: parseNullableNumberBR(cofinsBlock.vCOFINS?.[0]),
      },
    };
  });
}

// Colunas que o backfill toca.
const FISCAL_COLUMNS = Object.freeze([
  'nfe_key',
  'raw_tax_payload',
  'icms_origin',
  'icms_cst',
  'icms_modality',
  'icms_base',
  'icms_reduction_rate',
  'icms_rate',
  'icms',
  'icms_value',
  'icms_st_modality',
  'icms_st_mva_rate',
  'icms_st_reduction_rate',
  'icms_st_base',
  'icms_st_rate',
  'icms_st_value',
  'fcp_base',
  'fcp_rate',
  'fcp_value',
  'fcp_st_base',
  'fcp_st_rate',
  'fcp_st_value',
  'ipi_cst',
  'ipi_base',
  'ipi_rate',
  'ipi',
  'ipi_value',
  'pis_cst',
  'pis_base',
  'pis_rate',
  'pis_value',
  'cofins_cst',
  'cofins_base',
  'cofins_rate',
  'cofins_value',
]);

// ======================================================================
// Casamento item do XML ↔ item do banco
// ======================================================================
function matchItems(dbItems, xmlItems) {
  const pairs = [];
  const unmatched = [];

  const usedXml = new Set();

  // 1) Pela sequência oficial do item na NF-e.
  for (const dbItem of dbItems) {
    const seq = Number(dbItem.nfe_item_seq);
    if (!Number.isInteger(seq) || seq <= 0) continue;

    const xmlItem = xmlItems.find(
      (x) => x.nfe_item_seq === seq && !usedXml.has(x.position)
    );

    if (xmlItem) {
      usedXml.add(xmlItem.position);
      pairs.push({ dbItem, xmlItem, how: 'nfe_item_seq' });
    }
  }

  const paired = new Set(pairs.map((p) => p.dbItem.inbound_item_id));
  const rest = dbItems.filter((d) => !paired.has(d.inbound_item_id));

  // 2) Pelo código do produto no XML (cProd), quando não for ambíguo.
  for (const dbItem of rest) {
    const code = String(dbItem.nf_product_code || '').trim();
    if (!code) {
      unmatched.push({ dbItem, reason: 'SEM_NF_PRODUCT_CODE' });
      continue;
    }

    const candidates = xmlItems.filter(
      (x) => x.nf_product_code === code && !usedXml.has(x.position)
    );

    if (candidates.length === 1) {
      usedXml.add(candidates[0].position);
      pairs.push({ dbItem, xmlItem: candidates[0], how: 'nf_product_code' });
    } else if (candidates.length === 0) {
      unmatched.push({ dbItem, reason: 'NAO_ENCONTRADO_NO_XML' });
    } else {
      unmatched.push({ dbItem, reason: 'AMBIGUO_NO_XML' });
    }
  }

  return { pairs, unmatched };
}

// ======================================================================
// Diferença a aplicar
// ======================================================================
function buildUpdate(dbItem, xmlValues) {
  const sets = {};

  for (const column of FISCAL_COLUMNS) {
    const incoming = xmlValues[column];
    if (incoming === null || incoming === undefined) continue;

    // Objetos vazios (ex.: <imposto> ausente) não têm o que gravar.
    if (
      typeof incoming === 'object'
      && !Array.isArray(incoming)
      && Object.keys(incoming).length === 0
    ) continue;

    const current = dbItem[column];
    const isEmpty = current === null || current === undefined;

    if (!OVERWRITE && !isEmpty) continue;

    if (OVERWRITE && !isEmpty) {
      const before = typeof current === 'object'
        ? JSON.stringify(current)
        : String(current);

      const after = typeof incoming === 'object'
        ? JSON.stringify(incoming)
        : String(incoming);

      if (before === after) continue;
    }

    sets[column] = incoming;
  }

  return sets;
}

// ======================================================================
// Main
// ======================================================================
async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log(' BACKFILL FISCAL DAS NOTAS DE ENTRADA (a partir do XML)');
  console.log('════════════════════════════════════════════════════════');
  console.log(` .env        : ${loadedEnvPath || 'NENHUM encontrado (usando o ambiente)'}`);
  console.log(` modo        : ${APPLY ? 'APLICAR (grava)' : 'DRY RUN (não grava)'}`);
  console.log(` colunas     : ${OVERWRITE ? 'sobrescreve existentes' : 'apenas colunas vazias'}`);
  console.log(` fonte       : ${NO_REMOTE ? 'apenas disco' : 'disco, depois xml_url (GCS)'}${CACHE ? ' + cache local' : ''}`);
  console.log(` XML dirs    : ${[...XML_DIRS, DOC_CONTABIL_ROOT].join(' | ')}`);
  if (ONLY_KEY) console.log(` filtro      : chave ${ONLY_KEY}`);
  if (ONLY_INBOUND_ID) console.log(` filtro      : inbound_id ${ONLY_INBOUND_ID}`);
  if (LIMIT) console.log(` limite      : ${LIMIT} notas`);
  console.log('');

  const where = [];
  const params = [];
  let i = 1;

  if (!OVERWRITE) {
    where.push(`EXISTS (
      SELECT 1
        FROM public."inboundInvoiceItems" x
       WHERE x.inbound_id = ii.inbound_id
         AND (x.icms_cst IS NULL OR x.icms_st_value IS NULL)
    )`);
  }

  if (ONLY_KEY) {
    where.push(`ii.access_key = $${i++}`);
    params.push(ONLY_KEY);
  }

  if (ONLY_INBOUND_ID) {
    where.push(`ii.inbound_id = $${i++}`);
    params.push(ONLY_INBOUND_ID);
  }

  const invoicesRes = await pool.query(
    `
      SELECT ii.inbound_id, ii.access_key, ii.invoice_number, ii.xml_url
        FROM public."inboundInvoices" ii
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ii.inbound_id ASC
       ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ''}
    `,
    params
  );

  const invoices = invoicesRes.rows;

  const stats = {
    invoices: invoices.length,
    xmlFound: 0,
    xmlFromDisk: 0,
    xmlFromRemote: 0,
    xmlMissing: 0,
    xmlUnparseable: 0,
    itemsSeen: 0,
    itemsMatched: 0,
    itemsUnmatched: 0,
    itemsUpdated: 0,
    columnsSet: 0,
    itemsWithStInXml: 0,
    itemsWithoutStInXml: 0,
  };

  const missingKeys = [];

  for (const invoice of invoices) {
    const loaded = await loadXmlForInvoice(invoice);

    if (!loaded.xml) {
      stats.xmlMissing++;
      missingKeys.push(`${invoice.access_key}  (${loaded.reason || 'não encontrado'})`);
      continue;
    }

    let infNFe = null;

    try {
      const parsed = await parseStringPromise(loaded.xml, {
        explicitArray: true,
        trim: true,
      });
      infNFe = extractInfNFeRoot(parsed);
    } catch (error) {
      stats.xmlUnparseable++;
      console.warn(`  [XML ILEGÍVEL] inbound_id=${invoice.inbound_id} ${error.message}`);
      continue;
    }

    if (!infNFe) {
      stats.xmlUnparseable++;
      console.warn(`  [SEM infNFe] inbound_id=${invoice.inbound_id} origem=${loaded.origin}`);
      continue;
    }

    stats.xmlFound++;
    if (loaded.origin === 'disco') stats.xmlFromDisk++;
    else stats.xmlFromRemote++;

    const xmlItems = extractFiscalItems(infNFe);

    const dbItemsRes = await pool.query(
      `
        SELECT ${['inbound_item_id', 'nfe_item_seq', 'nf_product_code', 'product_code', ...FISCAL_COLUMNS].join(', ')}
          FROM public."inboundInvoiceItems"
         WHERE inbound_id = $1
         ORDER BY nfe_item_seq NULLS LAST, inbound_item_id
      `,
      [invoice.inbound_id]
    );

    const dbItems = dbItemsRes.rows;
    stats.itemsSeen += dbItems.length;

    const { pairs, unmatched } = matchItems(dbItems, xmlItems);
    stats.itemsMatched += pairs.length;
    stats.itemsUnmatched += unmatched.length;

    for (const u of unmatched) {
      console.warn(
        `  [SEM PAR] inbound_id=${invoice.inbound_id} item=${u.dbItem.inbound_item_id} ` +
        `cProd=${u.dbItem.nf_product_code || '-'} motivo=${u.reason}`
      );
    }

    const client = APPLY ? await pool.connect() : null;

    try {
      if (client) await client.query('BEGIN');

      for (const { dbItem, xmlItem, how } of pairs) {
        if (xmlItem.hasStInXml) stats.itemsWithStInXml++;
        else stats.itemsWithoutStInXml++;

        const sets = buildUpdate(dbItem, xmlItem.values);
        const columns = Object.keys(sets);

        if (!columns.length) continue;

        stats.itemsUpdated++;
        stats.columnsSet += columns.length;

        if (VERBOSE) {
          console.log(
            `  [ITEM] inbound_id=${invoice.inbound_id} item=${dbItem.inbound_item_id} ` +
            `sku=${dbItem.product_code || '-'} match=${how} colunas=${columns.length}` +
            (xmlItem.hasStInXml
              ? ` ST(base=${sets.icms_st_base ?? dbItem.icms_st_base}, ` +
                `aliq=${sets.icms_st_rate ?? dbItem.icms_st_rate}, ` +
                `valor=${sets.icms_st_value ?? dbItem.icms_st_value})`
              : ' ST=ausente-no-xml')
          );
        }

        if (client) {
          const assignments = columns.map((c, idx) => (
            c === 'raw_tax_payload'
              ? `${c} = $${idx + 1}::jsonb`
              : `${c} = $${idx + 1}`
          ));

          const values = columns.map((c) => (
            c === 'raw_tax_payload'
              ? JSON.stringify(sets[c])
              : sets[c]
          ));

          await client.query(
            `UPDATE public."inboundInvoiceItems"
                SET ${assignments.join(', ')}
              WHERE inbound_item_id = $${columns.length + 1}`,
            [...values, dbItem.inbound_item_id]
          );
        }
      }

      if (client) await client.query('COMMIT');
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error(`  [ERRO] inbound_id=${invoice.inbound_id}:`, error.message);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  console.log('');
  console.log('──────────────────── RESUMO ────────────────────');
  console.log(` notas analisadas          : ${stats.invoices}`);
  console.log(` XML encontrado            : ${stats.xmlFound}`);
  console.log(`   • disco local           : ${stats.xmlFromDisk}`);
  console.log(`   • xml_url (GCS)         : ${stats.xmlFromRemote}`);
  console.log(` XML não encontrado        : ${stats.xmlMissing}`);
  console.log(` XML ilegível / sem infNFe : ${stats.xmlUnparseable}`);
  console.log(` itens no banco            : ${stats.itemsSeen}`);
  console.log(` itens casados com o XML   : ${stats.itemsMatched}`);
  console.log(` itens sem par             : ${stats.itemsUnmatched}`);
  console.log(` itens a alterar           : ${stats.itemsUpdated}`);
  console.log(` colunas a preencher       : ${stats.columnsSet}`);
  console.log('');
  console.log(' ── ICMS-ST nos XMLs ──');
  console.log(` itens COM ST no XML       : ${stats.itemsWithStInXml}`);
  console.log(` itens SEM ST no XML       : ${stats.itemsWithoutStInXml}`);
  console.log('────────────────────────────────────────────────');

  if (missingKeys.length) {
    console.log('');
    console.log(` Chaves sem XML em disco (${missingKeys.length}):`);
    missingKeys.slice(0, 20).forEach((k) => console.log(`   ${k}`));
    if (missingKeys.length > 20) {
      console.log(`   … e mais ${missingKeys.length - 20}`);
    }
  }

  if (!APPLY) {
    console.log('');
    console.log(' DRY RUN — nada foi gravado.');
    console.log(' Rode novamente com --apply para gravar.');
  }
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('[BACKFILL] falhou:', error);
    return pool.end().finally(() => process.exit(1));
  });
