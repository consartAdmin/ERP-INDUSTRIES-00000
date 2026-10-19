// ╔═══════════════════════════════════════════════════════════════════╗
// ║ 🌐 staticRoutes.js – Estáticos + DANFE/XML via GCS                ║
// ║ • /public/** continua servindo assets locais (budgets, imgs etc.) ║
// ║ • DANFE/XML: sempre redireciona para GCS (sem local)              ║
// ║ • Variáveis usadas (todas opcionais, com defaults):               ║
// ║   PDF_BUCKET_DANFE_EMITIDAS=gcs                                   ║
// ║   PDF_BUCKET_XML_EMITIDAS=gcs                                     ║
// ║   DANFE_EMITIDAS_GCS_BUCKET=consart-erp                           ║
// ║   XML_EMITIDAS_GCS_BUCKET=consart-erp                             ║
// ║   DANFE_EMITIDAS_GCS_PREFIX_BASE=danfe_emitidas                   ║
// ║   XML_EMITIDAS_GCS_PREFIX_BASE=xml_emitidas                       ║
/* ║   GCS_SIGNED_URL_TTL=86400   (apenas log/telemetria aqui)         */
// ╚═══════════════════════════════════════════════════════════════════╝

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const router = express.Router();

// ╔═══════════════════════════════════════════════════════════════════╗
// ESM paths
// ╚═══════════════════════════════════════════════════════════════════╝
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ╔═══════════════════════════════════════════════════════════════════╗
// Logs por ENV
// ╚═══════════════════════════════════════════════════════════════════╝
const STATIC_LOG_ON = String(process.env.NFE_STATIC_LOG || "0") === "1";
const STORE_LOG_ON  = String(process.env.NFE_STORE_LOG  || "0") === "1";
const LOG_LEVEL     = String(process.env.LOG_LEVEL || "info").toLowerCase();
function levelEnabled(want) {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  const cur   = order[LOG_LEVEL] ?? 20;
  const need  = order[want] ?? 20;
  return need >= cur;
}
function logDebug(msg, extra) { if ((STATIC_LOG_ON || STORE_LOG_ON) && levelEnabled("debug")) console.debug(`[staticRoutes][DEBUG] ${msg}`, extra ?? ""); }
function logInfo (msg, extra) { if ((STATIC_LOG_ON || STORE_LOG_ON) && levelEnabled("info"))  console.log  (`[staticRoutes][INFO]  ${msg}`, extra ?? ""); }
function logWarn (msg, extra) { if ((STATIC_LOG_ON || STORE_LOG_ON) && levelEnabled("warn"))  console.warn (`[staticRoutes][WARN]  ${msg}`, extra ?? ""); }
function logError(msg, extra) { if (STATIC_LOG_ON || STORE_LOG_ON)                               console.error(`[staticRoutes][ERROR] ${msg}`, extra ?? ""); }

const reqBrief = (req) => ({
  id: req.get?.("x-request-id"),
  method: req.method,
  url: req.originalUrl || req.url,
  ip: req.ip,
  ua: req.get?.("user-agent"),
});

// ╔═══════════════════════════════════════════════════════════════════╗
// /public bases (mantidas para budgets, imagens etc.)
// ╚═══════════════════════════════════════════════════════════════════╝
const publicDir    = path.join(__dirname, "..", "public");
const publicParent = path.join(__dirname, "..", "..", "public");
const staticBases  = [
  publicDir,
  publicParent,
  "/app/backend/public",
  "/app/public",
  "/tmp/backend/public",
].filter(Boolean);

// ╔═══════════════════════════════════════════════════════════════════╗
// /config/apiBase.js  → expõe APENAS este arquivo para o front       ║
// (não expomos a pasta inteira por segurança)                        ║
/* ╚═══════════════════════════════════════════════════════════════════╝ */

const apiBaseCandidates = [
  path.join(__dirname, '..', 'config', 'apiBase.js'),   // dev padrão
  path.join(process.cwd(), 'backend', 'config', 'apiBase.js'), // fallback
];

router.get('/config/apiBase.js', (req, res) => {
  // Não cachear (base de API pode mudar entre ambientes)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/javascript; charset=utf-8');

  for (const candidate of apiBaseCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        logInfo('apiBase.js served', { from: candidate, ...reqBrief(req) });
        return res.sendFile(candidate);
      }
    } catch (e) {
      logDebug('apiBase.js check error', { candidate, err: e?.message });
    }
  }
  logWarn('apiBase.js not found', { tried: apiBaseCandidates });
  return res.status(404).send('// apiBase.js não encontrado (verifique backend/config/apiBase.js)');
});

// (Opcional) compat: se algum HTML antigo pedir /public/config/apiBase.js,
// redireciona para a nova rota:
router.get('/public/config/apiBase.js', (_req, res) => {
  return res.redirect(302, '/config/apiBase.js');
});

