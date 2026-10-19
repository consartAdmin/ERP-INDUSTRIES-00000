// backend/tools/diag.js  (ESM)
import { Storage } from '@google-cloud/storage';
import forge from 'node-forge';
import pool from '../config/db.js';

// --- helpers ---
const UF_TO_COD = {
  AC:'12', AL:'27', AM:'13', AP:'16', BA:'29', CE:'23', DF:'53', ES:'32', GO:'52',
  MA:'21', MG:'31', MS:'50', MT:'51', PA:'15', PB:'25', PE:'26', PI:'22', PR:'41',
  RJ:'33', RN:'24', RO:'11', RR:'14', RS:'43', SC:'42', SE:'28', SP:'35', TO:'17'
};

function getenv(k, def = '') {
  const v = process.env[k];
  if (!v) return def;
  return String(v).trim();
}
function resolveUfCodigoFromEnv() {
  const direct = getenv('NFE_UF_CODIGO');
  if (direct) return direct;
  const uf = getenv('NFE_UF').toUpperCase();
  return UF_TO_COD[uf] || '31';
}

// --- checks ---
async function checkEnv() {
  const required = [
    'NFE_ENABLED', 'NFE_CERT_BUCKET', 'NFE_CERT_OBJECT',
    'NFE_CERT_PFX_PASS', // ou A1_SENHA (aceitamos os dois)
  ];
  const missing = required.filter(k => !getenv(k) && !((k === 'NFE_CERT_PFX_PASS') && getenv('A1_SENHA')));
  return {
    name: 'ENV',
    status: missing.length ? 'FAIL' : 'OK',
    message: missing.length ? `Variáveis ausentes: ${missing.join(', ')}` : 'Variáveis essenciais presentes',
  };
}

async function checkCert() {
  try {
    const bucket = getenv('NFE_CERT_BUCKET');
    const object = getenv('NFE_CERT_OBJECT');
    const rawPass = getenv('NFE_CERT_PFX_PASS') || getenv('A1_SENHA');
    if (!bucket || !object) {
      return { name: 'Certificado', status: 'FAIL', message: 'NFE_CERT_BUCKET/NFE_CERT_OBJECT ausente' };
    }
    if (!rawPass) {
      return { name: 'Certificado', status: 'FAIL', message: 'Senha do A1 ausente (NFE_CERT_PFX_PASS/A1_SENHA)' };
    }

    const pass = rawPass.replace(/[\r\n]+$/g, '').trimEnd();
    const storage = new Storage();
    const [buf] = await storage.bucket(bucket).file(object).download(); // Buffer binário

    // abre PKCS#12
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pass); // erro comum: "mac verify failure"

    // tenta extrair 1 certificado pra validar de ponta a ponta
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = (bags[forge.pki.oids.certBag] || [])[0]?.cert;
    const subject = cert ? cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ') : 'N/D';

    return { name: 'Certificado', status: 'OK', message: `PFX lido (${buf.length} bytes), subject: ${subject}` };
  } catch (err) {
    return { name: 'Certificado', status: 'FAIL', message: String(err?.message || err) };
  }
}

async function checkDb() {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    return { name: 'Banco de Dados', status: 'OK', message: `Conectado (${rows[0].now})` };
  } catch (err) {
    return { name: 'Banco de Dados', status: 'FAIL', message: String(err?.message || err) };
  }
}

async function checkSefazStatus() {
  try {
    // importa client ESM (com fallback interno se você tiver .cjs)
    const sefazMod = await import('../services/emissaoNfe/sefazClient.js').catch(async () =>
      await import('../services/emissaoNfe/sefazClient.cjs')
    );
    const sefaz = sefazMod.default || sefazMod;

    const ufCodigo = resolveUfCodigoFromEnv();
    const r = await sefaz.statusServico({ ufCodigo });
    const ok = r?.cStat === '107';
    return {
      name: 'SEFAZ Status',
      status: ok ? 'OK' : 'WARN',
      message: ok ? 'Serviço em Operação (cStat 107)' : `Retorno cStat=${r?.cStat || 'N/D'} motivo=${r?.xMotivo || 'N/D'}`,
      payload: r,
    };
  } catch (err) {
    return { name: 'SEFAZ Status', status: 'FAIL', message: String(err?.message || err) };
  }
}

// --- public API ---
export async function runAllDiagnostics() {
  const checks = [];
  checks.push(await checkEnv());
  checks.push(await checkCert());
  checks.push(await checkDb());
  checks.push(await checkSefazStatus());

  const ok = checks.every(c => c.status === 'OK');
  return {
    ok,
    checks,
    meta: {
      tpAmb: getenv('NFE_TP_AMB') || getenv('NFE_ENV') || 'N/D',
      uf: getenv('NFE_UF') || 'N/D',
      ufCodigo: resolveUfCodigoFromEnv(),
      node: process.version,
      service: getenv('K_SERVICE') || 'local',
      region: getenv('X_GOOGLE_REGION') || 'N/D',
    }
  };
}
