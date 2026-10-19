// backend/routes/debugRoutes.js
import express from 'express';
import dns from 'node:dns/promises';
import fetch from 'node-fetch';
import { Parser } from 'xml2js';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import tls from 'node:tls';
import { URL } from 'node:url';

import { Storage } from '@google-cloud/storage';
import { createA1AgentFromGCS } from '../services/emissaoNfe/a1Agent.js';
// ⛔️ Removido: getDebugUrls não existe nesse módulo
// import sefazClient, { getDebugUrls } from '../services/emissaoNfe/core/sefazClient.js';
import sefazClient from '../services/emissaoNfe/core/sefazClient.js';

const router = express.Router();
const storage = new Storage();

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */
function getenv(key, def = '') {
  const v = process.env[key];
  if (!v) return def;
  return String(v).trim().split(/\s+/)[0];
}
function errInfo(e) {
  const c = e?.cause || e;
  return {
    name: e?.name,
    message: e?.message,
    type: e?.type,
    code: e?.code || c?.code || c?.errno,
    errno: e?.errno,
    syscall: e?.syscall || c?.syscall,
    address: e?.address || c?.address || c?.hostname,
    port: e?.port || c?.port,
    reason: e?.reason || c?.reason,
    cause: c && c !== e ? (c.message || String(c)) : undefined,
    stack: e?.stack?.split?.('\n')?.slice(0, 6)?.join('\n'),
  };
}
const stripNs = (name) => String(name).replace(/^[^:]+:/, '');
function deepFind(obj, targetKey) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const [k, v] of Object.entries(obj)) {
    const key = stripNs(k);
    if (key === targetKey) return v;
    if (v && typeof v === 'object') {
      const nested = deepFind(v, targetKey);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}
async function step(label, fn) {
  try { const r = await fn(); return { label, ok: true, out: r }; }
  catch (e) { return { label, ok: false, error: errInfo(e) }; }
}
function toDateSafe(s) {
  if (!s) return null;
  const m = String(s).match(/=\s*(.*)$/);
  const raw = m ? m[1] : String(s);
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}
function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
}