// ╔═══════════════════════════════════════════════════════════════════╗
// Backend de armazenamento (apenas GCS suportado aqui)
// ╚═══════════════════════════════════════════════════════════════════╝
const STORAGE_DANFE = String(process.env.PDF_BUCKET_DANFE_EMITIDAS || "gcs").toLowerCase();
const STORAGE_XML   = String(process.env.PDF_BUCKET_XML_EMITIDAS   || "gcs").toLowerCase();

const DANFE_BUCKET = process.env.DANFE_EMITIDAS_GCS_BUCKET || "consart-erp";
const XML_BUCKET   = process.env.XML_EMITIDAS_GCS_BUCKET   || "consart-erp";

const DANFE_PREFIX_BASE = process.env.DANFE_EMITIDAS_GCS_PREFIX_BASE || "danfe_emitidas";
const XML_PREFIX_BASE   = process.env.XML_EMITIDAS_GCS_PREFIX_BASE   || "xml_emitidas";

const GCS_SIGNED_URL_TTL = Number(process.env.GCS_SIGNED_URL_TTL || 86400); // usado só em logs aqui

function ensureGcsOr404(res, kind) {
  const ok = (kind === "pdf") ? STORAGE_DANFE === "gcs" : STORAGE_XML === "gcs";
  if (!ok) {
    return res.status(404).send("Armazenamento não suportado neste endpoint (somente GCS).");
  }
  return null;
}
function gcsUrl(bucket, prefixBase, file) {
  const clean = String(prefixBase || "").replace(/^\/+|\/+$/g, "");
  return `https://storage.googleapis.com/${bucket}/${clean}/${file}`;
}

