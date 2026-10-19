// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backfillInboundIssueDate.js — CONSART ERP                           ║
// ║ Preenche issue_date / entry_date vazios das Notas de Entrada lendo  ║
// ║ o XML da NF-e (<dhEmi>/<dEmi> e <dhSaiEnt>/<dSaiEnt>).              ║
// ║ Fonte: XML do DF-e (nfeInbox.xml_completo / data_emissao) e, se não  ║
// ║ houver, o arquivo .xml nas pastas public/.                          ║
// ║                                                                      ║
// ║ node scripts/backfillInboundIssueDate.js          → só mostra       ║
// ║ node scripts/backfillInboundIssueDate.js --apply  → grava no banco  ║
// ║ Só mexe em datas NULL; pode rodar quantas vezes quiser.              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const APPLY = process.argv.includes('--apply');

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ROOT = path.join(BACKEND_ROOT, 'public');
// mesmas pastas que o inboundInvoicesController usa para achar o XML
const XML_DIRS = [
  path.join(PUBLIC_ROOT, 'painelNotasFiscais', 'xml'),
  path.join(PUBLIC_ROOT, 'xml'),
  path.join(PUBLIC_ROOT, 'pdfs'),
];

let xmlIndex = null;

/** Lista os .xml das pastas uma vez só. */
function listXmlFiles() {
  if (xmlIndex) return xmlIndex;
  xmlIndex = [];
  for (const dir of XML_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.toLowerCase().endsWith('.xml')) xmlIndex.push(path.join(dir, f));
    }
  }
  return xmlIndex;
}

function findXmlPath(row) {
  const key = String(row.access_key || '').replace(/\D/g, '');

  if (row.xml_url && String(row.xml_url).startsWith('/public/')) {
    const abs = path.resolve(PUBLIC_ROOT, String(row.xml_url).replace(/^\/public\//, ''));
    if (abs.startsWith(PUBLIC_ROOT) && fs.existsSync(abs)) return abs;
  }

  if (key.length === 44) {
    return listXmlFiles().find((f) => path.basename(f).includes(key)) || null;
  }
  return null;
}

function readTagDate(xml, tags) {
  for (const tag of tags) {
    const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}>\\s*(\\d{4}-\\d{2}-\\d{2})`));
    if (m) return m[1];
  }
  return null;
}

async function main() {
  // XML guardado pelo módulo DF-e (nfeInbox), pela chave de acesso
  const { rows } = await pool.query(`
    SELECT ii.inbound_id, ii.access_key, ii.xml_url, ii.issue_date, ii.entry_date,
           ni.xml_completo AS dfe_xml,
           to_char(ni.data_emissao, 'YYYY-MM-DD') AS dfe_issue_date
    FROM public."inboundInvoices" AS ii
    LEFT JOIN public."nfeInbox" AS ni
      ON ni.chave_nfe = regexp_replace(ii.access_key, '\\D', '', 'g')
    WHERE ii.issue_date IS NULL OR ii.entry_date IS NULL
    ORDER BY ii.inbound_id
  `);

  console.log(`${rows.length} nota(s) com data vazia. Modo: ${APPLY ? 'APLICAR' : 'SIMULAÇÃO (use --apply para gravar)'}`);

  let updated = 0;
  let noXml = 0;
  let noDate = 0;

  for (const row of rows) {
    let xml = row.dfe_xml && row.dfe_xml.length > 100 ? row.dfe_xml : '';
    let source = 'DF-e';
    if (!xml) {
      const xmlPath = findXmlPath(row);
      if (xmlPath) {
        xml = fs.readFileSync(xmlPath, 'utf8');
        source = path.basename(xmlPath);
      }
    }

    if (!xml && !row.dfe_issue_date) {
      noXml += 1;
      console.log(`  #${row.inbound_id}: XML não encontrado (nem no DF-e, nem em public/)`);
      continue;
    }

    const issue = row.issue_date ? null
      : (readTagDate(xml, ['dhEmi', 'dEmi']) || row.dfe_issue_date || null);
    const entry = row.entry_date ? null : readTagDate(xml, ['dhSaiEnt', 'dSaiEnt']);

    if (!issue && !entry) {
      noDate += 1;
      console.log(`  #${row.inbound_id}: XML sem dhEmi/dhSaiEnt (${source})`);
      continue;
    }

    console.log(`  #${row.inbound_id}: emissão=${issue || '(mantém)'} entrada=${entry || '(mantém)'} [${source}]`);

    if (APPLY) {
      await pool.query(
        `UPDATE public."inboundInvoices"
            SET issue_date = COALESCE(issue_date, $2::date),
                entry_date = COALESCE(entry_date, $3::date)
          WHERE inbound_id = $1`,
        [row.inbound_id, issue, entry]
      );
    }
    updated += 1;
  }

  console.log(`\n${APPLY ? 'Atualizadas' : 'Seriam atualizadas'}: ${updated} | sem XML: ${noXml} | XML sem data: ${noDate}`);
}

main()
  .catch((err) => {
    console.error('[backfillInboundIssueDate]', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