// Minificador leve de XML (para debug)
function minifyXml(xml) {
  if (xml == null) return xml;
  return String(xml)
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\t+/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

// fetch com timeout via AbortController (node-fetch v3)
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/* ──────────────────────────────────────────────────────────────
 * Resolvedor simples de endpoints (MG + SVRS) com override por ENV
 * ────────────────────────────────────────────────────────────── */
const SVRS_UFS = new Set(['AC','AL','AP','DF','ES','PA','PB','PI','RJ','RN','RO','RR','SC','SE','TO']);
function resolveNfeUrls(ufRaw, tpAmbRaw) {
  // ENV de override absoluta
  const override = getenv('NFE_STATUS_URL', '');
  const uf = String(ufRaw || getenv('NFE_UF') || 'MG').toUpperCase();
  const tpAmb = String(tpAmbRaw || getenv('NFE_TP_AMB') || getenv('NFE_ENV') || '2'); // 1=PROD, 2=HOM

  // Se o usuário setou explicitamente, usa e pronto.
  if (override) return { STA: override };

  const prod = tpAmb === '1';

  // MG (endereços padrão)
  if (uf === 'MG') {
    return {
      // Nota: se seu ambiente homo for diferente, pode setar via NFE_STATUS_URL
      STA: prod
        ? 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4'
        : 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
    };
  }

  // SVRS (padrões conhecidos do ws v4)
  const base = prod
    ? 'https://nfe.svrs.rs.gov.br/ws'
    : 'https://nfe-homologacao.svrs.rs.gov.br/ws';

  if (SVRS_UFS.has(uf)) {
    return { STA: `${base}/NFeStatusServico/NFeStatusServico4.asmx` };
  }

  // Fallback: tenta SVRS; se sua UF tiver Sefaz própria, use NFE_STATUS_URL
  return { STA: `${base}/NFeStatusServico/NFeStatusServico4.asmx` };
}

// Resolve uma vez na carga; pode ser reavaliado on-demand se quiser
let NFE_URLS = resolveNfeUrls();

/* ──────────────────────────────────────────────────────────────
 * PFX (GCS) + OpenSSL (diagnóstico)
 * ────────────────────────────────────────────────────────────── */
async function downloadPfxFromGCS() {
  const bucket = getenv('NFE_CERT_BUCKET') || getenv('NFE_BUCKET') || getenv('A1_BUCKET');
  const object = getenv('NFE_CERT_OBJECT') || getenv('NFE_OBJECT') || getenv('A1_OBJECT');
  const pass   = getenv('NFE_CERT_PFX_PASS') || getenv('A1_SENHA');

  if (!bucket || !object || !pass) {
    const miss = [];
    if (!bucket) miss.push('NFE_CERT_BUCKET');
    if (!object) miss.push('NFE_CERT_OBJECT');
    if (!pass)   miss.push('NFE_CERT_PFX_PASS');
    const err = new Error(`Defina as ENVs: ${miss.join(', ')}`);
    err.code = 'MISSING_ENVS';
    throw err;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'a1-'));
  const pfxPath = path.join(tmpDir, 'a1.pfx');
  await storage.bucket(bucket).file(object).download({ destination: pfxPath });
  return { pfxPath, pass, tmpDir, bucket, object };
}
function runOpenssl(args) {
  return new Promise((resolve, reject) => {
    execFile('openssl', args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
async function parseCertWithOpenssl(pfxPath, pass, tmpDir) {
  const pemCertPath = path.join(tmpDir, 'cert.pem');
  await runOpenssl(['pkcs12', '-in', pfxPath, '-clcerts', '-nokeys', '-out', pemCertPath, '-passin', `pass:${pass}`]);

  const subj = await runOpenssl(['x509', '-in', pemCertPath, '-noout', '-subject']);
  const issr = await runOpenssl(['x509', '-in', pemCertPath, '-noout', '-issuer']);
  const date = await runOpenssl(['x509', '-in', pemCertPath, '-noout', '-dates']);
  const serl = await runOpenssl(['x509', '-in', pemCertPath, '-noout', '-serial']);
  const fngr = await runOpenssl(['x509', '-in', pemCertPath, '-noout', '-fingerprint', '-sha1']);

  const subject = subj.stdout.trim().replace(/^subject=\s*/, '');
  const issuer  = issr.stdout.trim().replace(/^issuer=\s*/, '');
  const lines   = date.stdout.trim().split('\n');
  const serial  = serl.stdout.trim().replace(/^serial=\s*/, '');
  const fingerprint = fngr.stdout.trim().replace(/^SHA1 Fingerprint=\s*/, '');

  const notBefore = toDateSafe(lines.find(l => l.startsWith('notBefore=')));
  const notAfter  = toDateSafe(lines.find(l => l.startsWith('notAfter=')));

  const now = new Date();
  const days_remaining = notAfter ? daysBetween(now, notAfter) : null;
  const valid_now = (notBefore && notAfter) ? (now >= notBefore && now <= notAfter) : null;

  return {
    subject,
    issuer,
    serial,
    fingerprint,
    notBefore: notBefore?.toISOString() || null,
    notAfter:  notAfter?.toISOString() || null,
    days_remaining,
    valid_now,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Conectividade básica
 * ────────────────────────────────────────────────────────────── */
router.get('/debug/ip', async (_req, res) => {
  try {
    const r = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 6000);
    const j = await r.json();
    res.json({ ok: true, ip: j.ip, status: r.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: errInfo(e) });
  }
});

router.get('/nfe/debug/netcheck', async (_req, res) => {
  // Recalcula URLs conforme ENVs atuais
  NFE_URLS = resolveNfeUrls();

  const results = [];
  results.push(await step('env region', async () => ({
    region: process.env.X_GOOGLE_RUNTIME_REGION || 'unknown',
    node: process.version,
  })));
  results.push(await step('dns lookup google.com', async () => {
    return await dns.lookup('google.com', { all: true });
  }));
  results.push(await step('http (plain): httpbin.org', async () => {
    const r = await fetchWithTimeout('http://httpbin.org/get', {}, 6000);
    return { status: r.status, ok: r.ok };
  }));
  results.push(await step('https: google 204', async () => {
    const r = await fetchWithTimeout('https://www.google.com/generate_204', {}, 6000);
    return { status: r.status, ok: r.ok };
  }));
  results.push(await step('public ip (ipify)', async () => {
    const r = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 6000);
    const j = await r.json();
    return { status: r.status, ip: j.ip };
  }));
  // Sem mTLS – apenas reachability
  results.push(await step('sefaz reachability (sem mTLS)', async () => {
    const url = NFE_URLS?.STA;
    const r = await fetchWithTimeout(url, { method: 'POST', body: '<soap/>' }, 8000);
    return { status: r.status, ok: r.ok, url };
  }));

  const ok = results.every(s => s.ok);
  res.status(ok ? 200 : 500).json({ ok, results, at: new Date().toISOString() });
});

/* ──────────────────────────────────────────────────────────────
 * 🔐 Handshake TLS puro (sem HTTP/SOAP)
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/handshake-tls', async (_req, res) => {
  try {
    NFE_URLS = resolveNfeUrls();
    const targetUrl = NFE_URLS?.STA;
    const { hostname } = new URL(targetUrl);

    const agent = await createA1AgentFromGCS(targetUrl);
    const { address: ip } = await dns.lookup(hostname, { family: 4 });

    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      ALPNProtocols: ['http/1.1'],
      minVersion: 'TLSv1.2',
      // Usa material do agent (pfx, passphrase)
      // @ts-ignore
      pfx: agent.options?.pfx,
      passphrase: agent.options?.passphrase,
      rejectUnauthorized: true,
      timeout: 15000,
    });

    socket.once('secureConnect', () => {
      const peer = socket.getPeerCertificate(true);
      const proto = socket.getProtocol();
      const cipher = socket.getCipher();
      const alpn = socket.alpnProtocol;
      const authorized = socket.authorized;
      const authErr = socket.authorizationError || null;
      socket.end();
      res.json({
        ok: true,
        target: `${hostname}:443`,
        resolvedIp: ip,
        protocol: proto,
        cipher,
        alpn,
        mTLS: { authorized, authorizationError: authErr },
        peerCert: {
          subject: peer?.subject,
          issuer: peer?.issuer,
          valid_from: peer?.valid_from,
          valid_to: peer?.valid_to,
        },
        hints: [
          'authorized=false com authorizationError sugere rejeição do SEFAZ ao seu certificado de CLIENTE.',
          'Se falhar antes de secureConnect → problema de cipher/versão TLS, SNI ou PFX inválido.',
        ],
      });
    });

    socket.on('timeout', () => socket.destroy(new Error('TLS timeout')));

    socket.on('error', (e) => {
      res.status(500).json({
        ok: false,
        target: `${hostname}:443`,
        error: errInfo(e),
        hint: 'Falha no handshake TLS (antes do HTTP/SOAP). Verifique A1, cadeia, SNI e ALPN (http/1.1).',
      });
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: errInfo(e) });
  }
});

/* ──────────────────────────────────────────────────────────────
 * 🔍 Status Serviço (SOAP 1.2)
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/status-mg', async (_req, res) => {
  try {
    NFE_URLS = resolveNfeUrls();
    const url = NFE_URLS?.STA;
    const agent = await createA1AgentFromGCS(url);
    const tpAmb = String(getenv('NFE_TP_AMB') || getenv('NFE_ENV') || '2');
    const cUF   = String(getenv('NFE_UF_CODIGO') || '31');

    const inner = `
      <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <tpAmb>${tpAmb}</tpAmb>
        <cUF>${cUF}</cUF>
        <xServ>STATUS</xServ>
      </consStatServ>
    `;
    const envelope = minifyXml(`
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
        <soap:Body>
          <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
            ${inner}
          </nfeDadosMsg>
        </soap:Body>
      </soap:Envelope>
    `);

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      body: envelope,
      agent: () => agent, // importante p/ node-fetch v3
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
    }, 15000);
    const raw = await resp.text();
    const parser = new Parser({ explicitArray: false, tagNameProcessors: [stripNs] });
    let ret = null;
    try {
      const parsed = await parser.parseStringPromise(raw);
      ret = deepFind(parsed, 'retConsStatServ');
    } catch {}

    res.status(resp.ok ? 200 : 500).json({
      ok: resp.ok,
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries() || []),
      ret,
      preview: raw.substring(0, 900) + (raw.length > 900 ? '...' : ''),
      hint: 'Se status=500 mas com SOAP válido, o handshake mTLS funcionou e a falha é de aplicação/soap.',
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: errInfo(e),
      hint: 'Falhou no transporte (provável TLS/handshake). Use também /nfe/debug/handshake-tls.',
    });
  }
});

/* ──────────────────────────────────────────────────────────────
 * 🧪 Status (SOAP 1.2 → 1.1) em sequência
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/status-both', async (_req, res) => {
  NFE_URLS = resolveNfeUrls();

  async function call12() {
    const url = NFE_URLS?.STA;
    const agent = await createA1AgentFromGCS(url);
    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF';
    const tpAmb = String(getenv('NFE_TP_AMB') || '2');
    const cUF   = String(getenv('NFE_UF_CODIGO') || '31');

    const body = minifyXml(`
      <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>${tpAmb}</tpAmb>
          <cUF>${cUF}</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    `);

    try {
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        agent: () => agent,
        headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`, 'SOAPAction': action },
        body: minifyXml(`<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>${body}</soap:Body></soap:Envelope>`),
      }, 15000);
      const t = await r.text();
      return { ok: r.ok, status: r.status, headers: Object.fromEntries(r.headers.entries() || []), preview: t.substring(0, 900) + (t.length > 900 ? '...' : '') };
    } catch (e) {
      return { ok: false, error: errInfo(e) };
    }
  }

  async function call11() {
    const url = NFE_URLS?.STA;
    const agent = await createA1AgentFromGCS(url);
    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF';
    const tpAmb = String(getenv('NFE_TP_AMB') || '2');
    const cUF   = String(getenv('NFE_UF_CODIGO') || '31');

    const body = minifyXml(`
      <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
        <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>${tpAmb}</tpAmb>
          <cUF>${cUF}</cUF>
          <xServ>STATUS</xServ>
        </consStatServ>
      </nfeDadosMsg>
    `);

    try {
      const r = await fetchWithTimeout(url, {
        method: 'POST',
        agent: () => agent,
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': `"${action}"` },
        body: minifyXml(`<?xml version="1.0" encoding="utf-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>${body}</soap:Body>
          </soap:Envelope>`),
      }, 15000);
      const t = await r.text();
      return { ok: r.ok, status: r.status, headers: Object.fromEntries(r.headers.entries() || []), preview: t.substring(0, 900) + (t.length > 900 ? '...' : '') };
    } catch (e) {
      return { ok: false, error: errInfo(e) };
    }
  }

  const results = [];
  results.push(await step('soap12', call12));
  results.push(await step('soap11', call11));

  const ok = results.some(r => r.ok);
  res.status(ok ? 200 : 500).json({
    ok,
    results,
    hint: 'Se ambos falham com code tipo ERR_SSL_*, a causa é mTLS/handshake. Se 12 falhar e 11 funcionar → preferência por SOAP 1.1.',
  });
});

/* ──────────────────────────────────────────────────────────────
 * Listar URLs resolvidas (prod/hom) com base nas ENVs atuais
 * ────────────────────────────────────────────────────────────── */
router.get('/debug/nfe/urls', async (_req, res) => {
  try {
    const uf = getenv('NFE_UF') || 'MG';
    const tpAmb = getenv('NFE_TP_AMB') || getenv('NFE_ENV') || '2';
    const urls = resolveNfeUrls(uf, tpAmb);
    res.json({ ok: true, uf, tpAmb, urls });
  } catch (e) {
    res.status(500).json({ ok: false, error: errInfo(e) });
  }
});

/* ──────────────────────────────────────────────────────────────
 * Cert A1 – Info (GCS + OpenSSL)
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/a1-info', async (_req, res) => {
  let tmpDir;
  try {
    const { pfxPath, pass, tmpDir: tdir, bucket, object } = await downloadPfxFromGCS();
    tmpDir = tdir;

    const info = await parseCertWithOpenssl(pfxPath, pass, tmpDir);

    res.json({
      ok: true,
      source: { bucket, object },
      info,
      tips: [
        'Se days_remaining <= 0, renove o certificado A1 imediatamente.',
        'Exporte o PFX incluindo TODA a cadeia (intermediárias + raiz ICP).',
      ],
    });
  } catch (e) {
    const explain = (e?.code === 'ENOENT' && /openssl/i.test(e?.message || ''))
      ? 'OpenSSL (CLI) não encontrado no container. Instale com: apt-get update && apt-get install -y openssl'
      : (e?.code === 'MISSING_ENVS'
        ? 'Variáveis de ambiente ausentes; defina NFE_CERT_BUCKET, NFE_CERT_OBJECT e NFE_CERT_PFX_PASS.'
        : undefined);

    res.status(500).json({
      ok: false,
      error: errInfo(e),
      hint: explain,
      dockerfile_tip: 'RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*',
    });
  } finally {
    if (tmpDir) { try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {} }
  }
});

/* ──────────────────────────────────────────────────────────────
 * mTLS Handshake via fetch (exercita HTTPS+Agent)
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/mtls-handshake', async (_req, res) => {
  try {
    NFE_URLS = resolveNfeUrls();
    const url   = NFE_URLS?.STA;
    const agent = await createA1AgentFromGCS(url);

    const envelope = minifyXml(`
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
        <soap:Body>
          <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
            <consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
              <tpAmb>${String(getenv('NFE_TP_AMB') || getenv('NFE_ENV') || '2')}</tpAmb>
              <cUF>${String(getenv('NFE_UF_CODIGO') || '31')}</cUF>
              <xServ>STATUS</xServ>
            </consStatServ>
          </nfeDadosMsg>
        </soap:Body>
      </soap:Envelope>
    `);

    const resp = await fetchWithTimeout(url, {
      method: 'POST',
      agent: () => agent, // compatível com node-fetch v3
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      body: envelope,
    }, 12000);
    const raw = await resp.text();

    res.json({
      ok: resp.ok,
      status: resp.status,
      note: 'Se status 200/500 com corpo SOAP, o handshake mTLS ocorreu. 4xx pode indicar SOAP inválido.',
      preview: raw.substring(0, 600) + (raw.length > 600 ? '...' : ''),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: errInfo(e) });
  }
});

/* ──────────────────────────────────────────────────────────────
 * ENVs relevantes (sem vazar senha)
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/env', (_req, res) => {
  res.json({
    NFE_TP_AMB: getenv('NFE_TP_AMB') || getenv('NFE_ENV') || null,
    NFE_UF: getenv('NFE_UF') || null,
    NFE_UF_CODIGO: getenv('NFE_UF_CODIGO') || null,
    NFE_CERT_BUCKET: getenv('NFE_CERT_BUCKET') || null,
    NFE_CERT_OBJECT: getenv('NFE_CERT_OBJECT') || null,
    NFE_CERT_GCS_URI: getenv('NFE_CERT_GCS_URI') || null,
    A1_PFX_B64: getenv('A1_PFX_B64') ? 'set' : 'unset',
    NFE_CERT_PFX_B64: getenv('NFE_CERT_PFX_B64') ? 'set' : 'unset',
    NFE_CERT_PFX_PATH: getenv('NFE_CERT_PFX_PATH') || null,
    NODE_DEBUG: getenv('NODE_DEBUG') || null,
  });
});

/* ──────────────────────────────────────────────────────────────
 * Usa o cliente oficial
 * ────────────────────────────────────────────────────────────── */
router.get('/nfe/debug/status-client', async (_req, res) => {
  try {
    const ret = await sefazClient.statusServico();
    res.json({ ok: true, ret });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: errInfo(e),
      hint: 'Falhou via cliente oficial (provável transporte/TLS se não chegou SOAP). Compare com /status-both e /handshake-tls.',
    });
  }
});

export default router;