// ╔═══════════════════════════════════════════════════════════════════╗
// Cache seletivo (sessionTimeout.js sem cache)
// ╚═══════════════════════════════════════════════════════════════════╝
function setNoCacheIfSessionTimeout(res, filePath) {
  if (filePath.endsWith("sessionTimeout.js")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}

// ╔═══════════════════════════════════════════════════════════════════╗
// Montagem de /public
// ╚═══════════════════════════════════════════════════════════════════╝
for (const base of [...new Set(staticBases)]) {
  if (!base) continue;
  try {
    if (fs.existsSync(base)) {
      router.use(
        "/public",
        express.static(base, {
          setHeaders: (res, filePath) => setNoCacheIfSessionTimeout(res, filePath),
        })
      );
      logInfo("Mounted static base", { base });
    } else {
      logDebug("Static base not found (skipped)", { base });
    }
  } catch (e) {
    logWarn("Error mounting static base (skipped)", { base, err: e?.message });
  }
}

// Também na raiz
if (fs.existsSync(publicDir)) {
  router.use(
    "/",
    express.static(publicDir, {
      setHeaders: (res, filePath) => setNoCacheIfSessionTimeout(res, filePath),
    })
  );
  logInfo("Mounted root static", { base: publicDir });
}

// ╔═══════════════════════════════════════════════════════════════════╗
/* Rotas silenciosas do front legado */
// ╚═══════════════════════════════════════════════════════════════════╝
//router.get([
  //"/public/includes/home.css",
  //"/public/statusUsuario/statusUsuario.css",
  //"/public/verificarLogin/verificarLogin.js",
  //"/public/statusUsuario/statusUsuario.js",
//], (_req, res) => res.type("text/plain").send(""));

// ╔═══════════════════════════════════════════════════════════════════╗
// Helpers p/ nomes padrão (usados só para montar o arquivo no prefixo)
// ╚═══════════════════════════════════════════════════════════════════╝
function zeroPad(n, size) { return n == null ? "" : String(n).padStart(size, "0"); }
function buildPdfCandidates({ numero, serie }) {
  const numRaw = String(numero || "").replace(/\D+/g, "");
  const serRaw = String(serie  || "").replace(/\D+/g, "");
  const cands = new Set();
  if (numRaw) {
    cands.add(`danfe_${numRaw}.pdf`);
    cands.add(`danfe_${zeroPad(numRaw, 9)}.pdf`);
  }
  if (serRaw && numRaw) {
    cands.add(`danfe_${serRaw}_${numRaw}.pdf`);
    cands.add(`danfe_${zeroPad(serRaw, 3)}_${zeroPad(numRaw, 9)}.pdf`);
  }
  return [...cands];
}
function buildXmlCandidates({ numero, serie }) {
  const numRaw = String(numero || "").replace(/\D+/g, "");
  const serRaw = String(serie  || "").replace(/\D+/g, "");
  const cands = new Set();
  if (numRaw) {
    cands.add(`nfe_${numRaw}.xml`);
    cands.add(`nfe_${zeroPad(numRaw, 9)}.xml`);
  }
  if (serRaw && numRaw) {
    cands.add(`nfe_${serRaw}_${numRaw}.xml`);
    cands.add(`nfe_${zeroPad(serRaw, 3)}_${zeroPad(numRaw, 9)}.xml`);
  }
  return [...cands];
}

// ╔═══════════════════════════════════════════════════════════════════╗
// 📄 DANFE por filename  → redirect GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/pdf/:file", (req, res) => {
  if (ensureGcsOr404(res, "pdf")) return;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const file = req.params.file;
  const url = gcsUrl(DANFE_BUCKET, DANFE_PREFIX_BASE, file);
  logInfo("DANFE_PDF (by filename) → redirect GCS", {
    file, url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
// 📦 XML por filename → redirect GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/xml/:file", (req, res) => {
  if (ensureGcsOr404(res, "xml")) return;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const file = req.params.file;
  const url = gcsUrl(XML_BUCKET, XML_PREFIX_BASE, file);
  logInfo("XML (by filename) → redirect GCS", {
    file, url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
// 📄 DANFE por número (compat) → redirect p/ 1º candidato no GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/pdf/danfe_:numero.pdf", (req, res) => {
  if (ensureGcsOr404(res, "pdf")) return;
  const { numero } = req.params;
  const candidates = buildPdfCandidates({ numero });
  const url = gcsUrl(DANFE_BUCKET, DANFE_PREFIX_BASE, candidates[0]);
  logInfo("DANFE_PDF (numero) → redirect GCS", {
    numero, file: candidates[0], url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
// 📄 DANFE por série+número (novo) → redirect p/ 1º candidato no GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/pdf/danfe_:serie_:numero.pdf", (req, res) => {
  if (ensureGcsOr404(res, "pdf")) return;
  const { serie, numero } = req.params;
  const candidates = buildPdfCandidates({ serie, numero });
  const url = gcsUrl(DANFE_BUCKET, DANFE_PREFIX_BASE, candidates[0]);
  logInfo("DANFE_PDF (serie+numero) → redirect GCS", {
    serie, numero, file: candidates[0], url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
// 📦 XML por número (compat) → redirect p/ 1º candidato no GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/xml/nfe_:numero.xml", (req, res) => {
  if (ensureGcsOr404(res, "xml")) return;
  const { numero } = req.params;
  const candidates = buildXmlCandidates({ numero });
  const url = gcsUrl(XML_BUCKET, XML_PREFIX_BASE, candidates[0]);
  logInfo("XML (numero) → redirect GCS", {
    numero, file: candidates[0], url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
// 📦 XML por série+número (novo) → redirect p/ 1º candidato no GCS
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/painelNotasFiscais/xml/nfe_:serie_:numero.xml", (req, res) => {
  if (ensureGcsOr404(res, "xml")) return;
  const { serie, numero } = req.params;
  const candidates = buildXmlCandidates({ serie, numero });
  const url = gcsUrl(XML_BUCKET, XML_PREFIX_BASE, candidates[0]);
  logInfo("XML (serie+numero) → redirect GCS", {
    serie, numero, file: candidates[0], url, ttl: GCS_SIGNED_URL_TTL
  });
  return res.redirect(302, url);
});

// ╔═══════════════════════════════════════════════════════════════════╗
/* 🖼️ Fallback de imagens públicas (mantém local) */
// ╚═══════════════════════════════════════════════════════════════════╝
router.get("/public/imagens/:arquivo", async (req, res) => {
  const started = Date.now();
  try {
    const alvo = path.join(publicDir, "imagens", req.params.arquivo);
    try {
      await fs.promises.access(alvo);
      logDebug("IMG_FALLBACK → hit", { ...reqBrief(req), alvo, ms: Date.now() - started });
      return res.sendFile(alvo);
    } catch {
      const fallback = path.join(publicDir, "imagens", "sem-imagem.png");
      try {
        await fs.promises.access(fallback);
        logInfo("IMG_FALLBACK → fallback", { ...reqBrief(req), fallback, ms: Date.now() - started });
        return res.sendFile(fallback);
      } catch {
        logWarn("IMG_FALLBACK → not found", { ...reqBrief(req), alvo, ms: Date.now() - started });
        return res.status(404).send("Imagem não encontrada");
      }
    }
  } catch (e) {
    logError("IMG_FALLBACK → error", { ...reqBrief(req), message: e?.message, stack: e?.stack, ms: Date.now() - started });
    return res.status(500).send("Erro interno");
  }
});

// ──────────────────────────────────────────────────────────────
// Expor os "front services" (arquivos .js do navegador)
// ──────────────────────────────────────────────────────────────
const servicesApisDir = path.join(__dirname, '..', 'services', 'apis');

if (fs.existsSync(servicesApisDir)) {
  router.use(
    '/front-services/apis',
    express.static(servicesApisDir, {
      setHeaders: (res, filePath) => {
        // Garante MIME correto
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          // Cache curto em dev; em prod você pode aumentar
          res.setHeader('Cache-Control', 'public, max-age=60');
        }
      }
    })
  );
  logInfo('Mounted front-services/apis', { base: servicesApisDir });
} else {
  logWarn('front-services/apis not found (skipped)', { base: servicesApisDir });
}

export default router;
