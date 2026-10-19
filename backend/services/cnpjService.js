// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ 🧠 backend/services/cnpjService.js – Consulta CNPJ (BrasilAPI)      ║
// ╚═══════════════════════════════════════════════════════════════════════╝
import NodeCache from "node-cache";

// ────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────
const CACHE_TTL = Number(process.env.CNPJ_CACHE_TTL) || 600; // 10 min
const TIMEOUT_MS = Number(process.env.CNPJ_HTTP_TIMEOUT_MS) || 8000;
const MAX_RETRIES = Number(process.env.CNPJ_HTTP_RETRIES) || 2;

const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });

// ────────────────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────────────────
const onlyDigits = (s = "") => String(s).replace(/\D/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Valida CNPJ com DV (módulo 11) */
function isValidCNPJ(v) {
  const cnpj = onlyDigits(v);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base) => {
    let i = base.length - 7, sum = 0;
    for (let j = 0; j < base.length; j++) {
      sum += Number(base[j]) * i--;
      if (i < 2) i = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const base = cnpj.slice(0, 12);
  const d1 = calc(base);
  const d2 = calc(base + d1);
  return cnpj === base + String(d1) + String(d2);
}

/** fetch com timeout (AbortController) + fallback dinâmico ao node-fetch para Node < 18 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const opts = { ...options, signal: controller.signal };

  // garante fetch em versões antigas do Node
  let _fetch = globalThis.fetch;
  if (typeof _fetch !== "function") {
    const mod = await import("node-fetch");
    _fetch = mod.default;
  }

  try {
    return await _fetch(url, opts);
  } finally {
    clearTimeout(t);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Chamada à BrasilAPI com retries
// ────────────────────────────────────────────────────────────────────────
async function callBrasilAPI(cnpj) {
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  let lastErr = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "CONSART-ERP", "Accept": "application/json" },
      });

      // BrasilAPI retorna JSON de erro com {type,message}
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

      if (!res.ok) {
        // 429/5xx → elegível a retry
        if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
          throw new RetryableError(`BrasilAPI HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        // 4xx não-retry
        throw new Error(data?.message || `BrasilAPI HTTP ${res.status}`);
      }
      if (data?.type === "bad_request" || data?.message) {
        // mensagens de erro sem status 4xx
        throw new Error(data?.message || "BrasilAPI bad_request");
      }
      return data;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const retryable = e instanceof RetryableError || /aborted|timeout|ETIMEDOUT|ECONNRESET/i.test(msg);
      if (attempt < MAX_RETRIES && retryable) {
        // backoff exponencial com jitter
        const wait = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await sleep(wait);
        continue;
      }
      break;
    }
  }
  throw new Error(lastErr?.message || "Falha ao consultar BrasilAPI");
}

class RetryableError extends Error {
  constructor(msg) { super(msg); this.name = "RetryableError"; }
}

// ────────────────────────────────────────────────────────────────────────
/** API pública do service */
// ────────────────────────────────────────────────────────────────────────
export async function consultarCnpjGratis(inputCnpj) {
  const cnpj = onlyDigits(inputCnpj);
  if (!isValidCNPJ(cnpj)) throw new Error("CNPJ inválido");

  const cacheKey = `brasilapi:${cnpj}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const rawPayload = await callBrasilAPI(cnpj);

  const normalized = normalizeCnpjGratis(rawPayload);
  const out = { provider: "brasilapi", rawPayload, normalized };

  cache.set(cacheKey, out);
  return out;
}

/** Normaliza o payload da BrasilAPI para um shape estável para o front */
export function normalizeCnpjGratis(data = {}) {
  const est = data?.estabelecimento || {};

  // e-mail
  let email = data.email || est.email || "";
  if (!email && Array.isArray(data?.emails) && data.emails.length) email = String(data.emails[0] || "");

  // telefone
  let telefone =
    data.telefone || data.telefone1 || est.telefone || est.telefone1 || "";
  if (!telefone && Array.isArray(data?.telefones) && data.telefones.length) {
    telefone = String(data.telefones[0] || "");
  }

  // logradouro → separa tipo e nome se necessário
  const logradouro = est.logradouro || "";
  let tipo_logradouro = est.tipo_logradouro || "";
  let nome_logradouro = logradouro;
  if (!tipo_logradouro && logradouro) {
    const parts = String(logradouro).trim().split(/\s+/);
    tipo_logradouro = (parts.shift() || "").toUpperCase();
    nome_logradouro = parts.join(" ");
  }

  // IE / IM (podem não existir na BrasilAPI)
  const ies = Array.isArray(est.inscricoes_estaduais) ? est.inscricoes_estaduais : [];
  const ims = Array.isArray(est.inscricoes_municipais) ? est.inscricoes_municipais : [];

  const inscricao_estadual =
    (ies[0]?.inscricao_estadual || ies[0]?.numero || ies[0]?.inscricao || data.ie || "").toString();

  const inscricao_municipal =
    (ims[0]?.inscricao_municipal || ims[0]?.numero || ims[0]?.inscricao || data.im || "").toString();

  // UF padronizada
  const estado =
    (est.estado?.sigla || est.estado || data.uf || "").toString().trim().toUpperCase();

  // CEP só dígitos (o front decide formatação)
  const cep = onlyDigits(est.cep || "");

  return {
    cnpj: onlyDigits(data.cnpj || data.documento || ""),
    razao_social: (data.razao_social || data.nome || "").toString(),
    nome_fantasia: (est.nome_fantasia || data.fantasia || "").toString(),
    email,
    telefone,
    cep,
    tipo_logradouro,
    nome_logradouro,
    numero: String(est.numero || ""),
    bairro: (est.bairro || "").toString(),
    cidade: (est.municipio || est.cidade || est?.cidade?.nome || "").toString(),
    estado,
    inscricao_estadual,
    inscricao_municipal,
    cnae_principal: (est?.atividade_principal?.codigo || data?.cnae_fiscal || "").toString(),
    natureza_juridica: (data?.natureza_juridica || "").toString(),
  };
}
