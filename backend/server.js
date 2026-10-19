// ╔══════════════════════════════════════════════════════════════════════╗
// ║ server.js – Web/API principal ERP Consart (Cloud Run, ESM, Express) ║
/* ╚══════════════════════════════════════════════════════════════════════╝ */
import './config/loadEnv.js';
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import v8 from "node:v8";
import { Storage } from '@google-cloud/storage';
import https from 'node:https';
import dns from "dns"; // (pode ser usado em checks futuros)
import { AsyncLocalStorage } from "node:async_hooks";
import { erpCompanyContext } from './utils/erpCompanyContext.js';
import { queueErrorEmail, sendErrorEmail } from "./errorEmailReporter.js";

import jwt from "jsonwebtoken";
import { Pool } from "pg";
import pool from "./config/db.js";

/* ╔══════════════════════════════════════════════════════════╗
   ║ Auth — JWT (login) OU Master Admin Token (ENV)           ║
   ╚══════════════════════════════════════════════════════════╝ */
function getBearerToken(req) {
   const auth = String(req.headers.authorization || "");
   if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
   return null;
}

function mask(v, n = 6) {
   if (!v) return null;
   const s = String(v);
   return s.length <= n ? `${s}***` : `${s.slice(0, n)}***`;
}

/**
 * ✅ Aceita:
 *  - Authorization: Bearer <JWT>   (verifica com JWT_SECRET)
 *  - Authorization: Bearer <CONSART_ADMIN_TOKEN> (master key)
 *  - header x-consart-admin-token: <CONSART_ADMIN_TOKEN>
 *  - query ?token=... (para testes CLI rápidos)
 */
function requireAuthCrm(req, res, next) {
   try {
      const jwtSecret = process.env.JWT_SECRET || "";
      const adminToken = process.env.CONSART_ADMIN_TOKEN || "";

      const bearer = getBearerToken(req);
      const queryToken = (req.query?.token ? String(req.query.token) : null);
      const headerAdmin = (req.headers["x-consart-admin-token"] ? String(req.headers["x-consart-admin-token"]) : null);

      const candidate = bearer || headerAdmin || queryToken;

      if (!candidate) {
         return res.status(401).json({ ok: false, error: "UNAUTHORIZED", reason: "MISSING_TOKEN" });
      }

      // ✅ 1) Master token (rápido)
      if (adminToken && candidate === adminToken) {
         req.user = { role: "admin", authType: "CONSART_ADMIN_TOKEN" };
         return next();
      }

      // ✅ 2) JWT
      if (!jwtSecret) {
         return res.status(500).json({
            ok: false,
            error: "AUTH_MISCONFIGURED",
            reason: "JWT_SECRET_NOT_SET"
         });
      }

      try {
         const payload = jwt.verify(candidate, jwtSecret);
         req.user = { ...payload, authType: "JWT" };
         return next();
      } catch (e) {
         return res.status(401).json({
            ok: false,
            error: "UNAUTHORIZED",
            reason: "INVALID_TOKEN",
         });
      }
   } catch (err) {
      return res.status(500).json({ ok: false, error: "AUTH_ERROR", message: err.message });
   }
}

/* ╔══════════════════════════════════════════════════════════╗
   ║ DEBUG — valida token recebido (não vaza segredo)         ║
   ╚══════════════════════════════════════════════════════════╝ */
function installAuthDebugRoute(app) {
   app.get("/api/_debug/auth", (req, res) => {
      const jwtSecret = process.env.JWT_SECRET || "";
      const adminToken = process.env.CONSART_ADMIN_TOKEN || "";

      const bearer = getBearerToken(req);
      const queryToken = (req.query?.token ? String(req.query.token) : null);
      const headerAdmin = (req.headers["x-consart-admin-token"] ? String(req.headers["x-consart-admin-token"]) : null);

      const candidate = bearer || headerAdmin || queryToken;

      const out = {
         ok: true,
         hasJWT_SECRET: !!jwtSecret,
         hasCONSART_ADMIN_TOKEN: !!adminToken,
         received: {
            hasAuthorization: !!req.headers.authorization,
            bearerPrefix: mask(bearer, 18),
            queryTokenPrefix: mask(queryToken, 18),
            headerAdminPrefix: mask(headerAdmin, 18),
         },
         decision: null,
         jwtPayload: null,
      };

      if (!candidate) {
         out.decision = "DENY:MISSING_TOKEN";
         return res.status(200).json(out);
      }

      if (adminToken && candidate === adminToken) {
         out.decision = "ALLOW:CONSART_ADMIN_TOKEN";
         return res.status(200).json(out);
      }

      if (!jwtSecret) {
         out.decision = "DENY:JWT_SECRET_NOT_SET";
         return res.status(200).json(out);
      }

      try {
         out.jwtPayload = jwt.verify(candidate, jwtSecret);
         out.decision = "ALLOW:JWT";
         return res.status(200).json(out);
      } catch {
         out.decision = "DENY:INVALID_TOKEN";
         return res.status(200).json(out);
      }
   });
}

/* ╔══════════════════════════════════════════════════════════╗
   ║ Contexto por requisição (logs/traceId)                   ║
   ╚══════════════════════════════════════════════════════════╝ */
const als = new AsyncLocalStorage();
function withRequestContext(req, _res, next) {
   const traceHeader = req.get("x-cloud-trace-context") || "";
   const traceId = traceHeader.split("/")[0] || null;
   const ctx = {
      requestId: req.headers["x-request-id"]?.toString() || crypto.randomUUID(),
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip,
      ua: req.get("user-agent") || "",
      traceId,
      startedAt: Date.now(),
   };
   als.run(ctx, next);
}
const getCtx = () => als.getStore() || {};

/* ╔══════════════════════════════════════════════════════════╗
   ║ Logger estruturado (modos + filtros por ENV)             ║
   ╚══════════════════════════════════════════════════════════╝ */
/*
  LOG_MODE         : full | compact | errors    (default compact)
  LOG_OMIT         : campos a omitir (ex.: "ip,ua,traceId")
  LOG_ACCESS_MODE  : off | errors | smart | all (default smart)
  LOG_SKIP_STATUS  : lista status a pular (ex.: "304,404") (default "304")
  LOG_SKIP_PATHS   : regex string p/ ignorar caminhos barulhentos
                     (default: '^/(favicon\\.ico|public/(includes|statusUsuario|verificarLogin)/)')
*/
function getenv(key, def = "") {
   const raw = process.env[key];
   if (!raw) return def;
   return String(raw).trim().split(/\s+/)[0];
}

const LOG_MODE = (getenv("LOG_MODE", "compact") || "compact").toLowerCase();
const LOG_OMIT = (process.env.LOG_OMIT || "ip,ua,traceId").split(",").map(s => s.trim()).filter(Boolean);
const LOG_ACCESS_MODE = (getenv("LOG_ACCESS_MODE", "smart") || "smart").toLowerCase();
const LOG_SKIP_STATUS = (process.env.LOG_SKIP_STATUS || "304").split(",").map(s => s.trim()).filter(Boolean);
const LOG_SKIP_PATHS = String(process.env.LOG_SKIP_PATHS || '^/(favicon\\.ico|public/(includes|statusUsuario|verificarLogin)/)');

function log(level, msg, extra = {}) {
   if (LOG_MODE === "errors" && level !== "ERROR") return;

   let emailPromise = null;

   const ctx = getCtx();
   const base = {
      ts: new Date().toISOString(),
      level,
      msg,
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      status: extra?.status,
      ms: extra?.ms,
   };

   const full = {
      ...base,
      ip: ctx.ip,
      ua: ctx.ua,
      traceId: ctx.traceId,
      ...extra,
   };

   if (level === "ERROR") {
      emailPromise = queueErrorEmail(msg, full);
   }

   const payload = LOG_MODE === "full" ? full : base;
   for (const k of LOG_OMIT) delete payload[k];

   const line = JSON.stringify(payload);
   if (level === "ERROR") console.error(line);
   else if (level === "WARN") console.warn(line);
   else console.log(line);

   return emailPromise;
}
const info = (msg, extra) => log("INFO", msg, extra);
const warn = (msg, extra) => log("WARN", msg, extra);
const error = (msg, extra) => log("ERROR", msg, extra);

/* ╔══════════════════════════════════════════════════════════╗
   ║ Tracer PG (envolve Pool.query)                           ║
   ╚══════════════════════════════════════════════════════════╝ */
const ROOT = process.cwd();
function shortStack() {
   const s = new Error().stack || "";
   const lines = s.split("\n").slice(2).filter(l => l.includes(ROOT));
   return lines
      .map(l => l.replace(/^\s*at\s+/, "at "))
      .filter(l => !/node_modules|internal\/|async_hooks|node:/.test(l))
      .slice(0, 6)
      .join("\n");
}
(function installPgQueryTracer() {
   const Orig = Pool.prototype.query;
   Pool.prototype.query = async function traced(sql, values, cb) {
      try {
         return await Orig.call(this, sql, values, cb);
      } catch (err) {
         const sqlText = typeof sql === "string" ? sql : String(sql?.text || "");
         const e = new Error(err.message);
         e.code = err.code;
         e.detail = err.detail;
         e.schema = err.schema;
         e.table = err.table;
         e.column = err.column;
         e.position = err.position;
         e.where = err.where;
         e.sql = sqlText;
         e.values = values || [];
         e.at = shortStack();
         e.stack = err.stack;

         error("PG_ERROR", {
            pg: {
               code: e.code,
               detail: e.detail,
               schema: e.schema,
               table: e.table,
               column: e.column,
               position: e.position,
               where: e.where
            },
            sql: e.sql,
            values: e.values,
            at: e.at,
            err: { message: e.message, stack: e.stack }
         });

         throw e;
      }
   };
})();

/* ╔══════════════════════════════════════════════════════════╗
   ║ App base                                                 ║
   ╚══════════════════════════════════════════════════════════╝ */
const app = express();
const storage = new Storage();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", true);

// /logistica-demo → app de logística (LOGISTICA_DEMO_URL; vazio = desligado)
import logisticaDemoProxy from "./middleware/logisticaDemoProxy.js";
app.use(logisticaDemoProxy());

/* ╔══════════════════════════════════════════════════════════╗
   ║ Middlewares globais                                      ║
   ╚══════════════════════════════════════════════════════════╝ */
app.use(
   '/iconsImagens',
   express.static(path.join(__dirname, 'iconsImagens'))
);

app.use(withRequestContext);

// 🔐 JSON com rawBody (necessário para validar HMAC do webhook de NF-e)
app.use(express.json({
   limit: "20mb",
   verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.text({ type: ['application/xml', 'text/xml'], limit: '10mb' }));

// CORS
app.use((req, res, next) => {
   res.setHeader("Access-Control-Allow-Origin", "*");
   res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-request-id, X-CRM-Company, X-ERP-Company"
   );
   res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
   if (req.method === "OPTIONS") return res.sendStatus(204);
   next();
});

// Empresa da tela (BH3 x CONSART): os repositórios escolhem a tabela por ela
app.use(erpCompanyContext);

// Access log inteligente
app.use((req, res, next) => {
   const rid = getCtx().requestId || crypto.randomUUID();
   req.id = rid;
   res.setHeader("x-request-id", rid);
   const start = Date.now();

   res.on("finish", () => {
      const status = res.statusCode;
      if (LOG_ACCESS_MODE === "off") return;

      // pular status configurados
      if (LOG_SKIP_STATUS.includes(String(status))) return;

      const url = req.originalUrl || req.url || "";
      const isApi = url.startsWith("/api/");
      const isStatic = url.startsWith("/public/") || url === "/favicon.ico";

      // pular caminhos barulhentos
      let skipPathsRe = null;
      try { skipPathsRe = new RegExp(LOG_SKIP_PATHS); } catch { /* ignore bad regex */ }
      if (skipPathsRe && skipPathsRe.test(url) && status < 500) return;

      // modo errors: registra só >=400
      if (LOG_ACCESS_MODE === "errors" && status < 400) return;

      // modo smart: registra tudo de /api; estático só se >=400
      if (LOG_ACCESS_MODE === "smart") {
         if (!isApi && status < 400) return;
      }

      info("HTTP_ACCESS", {
         status,
         ms: Date.now() - start,
         routeType: isApi ? "api" : (isStatic ? "static" : "other"),
      });
   });

   next();
});

// Normalizador de URL
app.use((req, _res, next) => {
   try {
      const [pathname, query = ""] = req.url.split("?");
      const decoded = pathname.replace(/%20/g, " ");
      const clean = decoded.replace(/\/{2,}/g, "/"); // só colapsa barras
      if (clean !== pathname) req.url = clean + (query ? `?${query}` : "");
   } catch { }
   next();
});

/* ╔══════════════════════════════════════════════════════════╗
   ║ /public – estáticos do repositório + temporários (/tmp)  ║
   ╚══════════════════════════════════════════════════════════╝ */
const REPO_PUBLIC_ROOT = path.join(__dirname, "public"); // backend/public
const TMP_PUBLIC_ROOT = "/tmp/backend/public";

// garante estrutura mínima no /tmp (DANFE/XML etc.)
try {
   fsSync.mkdirSync(path.join(TMP_PUBLIC_ROOT, "painelNotasFiscais", "xml"), { recursive: true });
   fsSync.mkdirSync(path.join(TMP_PUBLIC_ROOT, "painelNotasFiscais", "pdf"), { recursive: true });
} catch { }

// helper para forçar MIME correto quando necessário (sem dependências)
function forceMimeIfNeeded(_, res, next) {
   const p = res.req.path || "";
   if (p.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
   else if (p.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
   next();
}

// 1º: serve a pasta do repositório (onde ficam home.css, statusUsuario.css, etc.)
app.use("/public",
   forceMimeIfNeeded,
   express.static(REPO_PUBLIC_ROOT, {
      fallthrough: true,
      setHeaders(res, reqPath) {
         if (reqPath.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
         else if (reqPath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
         res.setHeader("Cache-Control", "public, max-age=300");
      }
   })
);

// 2º: serve também o /tmp (arquivos gerados em runtime), com o mesmo cuidado de MIME
app.use("/public",
   forceMimeIfNeeded,
   express.static(TMP_PUBLIC_ROOT, {
      fallthrough: true,
      setHeaders(res, reqPath) {
         if (reqPath.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
         else if (reqPath.endsWith(".js")) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
         res.setHeader("Cache-Control", "private, max-age=60");
      }
   })
);

/* ╔══════════════════════════════════════════════════════════╗
   ║ Rotas de saúde & métricas                                ║
   ╚══════════════════════════════════════════════════════════╝ */
app.get("/health", (_req, res) => res.status(200).send("OK"));
app.get("/ready", (_req, res) => res.status(200).send("READY"));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/readyz", (_req, res) => res.status(200).send("ready"));
app.get("/metrics", (_req, res) => {
   res.type("text/plain").send(`# minimal metrics
app_up 1
`);
});

/* ╔══════════════════════════════════════════════════════════╗
   ║ Compatibilidade legada (UI faturamento)                  ║
   ╚══════════════════════════════════════════════════════════╝ */
// stream legado (SSE) – indicado pela UI, mas descontinuado
app.get("/api/nfe/stream/:id", (req, res) => {
   return res.status(410).json({
      ok: false,
      error: "Endpoint de stream legado foi descontinuado. A emissão agora é assíncrona via webhook da API NF-e.",
      hint: "Acompanhe pelo status em public.nfe (ou GET /api/nfe/:id) e pelos eventos em /api/webhooks/nfe."
   });
});

/* ╔══════════════════════════════════════════════════════════╗
   ║ Rotas principais (importadas)                            ║
   ╚══════════════════════════════════════════════════════════╝ */

/* ╔══════════════════════════════════════════════════════════╗
   ║ Aliases Hotfix (ANTES das rotas principais)              ║
   ╚══════════════════════════════════════════════════════════╝ */
import aliasesHotfix from "./routes/aliasesHotfix.js";
app.use("/api", aliasesHotfix);

import homeRoutes from "./routes/homeRoutes.js";
app.use("/home", homeRoutes);

import gcsImagesRoutes from './routes/gcsImagesRoutes.js';
app.use('/api/gcs/images', gcsImagesRoutes);

import pdvLoginsRoutes from './routes/pdv_loginsRoutes.js';
app.use('/api/pdv-logins', pdvLoginsRoutes);

import customerPriceTablesRoutes from './routes/customerPriceTablesRoutes.js';

app.use(
   '/api/customer-price-tables',
   customerPriceTablesRoutes
);

import budgetSettingsRoutes
   from './routes/budgetSettingsRoutes.js';

app.use(
   '/api/budget-settings',
   budgetSettingsRoutes
);

// 🔐 Senhas dos Módulos (admin)
import modulePasswordsRoutes from './routes/modulePasswordsRoutes.js';
app.use('/api/module-passwords', modulePasswordsRoutes);

import budgetsIssuedsRoutes from './routes/budgetsIssuedsRoutes.js';
app.use('/api/budgets-issued', budgetsIssuedsRoutes);

import usersDashboardAccessRoutes from './routes/usersDashboardAccessRoutes.js';
app.use(
   '/api/users-dashboard-access',
   usersDashboardAccessRoutes
);

import salesAnalyticsRoutes
   from './routes/salesAnalyticsRoutes.js';

app.use(
   '/api/dashboard/sales-analytics',
   salesAnalyticsRoutes
);

import salesTaxesDashboardRoutes
   from './routes/salesTaxesDashboardRoutes.js';

app.use(
   '/api/dashboard/sales-taxes',
   salesTaxesDashboardRoutes
);

import taxRegimesRoutes
   from './routes/taxRegimesRoutes.js';

app.use(
   '/api/tax-regimes',
   taxRegimesRoutes
);

import taxAssessmentDashboardRoutes
   from './routes/taxAssessmentDashboardRoutes.js';

app.use(
   '/api/dashboard/tax-assessment',
   taxAssessmentDashboardRoutes
);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: fixedExpensesRoutes                  ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsLmRefRoutes from './routes/productsLmRefRoutes.js';
app.use('/api/products-lm-ref', productsLmRefRoutes);

import fixedExpensesRoutes from './routes/fixedExpensesRoutes.js';
app.use('/api/fixed-expenses', fixedExpensesRoutes);

import customersCreditRoutes from './routes/customersCreditRoutes.js';
app.use('/api/customers-credit', customersCreditRoutes);

import fiscalProfileV2Routes from './routes/fiscalProfileV2Routes.js';
app.use('/api/v2/fiscal-profiles', fiscalProfileV2Routes);

import fiscalClassificationV2Routes from './routes/fiscalClassificationV2Routes.js';
app.use('/api/v2/fiscal-classifications', fiscalClassificationV2Routes);

import productsFiscalV2Routes from './routes/productsFiscalV2Routes.js';
app.use('/api/v2/products-fiscal', productsFiscalV2Routes);

import banksRoutes from './routes/banksRoutes.js';
app.use('/api/bank-accounts', bankAccountsRoutes);

import bankAccountsRoutes from './routes/bankAccountsRoutes.js';
app.use('/api/banks', banksRoutes);

import bankAccountsBalanceRoutes from './routes/bankAccountsBalanceRoutes.js';
app.use('/api/bank-accounts-balance', bankAccountsBalanceRoutes);

import accountsReceivableReportsRoutes from './routes/accountsReceivableReportsRoutes.js';
app.use('/api/accounts-receivable-reports', accountsReceivableReportsRoutes);

import nfeBonusIssuedRoutes from './routes/nfeBonusIssuedRoutes.js';
app.use('/api/nfe-bonus', nfeBonusIssuedRoutes);

import nfeOperationTypesRoutes from './routes/nfeOperationTypesRoutes.js';
app.use('/api/nfe-operation-types', nfeOperationTypesRoutes);

import nfeStatusMapRoutes from './routes/nfeStatusMapRoutes.js';
app.use('/api/nfe-status-map', nfeStatusMapRoutes);

import conciliationSalesxStockRoutes from './routes/conciliationSalesxStockRoutes.js';
app.use(
   '/api/reports/conciliation-sales-stock',
   conciliationSalesxStockRoutes,
);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: licitationsRoutes                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import licitationsRoutes from './routes/licitationsRoutes.js';
app.use('/api/licitations', licitationsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                      ROTA: tasks                         ║
   ╚══════════════════════════════════════════════════════════╝ */
import tasksRoutes from './routes/tasksRoutes.js';
app.use('/api/tasks', tasksRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║             ROTA: cashDocumentTypesRoutes                ║
   ╚══════════════════════════════════════════════════════════╝ */
import cashDocumentTypesRoutes from './routes/cashDocumentTypesRoutes.js';
app.use('/api/cash-document-types', cashDocumentTypesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: productsBarCodeRoutes                ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsBarCodeRoutes from './routes/productsBarCodeRoutes.js';
app.use('/api/barcodes', productsBarCodeRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: expenseEntriesRoutes                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import expenseEntriesRoutes from './routes/expenseEntriesRoutes.js';
app.use('/api/expense-entries', expenseEntriesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                   ROTA: "loginRoutes"                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import loginRoutes from "./routes/loginRoutes.js";
app.use("/api", loginRoutes);

import productsMobileRoutes from './routes/productsMobileRoutes.js';
app.use('/api/products-mobile', productsMobileRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                ROTA: "cancelarNfeRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import cancelarNfeRoutes from './routes/cancelarNfeRoutes.js';
app.use('/api/nfe', cancelarNfeRoutes);

import productsManufacturesRoutes from './routes/productsManufacturesRoutes.js';
app.use('/api/products-manufactures', productsManufacturesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║              ROTA: "productsBoxesRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsBoxesRoutes from './routes/productsBoxesRoutes.js';
app.use('/api/products-boxes', productsBoxesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: mobilizedRoutes                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import mobilizedRoutes from './routes/mobilizedRoutes.js';
app.use('/api/mobilized', mobilizedRoutes);

import manufacturesOrdersRoutes from './routes/manufacturesOrdersRoutes.js';
app.use('/api/manufactures-orders', manufacturesOrdersRoutes);

import dreGerencialRoutes from './routes/dreGerencialRoutes.js';
app.use('/api/dre-gerencial', dreGerencialRoutes);


/////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
/* ╔══════════════════════════════════════════════════════════╗
   ║              E-mail inbound bootstrap (non-blocking)     ║
   ╚══════════════════════════════════════════════════════════╝ */
import { emailInboundsBootstrap } from './services/email/emailInboundsBootstrap.js';

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "ibgeLocationsRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import ibgeLocationsRoutes from './routes/ibgeLocationsRoutes.js';
app.use('/api', ibgeLocationsRoutes);

import roletaRoutes from './routes/roletaRoutes.js';
app.use('/api/roleta', roletaRoutes);

import meRoutes from './routes/meRoutes.js';
app.use(meRoutes);

import productsStockLotsRoutes from './routes/productsStockLotsRoutes.js';
app.use('/api/productsStockLots', productsStockLotsRoutes);

/*
 * Comissões por ORÇAMENTO removidas em 16/09/2026.
 * A apuração de comissão passou a ser exclusivamente por NOTA EMITIDA —
 * ver salesCommissionsFromInvoicesRoutes (/api/sales-commissions-from-invoices).
 * Motivo: a feature lia a tabela legada "budgetItens", congelada no orçamento
 * 160, e mantinha uma FK que bloqueava a remoção dessa tabela.
 */

import expensesRoutes from './routes/expensesRoutes.js';
app.use('/api/expenses', expensesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "sellerByOrdersRoutes"               ║
   ╚══════════════════════════════════════════════════════════╝ */
import sellerByOrdersRoutes from './routes/sellerByOrdersRoutes.js';
app.use('/api/orders/:orderId/sellers', sellerByOrdersRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "priceCommissionsRoutes"             ║
   ╚══════════════════════════════════════════════════════════╝ */
import priceCommissionsRoutes from './routes/priceCommissionsRoutes.js';
app.use('/api/price-commissions', priceCommissionsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "sellerByUserRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import sellerByUserRoutes from './routes/sellerByUserRoutes.js';
app.use('/api/seller-by-user', sellerByUserRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "orderDeliveryRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import orderDeliveryRoutes from './routes/ordersDeliveryRoutes.js';
app.use('/api/order-delivery', orderDeliveryRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "plano_acaoRoutes"                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import planoAcaoRoutes from './routes/plano_acaoRoutes.js';
app.use('/api/plano-acao', planoAcaoRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "customersIbgeRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import customersIbgeRoutes from './routes/customersIbgeRoutes.js';
app.use('/api/customers-ibge', customersIbgeRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 ROTA: "MÓDULO E-MAILS"                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import emailInboundsRoutes from './routes/emailInboundsRoutes.js';
app.use('/api/email', emailInboundsRoutes);

import emailOutboundsRoutes from './routes/emailOutboundsRoutes.js';
app.use('/api/email', emailOutboundsRoutes);

import emailSignaturesRoutes from './routes/emailSignaturesRoutes.js';
app.use('/api/email/signatures', emailSignaturesRoutes);

import emailAccountsRoutes from './routes/emailAccountsRoutes.js';
app.use('/api/email/accounts', emailAccountsRoutes);

import userEmailAccountsRoutes from './routes/userEmailAccountsRoutes.js';
app.use('/api/user-email-accounts', userEmailAccountsRoutes);


/* ╔══════════════════════════════════════════════════════════╗
   ║                   ROTA: "labelsRoutes"                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import labelsRoutes from './routes/labelsRoutes.js';
app.use('/api', labelsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               ROTA: "labelParametersRoutes"              ║
   ╚══════════════════════════════════════════════════════════╝ */
import labelParametersRoutes from './routes/labelParametersRoutes.js';
app.use(labelParametersRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║              ROTA: "emailInboxRoutes"                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import emailInboxRoutes from './routes/emailInboxRoutes.js';
app.use('/api/email', emailInboxRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                     ROTA: "locations"                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import locationsRoutes from './routes/locationsRoutes.js';
app.use('/api/locations', locationsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "sessionTimeOutConfigRoutes"            ║
   ╚══════════════════════════════════════════════════════════╝ */
import sessionCfgRoutes from './routes/sessionTimeOutConfigRoutes.js';
app.use(sessionCfgRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║        ROTA: "signaturesDeliveriesRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import signaturesDeliveriesRoutes from './routes/signaturesDeliveriesRoutes.js';
app.use(signaturesDeliveriesRoutes);

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║            ROTA: "nfeInboxRoutes" — Caixa de Entrada NFe         ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
import nfeInboxRoutes from './routes/nfeInboxRoutes.js';
import { initNfeInboxController } from './controllers/nfeInboxController.js';
import { startDfeScheduler } from './services/plugNotasDfeService.js';

// ... depois de configurar o app (express, middlewares etc.)
app.use(nfeInboxRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "plugnotasWebhookRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import plugnotasWebhookRoutes from './routes/plugnotasWebhookRoutes.js';
app.use(plugnotasWebhookRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "customerSegmentsRoutes"                ║
   ╚══════════════════════════════════════════════════════════╝ */
import customerSegmentsRoutes from './routes/customerSegmentsRoutes.js';
app.use('/api', customerSegmentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "customerSubSegmentsRoutes"             ║
   ╚══════════════════════════════════════════════════════════╝ */
import customerSubSegmentsRoutes from './routes/customerSubSegmentsRoutes.js';
app.use('/api/customer-subsegments', customerSubSegmentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "customerSubSegmentsRoutes"             ║
   ╚══════════════════════════════════════════════════════════╝ */
import supplierReturnsRoutes from './routes/supplierReturnsRoutes.js';
app.use('/api/supplier-returns', supplierReturnsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "budgetsShippingRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import budgetsShippingRoutes from './routes/budgetsShippingRoutes.js';
app.use('/api/budgets-shipping', budgetsShippingRoutes);

// ╔══════════════════════════════════════════════════════════════════╗
// ║ 🚦 Rotas — Customers (Clientes em inglês)                        ║
// ╚══════════════════════════════════════════════════════════════════╝
import customersRoutes from './routes/customersRoutes.js';
app.use('/api/customers', customersRoutes);;

// ╔══════════════════════════════════════════════════════════════════╗
// ║ 🚦 Rotas — nfeReceiptsRoutes                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import nfeReceiptsRoutes from './routes/nfeReceiptsRoutes.js';
app.use('/api/nfe-receipts', nfeReceiptsRoutes);

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Módulo: Caixa                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝
import cashMovimentsRoutes from './routes/cashMovimentsRoutes.js';
app.use('/api/caixa', cashMovimentsRoutes);

import cashCategoriesRoutes from './routes/cashCategoriesRoutes.js';
app.use('/api', cashCategoriesRoutes);

import cashSubcategoriesRoutes from './routes/cashSubcategoriesRoutes.js';
app.use('/api', cashSubcategoriesRoutes);

// ╔══════════════════════════════════════════════════════════════════╗
// ║  Rotas — OrdersLogisticsPackingRoutes                            ║
// ╚══════════════════════════════════════════════════════════════════╝
import ordersLogisticsPackingRoutes from './routes/OrdersLogisticsPackingRoutes.js';
app.use('/api/packing', ordersLogisticsPackingRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 Rotas: 'inboundInvoicesRoutes'           ║
   ╚══════════════════════════════════════════════════════════╝ */
import inboundInvoicesRoutes from './routes/inboundInvoicesRoutes.js';
app.use('/api/inbound-invoices', inboundInvoicesRoutes);

/* ╔══════════════════════════════════════════════════════════╗und
   ║                    Rotas: 'products'                     ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsRoutes from './routes/productsRoutes.js';
app.use('/api/products', productsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║             Rotas: 'productsFiscalBatchRoutes'           ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsFiscalBatchRoutes from './routes/productsFiscalBatchRoutes.js';
app.use('/api', productsFiscalBatchRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 Rotas: 'uploadCashRoutes'                ║
   ╚══════════════════════════════════════════════════════════╝ */
import {
   uploadRouter,
   cashAttachmentsRouter
} from './routes/uploadCashRoutes.js';

app.use('/api/upload', uploadRouter);
app.use('/api/caixa', cashAttachmentsRouter);

/* ╔══════════════════════════════════════════════════════════╗
   ║             Rotas: 'balancoPatrimonialRoutes'            ║
   ╚══════════════════════════════════════════════════════════╝ */
import balancoPatrimonialRoutes from './routes/balancoPatrimonialRoutes.js';
app.use(balancoPatrimonialRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 Rotas: 'produtosFiscalLote'              ║
   ╚══════════════════════════════════════════════════════════╝ */
import produtosFiscalLoteRoutes from "./routes/produtosFiscalLoteRoutes.js";
app.use("/", produtosFiscalLoteRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║        Rotas: 'productsLocations'                        ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsLocationsRoutes from './routes/productsLocationsRoutes.js';
app.use('/api', productsLocationsRoutes); // <-- necessário

/* ╔══════════════════════════════════════════════════════════╗
   ║                      Rotas: 'grades'                     ║
   ╚══════════════════════════════════════════════════════════╝ */
import gradesRoutes from './routes/gradesRoutes.js';
app.use(gradesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║         Rotas: 'groupsAndSubgroupsBatchRoutes'           ║
   ╚══════════════════════════════════════════════════════════╝ */
import groupsAndSubgroupsBatchRoutes from './routes/groupsAndSubgroupsBatchRoutes.js';
app.use('/api', groupsAndSubgroupsBatchRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                   Rotas: "productsGradesRoutes"          ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsGradesRoutes from './routes/productsGradesRoutes.js';
app.use(productsGradesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                      Rotas: prices                       ║
   ╚══════════════════════════════════════════════════════════╝ */
import pricesRoutes from './routes/pricesRoutes.js';
app.use('/api', pricesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 Rotas: productsPricesRoutes              ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsPricesRoutes from './routes/productsPricesRoutes.js';
app.use('/api', productsPricesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            Rotas: batchProductsPricesRoutes              ║
   ╚══════════════════════════════════════════════════════════╝ */
import batchProductsPricesRoutes from './routes/batchProductsPricesRoutes.js';
app.use('/api', batchProductsPricesRoutes);

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 📦 Products Units — Múltiplas Unidades por Produto                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
import productsUnitsRoutes from './routes/productsUnitsRoutes.js';
app.use('/api', productsUnitsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                Rotas: "unitsRoutes"                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import unitsRoutes from './routes/unitsRoutes.js';
app.use('/api', unitsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                Rotas: "pcpRoutes" (PCP / Produção)        ║
   ╚══════════════════════════════════════════════════════════╝ */
import pcpRoutes from './routes/pcpRoutes.js';
import { requireAuth as requireAuthPcp } from './middleware/authMiddleware.js';
app.use('/api/pcp', requireAuthPcp, pcpRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               Rotas: "cnpjPublicRoutes"                  ║
   ╚══════════════════════════════════════════════════════════╝ */
import cnpjPublicRoutes from './routes/cnpjPublicRoutes.js';
app.use('/api/public-cnpj', cnpjPublicRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               Rotas: "nfeXmlAntigasRoutes"               ║
   ╚══════════════════════════════════════════════════════════╝ */
import nfeXmlAntigasRoutes from './routes/nfeXmlAntigasRoutes.js';
app.use('/api/nfe-xml-antigas', nfeXmlAntigasRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║               Rotas: "sefazSearchRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import sefazSearchRoutes from './routes/sefazSearchRoutes.js';
app.use('/api/search/sefaz', sefazSearchRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                    Rotas: productsKey                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsKeyRoutes from './routes/productsKeyRoutes.js';
app.use('/api/products-key', productsKeyRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                 Rotas: "searchSefazRoutes"               ║
   ╚══════════════════════════════════════════════════════════╝ */
import searchSefazRoutes from './routes/searchSefazRoutes.js';
app.use('/api/search/sefaz', searchSefazRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ Rotas principais (importadas)                            ║
   ╚══════════════════════════════════════════════════════════╝ */
import budgetsRoutes from './routes/budgetsRoutes.js';
app.use(budgetsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "sellersRoutes"                                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import sellersRoutes from './routes/sellersRoutes.js';
app.use('/api', sellersRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "sellerForCustomerRoutes"                          ║
   ╚══════════════════════════════════════════════════════════╝ */
import sellerForCustomerRoutes from './routes/sellerForCustomerRoutes.js';
app.use('/api', sellerForCustomerRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "customersAttachmentsRoutes"                       ║
   ╚══════════════════════════════════════════════════════════╝ */
import customersAttachmentsRoutes from './routes/customersAttachmentsRoutes.js';
// 📎 Anexos do cliente (aba "Anexos" do customersEdit)
app.use('/api/customers', customersAttachmentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: GRUPOS                                             ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsGroupsRoutes from './routes/productsGroupsRoutes.js';
app.use('/api', productsGroupsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: customerStatusTypesRoutes                          ║
   ╚══════════════════════════════════════════════════════════╝ */
import customerStatusTypesRoutes from './routes/customerStatusTypesRoutes.js';
app.use('/api', customerStatusTypesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: customerStatusRoutes                               ║
   ╚══════════════════════════════════════════════════════════╝ */
import customerStatusRoutes from './routes/customerStatusRoutes.js';
app.use('/api', customerStatusRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: Ecommerce Orders                                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import ecommerceOrdersController from "./controllers/ecommerceOrdersController.js";
import ecommerceOrdersRoutes from "./routes/ecommerceOrdersRoutes.js";

// Uso das rotas
app.use("/api/ecommerce-orders", ecommerceOrdersRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: Webhook NFC-e                                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import plugnotasNfceWebhookRoutes from './routes/plugnotasNfceWebhookRoutes.js';
app.use('/api/webhooks/plugnotas', plugnotasNfceWebhookRoutes);

import deliveryRoutesRoutes from './routes/deliveryRoutesRoutes.js';
app.use('/api/deliveryRoutes', deliveryRoutesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: productFiscalCostRulesRoutes                       ║
   ╚══════════════════════════════════════════════════════════╝ */
import productFiscalCostRulesRoutes from './routes/productFiscalCostRulesRoutes.js';
app.use('/api/product-fiscal-cost-rules', productFiscalCostRulesRoutes);
/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: productsFiscalOriginsRoutes                        ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsFiscalOriginsRoutes from './routes/productsFiscalOriginsRoutes.js';
app.use('/api/products-fiscal-origins', productsFiscalOriginsRoutes);
/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "googleAdsCreateRoutes"                            ║
   ╚══════════════════════════════════════════════════════════╝ */
import googleAdsCreateRoutes from './routes/googleAdsCreateRoutes.js';
app.use('/api', googleAdsCreateRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "productsBatchGroupRoutes"                         ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsBatchGroupRoutes from './routes/productsBatchGroupRoutes.js';
app.use('/api/products-batch-group', productsBatchGroupRoutes);

/* ╔════════════════════════════════════════════════════════════════════════════════════════╗
   ║ ROTA: "app.use('/api/products-batch-manufacturer', productsBatchManufacturerRoutes);   ║
   ╚════════════════════════════════════════════════════════════════════════════════════════╝ */
import productsBatchManufacturerRoutes from './routes/productsBatchManufacturerRoutes.js';
app.use('/api/products-batch-manufacturer', productsBatchManufacturerRoutes);

/* ╔═══════════════════════════════════════════════════════════╗
   ║ ROTA:  paymentFormRoutes                                  ║
   ╚═══════════════════════════════════════════════════════════╝ */
import paymentFormsRoutes from './routes/paymentFormsRoutes.js';
app.use('/api/paymentForms', paymentFormsRoutes);

/* ╔═══════════════════════════════════════════════════════════╗
   ║ ROTA:  pdvSalesReportRoutes                               ║
   ╚═══════════════════════════════════════════════════════════╝ */
import pdvSalesReportRoutes from './routes/pdvSalesReportRoutes.js';
app.use('/api/reports/pdv-sales', pdvSalesReportRoutes);

/* ╔═══════════════════════════════════════════════════════════╗
   ║ ROTA:  productBarCodeSecondRoutes                         ║
   ╚═══════════════════════════════════════════════════════════╝ */
import productBarCodeSecondRoutes from './routes/productBarCodeSecondRoutes.js';
app.use('/api/product-barcode-second', productBarCodeSecondRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "productsBatchSupplierRoutes"                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsBatchSupplierRoutes from './routes/productsBatchSupplierRoutes.js';
app.use('/api/products-batch-supplier', productsBatchSupplierRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            ROTA: "ordersBillingRoutes"                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import ordersBillingRoutes from './routes/ordersBillingRoutes.js';
import { initOrdersBillingController } from './controllers/ordersBillingController.js';

app.use(ordersBillingRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "nfeWebhookEventsRoutes"                           ║
   ╚══════════════════════════════════════════════════════════╝ */
import nfeWebhookEventsRoutes from './routes/nfeWebhookEventsRoutes.js';
app.use('/api/nfe', nfeWebhookEventsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "nfeCceRoutes"                                     ║
   ╚══════════════════════════════════════════════════════════╝ */
import nfeCceRoutes from './routes/nfeCceRoutes.js';
app.use('/api/nfe', nfeCceRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "debtPaymentsRoutes"                               ║
   ╚══════════════════════════════════════════════════════════╝ */
import debtPaymentsRoutes from './routes/debtPaymentsRoutes.js';
app.use('/api', debtPaymentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "reportsProductsStockRoutes"                       ║
   ╚══════════════════════════════════════════════════════════╝ */
import reportsProductsStockRoutes from './routes/reportsProductsStockRoutes.js';
app.use('/api', reportsProductsStockRoutes);

import productsNotesRoutes from './routes/productsNotesRoutes.js';
app.use('/api/products-notes', productsNotesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "reportsProductsStockRoutes"                       ║
   ╚══════════════════════════════════════════════════════════╝ */
import promoImagesRoutes from './routes/promoImagesRoutes.js';
app.use('/api/promo-images', promoImagesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "googleAdsRoutes"                                  ║
   ╚══════════════════════════════════════════════════════════╝ */
import googleAdsRoutes from './routes/googleAdsRoutes.js';
app.use('/api/googleads', googleAdsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "locationsBarCodeRoutes                            
   ╚══════════════════════════════════════════════════════════╝ */
import locationsBarCodeRoutes from './routes/locationsBarCodeRoutes.js';
app.use('/api/locations-barcode', locationsBarCodeRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "productsImagensRoutes"                            ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsImagensRoutes from './routes/productsImagensRoutes.js';
app.use('/api/products-imagens', productsImagensRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "deliveryRouteStopsRoutes"                         ║
   ╚══════════════════════════════════════════════════════════╝ */
import deliveryRouteStopsRoutes from './routes/deliveryRouteStopsRoutes.js';
app.use('/api/deliveryRouteStops', deliveryRouteStopsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "budgetsPaymentInstallmentsRoutes"                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import budgetsPaymentInstallmentsRoutes from './routes/budgetsPaymentInstallmentsRoutes.js';
app.use('/api/budgets-payment-installments', budgetsPaymentInstallmentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "budgetsPaymentsRoutes"                            ║
   ╚══════════════════════════════════════════════════════════╝ */
import budgetsPaymentsRoutes from './routes/budgetsPaymentsRoutes.js';
app.use('/api/budgets-payments', budgetsPaymentsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "nfeInutilizarEventsRoute"                         ║
   ╚══════════════════════════════════════════════════════════╝ */
import nfeInutilizarEventsRoutes from './routes/nfeInutilizarEventsRoutes.js';
app.use('/api/nfes', nfeInutilizarEventsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "debtsRoutes"                                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import debtsRoutes from './routes/debtsRoutes.js';
app.use('/api', debtsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
 * ║ ROTA: "chartOfAccountsRoutes"                            ║
 * ╚══════════════════════════════════════════════════════════╝ */
import chartOfAccountsRoutes from './routes/chartOfAccountsRoutes.js';
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
 * ║ ROTA: "deliveryTripsRoutes" (Entregas / Motoristas)      ║
 * ╚══════════════════════════════════════════════════════════╝ */
import deliveryTripsRoutes from './routes/deliveryTripsRoutes.js';
app.use('/api/delivery-trips', deliveryTripsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
 * ║ ROTA: "inboundAutoImportRoutes"                         ║
 * ╚══════════════════════════════════════════════════════════╝ */
import inboundAutoImportRoutes from './routes/inboundAutoImportRoutes.js';
app.use(inboundAutoImportRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "dashBoardAlertsRoutes"                           ║
   ╚══════════════════════════════════════════════════════════╝ */
import dashBoardAlertsRoutes from './routes/dashBoardAlertsRoutes.js';
app.use(dashBoardAlertsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "productsStock"                                    ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsStockRoutes from './routes/productsStockRoutes.js';
app.use('/api/productsStock', productsStockRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "productsKitsRoutes"                               ║
   ╚══════════════════════════════════════════════════════════╝ */
import productsKitsRoutes from './routes/productsKitsRoutes.js';
app.use('/api/products-kits', productsKitsRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — Subgrupos de Produtos (CONSART ERP)                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import productsSubgroupsRoutes from './routes/productsSubgroupsRoutes.js';
app.use('/api', productsSubgroupsRoutes);

// Layout de tabelas por usuário (colunas visíveis, largura, alinhamento)
import userTablePreferencesRoutes from './routes/userTablePreferencesRoutes.js';
app.use('/api/user-table-preferences', userTablePreferencesRoutes);

import processesRoutes from './routes/processesRoutes.js';
app.use('/api/processes', processesRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "suppliers"                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import suppliersRoutes from './routes/suppliersRoutes.js';
app.use('/api', suppliersRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "productsManufacturersRoutes"                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import productsManufacturersRoutes from './routes/productsManufacturersRoutes.js';
app.use('/api', productsManufacturersRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "productsSuppliersRoutes"                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import productsSuppliersRoutes from './routes/productsSuppliersRoutes.js';
app.use('/api', productsSuppliersRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "manufacturersRoutes"                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import manufacturersRoutes from './routes/manufacturersRoutes.js';
// Rotas API
app.use('/api', manufacturersRoutes);

import crmDealsOutcomesRoutes from './routes/crmDealsOutcomesRoutes.js';
app.use('/api', crmDealsOutcomesRoutes);

// customersSegmentsBatch
import customersSegmentsBatchRoutes from './routes/customersSegmentsBatchRoutes.js';
app.use('/api/customers/segments', customersSegmentsBatchRoutes);

/* CRM Performance */
import crmDealsPerformanceRoutes from './routes/crmDealsPerformanceRoutes.js';
app.use('/api/crm/reativacao', requireAuthCrm, crmDealsPerformanceRoutes);

import crmLossReasonsRoutes from './routes/crmLossReasonsRoutes.js';
app.use('/api/crm-loss-reasons', crmLossReasonsRoutes);

import crmDealsStagesRoutes from './routes/crmDealsStagesRoutes.js';
app.use('/api/crm/stages', crmDealsStagesRoutes);

/* CRM Deals */
import crmDealsRoutes from './routes/crmDealsRoutes.js';
app.use('/api/crm', requireAuthCrm, crmDealsRoutes);

import salesTaxRoutes from './routes/salesTaxCalculationRoutes.js';
app.use('/api', salesTaxRoutes);

import fiscalApuracaoRoutes from './routes/fiscalApuracaoRoutes.js';
app.use('/api', fiscalApuracaoRoutes);

// ╔══════════════════════════════════════════════════════════╗
// ║                 APP FEATURES                            ║
// ╚══════════════════════════════════════════════════════════╝
import appFeaturesRoutes from './routes/appFeaturesRoutes.js';
import { configureAppFeaturesDb } from './repositories/appFeatures/appFeatures.index.js';

configureAppFeaturesDb(pool);
app.use('/api/app-features', appFeaturesRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "ordersNfeAttemptsRoutes"                          ║
   ╚══════════════════════════════════════════════════════════╝ */
import ordersNfeAttemptsRoutes from './routes/ordersNfeAttemptsRoutes.js';
app.use('/api/orders-nfe-attempts', ordersNfeAttemptsRoutes);


/* ╔══════════════════════════════════════════════════════════╗
   ║ ROTA: "budgetsNfeAttemptsRoutes"                          ║
   ╚══════════════════════════════════════════════════════════╝ */
import budgetsNfeAttemptsRoutes from './routes/budgetsNfeAttemptsRoutes.js';
app.use('/api/budgets-nfe-attempts', budgetsNfeAttemptsRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                      API — "customerActivityRoutes"                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import customerActivityRoutes from './routes/customerActivityRoutes.js';
app.use('/api/customer-activity', customerActivityRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                     API — "customerTrainingsRoutes"                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import customerTrainingsRoutes from './routes/customerTrainingsRoutes.js';
app.use('/api/customer-trainings', customerTrainingsRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                        API — "crmConsartReativacao"                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import crmConsartReativacaoRoutes from "./routes/crmConsartRoutes.js";
app.use('/api', crmConsartReativacaoRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                        API — "salesReportRoutes"                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import salesReportRoutes from './routes/salesReportRoutes.js';
app.use('/api/reports', salesReportRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                        API — "ordersKanbanRoutes"                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import ordersKanbanRoutes from './routes/ordersKanbanRoutes.js';
app.use('/api/orders-kanban', ordersKanbanRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                        API — "moduleSystemRoutes"                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import moduleSystemRoutes from './routes/moduleSystemRoutes.js';
app.use('/api/module-system', moduleSystemRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                         API — "userModulesRoutes"                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import userModulesRoutes from './routes/userModulesRoutes.js';
// registra com hífen (padrão recomendado)
app.use('/api/user-modules', userModulesRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                        API — "usersProfileRoutes"                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import usersProfileRoutes from './routes/usersProfileRoutes.js';
app.use('/api/users-profile', usersProfileRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                       API — "accessProfilesRoutes"                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import accessProfilesRoutes from './routes/accessProfilesRoutes.js';
app.use('/api/access-profiles', accessProfilesRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                          API — "usersRoutes"                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import usersRoutes from './routes/usersRoutes.js';
app.use('/api/users', usersRoutes);

import painelNotasFiscaisRoutes from "./routes/painelNotasFiscaisRoutes.js";
app.use("/api", painelNotasFiscaisRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "paymentMethodsRoutes"                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import paymentMethodsRoutes from './routes/paymentMethodsRoutes.js';

app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/paymentMethods', paymentMethodsRoutes); // opcional compatibilidade

import contabilizadorConsartCrmRoutes from "./routes/contabilizadorConsartCrmRoutes.js";
app.use("/api/contabilizador-crm", contabilizadorConsartCrmRoutes);

import gestaoVendasRoutes from "./routes/gestaoVendasRoutes.js";
app.use("/api/gestao-vendas", gestaoVendasRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "accountsPayableRoutes"                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import accountsPayableRoutes from './routes/accountsPayableRoutes.js';
app.use('/api', accountsPayableRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "entradasFiscaisRoutes"                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import entradasFiscaisRoutes from './routes/entradasFiscaisRoutes.js';
app.use('/api/entradas', entradasFiscaisRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "inventoryRoutes"                                                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import inventoryRoutes from './routes/inventoryRoutes.js';
app.use('/api/inventories', inventoryRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "productsActiveBatchRoutes"                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import productsActiveBatchRoutes from './routes/productsActiveBatchRoutes.js';
app.use('/api', productsActiveBatchRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "empresaFiscalRoutes"                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import empresaFiscalRoutes from './routes/empresaFiscalRoutes.js';
app.use('/api/empresa-fiscal', empresaFiscalRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "accountsReceivableRoutes"                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import accountsReceivableRoutes from './routes/accountsReceivableRoutes.js';
app.use('/api/accounts-receivable', accountsReceivableRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "productsDescriptionsRoutes"                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import productsDescriptionsRoutes from './routes/productsDescriptionsRoutes.js';
app.use('/api', productsDescriptionsRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "asaasRoutes"                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import asaasRoutes from './routes/asaasRoutes.js';
app.use('/api/integracoes/asaas', asaasRoutes);

import dashBoardRoutes from './routes/dashBoardRoutes.js';
app.use('/api/dashboard', dashBoardRoutes);

import ordersRoutes from './routes/ordersRoutes.js';
app.use('/api/orders', ordersRoutes);

import databaseRoutes from './routes/databaseRoutes.js';
app.use('/api/database', databaseRoutes);

import salesCommissionsFromInvoicesRoutes from './routes/salesCommissionsFromInvoicesRoutes.js';
app.use('/api/sales-commissions-from-invoices', salesCommissionsFromInvoicesRoutes);

import ordersPaymentsRoutes from './routes/ordersPaymentsRoutes.js';
app.use('/api/orders-payments', ordersPaymentsRoutes);

import betterDateToBuyRoutes
   from './routes/betterDateToBuyRoutes.js';

app.use(
   '/api/betterDateToBuy',
   betterDateToBuyRoutes
);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "usoConsumoRoutes"                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import usoConsumoRoutes from './routes/usoConsumoRoutes.js';
app.use('/api/uso-consumo', usoConsumoRoutes);

import customersInvoicesRoutes from './routes/customersInvoicesRoutes.js';
app.use('/api', customersInvoicesRoutes);

import crmDealsBatchRoutes from './routes/batchCrmDealsRoutes.js';
app.use('/api/crm-deals/batch', crmDealsBatchRoutes);

import deliveryLabelsRoutes from './routes/deliveryLabelsRoutes.js';
app.use('/api/delivery-labels', deliveryLabelsRoutes);

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ API — "invoicesIssuedRoutes" — Notas Fiscais Emitidas                   ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import invoicesIssuedRoutes from './routes/invoicesIssuedRoutes.js';
import { initInvoicesIssuedController } from './controllers/invoicesIssuedController.js';

app.use('/api/invoices-issued', invoicesIssuedRoutes);

import nfeRoutes from './routes/nfeRoutes.js';
app.use('/api', nfeRoutes);

import transportersRoutes from './routes/transportersRoutes.js';
app.use('/api/transporters', transportersRoutes);

/* Employees */
import employeesRoutes from './routes/employeesRoutes.js';
app.use('/api', employeesRoutes);

import parametrosFiscaisRoutes from './routes/parametrosFiscaisRoutes.js';
app.use("/api/paramfiscais", parametrosFiscaisRoutes);

import salesPerformanceRoutes from './routes/salesPerformanceRoutes.js';
app.use('/api/sales-performance', salesPerformanceRoutes);

import spedFiscalRoutes from './routes/spedFiscalRoutes.js';
app.use('/api/sped-fiscal', spedFiscalRoutes);
app.use('/public/spedFiscal', express.static(path.join(__dirname, 'public', 'spedFiscal')));

import enterpriseRoutes from './routes/enterpriseRoutes.js';
app.use('/api/enterprises', enterpriseRoutes);

import enterpriseLogoRoutes from './routes/enterpriseLogoRoutes.js';
app.use('/api/enterprises', enterpriseLogoRoutes);

import labelPrintConfigRoutes from './routes/labelPrintConfigRoutes.js';
app.use('/api/label-print-config', labelPrintConfigRoutes);

/* ╔═══════════════════════════════════════════════════════════╗
   ║                   "shortCutsProgramation"                 ║
   ╚═══════════════════════════════════════════════════════════╝ */
import shortCutsProgramationRoutes from './routes/shortCutsProgramationRoutes.js';
app.use('/api/shortcuts-programation', shortCutsProgramationRoutes);

/* ╔═══════════════════════════════════════════════════════════╗
   ║                      "taskGroups"                         ║
   ╚═══════════════════════════════════════════════════════════╝ */
import taskGroupsRoutes from './routes/taskGroupsRoutes.js';
app.use('/api/task-groups', taskGroupsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                          DEBUGS                          ║
   ╚══════════════════════════════════════════════════════════╝ */
import debugEnv from './routes/debugEnvRoutes.js';
app.use('/api', debugEnv);

/* ╔══════════════════════════════════════════════════════════╗
   ║                  nfesDiagnosticsRoutes                   ║
   ╚══════════════════════════════════════════════════════════╝ */
import nfesDiagnosticsRoutes from './routes/nfesDiagnosticsRoutes.js';
app.use('/api/nfes', nfesDiagnosticsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║                   "AuditLogsRoutes"                      ║
   ╚══════════════════════════════════════════════════════════╝ */
import auditLogsRoutes from './routes/auditLogsRoutes.js';
app.use('/api/audit-logs', auditLogsRoutes);

/* ╔══════════════════════════════════════════════════════════╗
   ║            Rotas estáticas centralizadas                 ║
   ╚══════════════════════════════════════════════════════════╝ */
import staticRoutes from "./routes/staticRoutes.js";
app.use(staticRoutes);

// Uploads
import uploadRoutes from "./routes/uploadRoutes.js";
app.use("/api/upload", uploadRoutes);

// Raiz → home
app.get("/", (_req, res) => res.redirect("/home/home.html"));

/* ╔══════════════════════════════════════════════════════════╗
   ║ Teste de certificado A1 via GCS                          ║
   ╚══════════════════════════════════════════════════════════╝ */
app.get('/api/certificado/teste', async (_req, res) => {
   try {
      const bucket = process.env.NFE_CERT_BUCKET;
      const object = process.env.NFE_CERT_OBJECT;
      const pass = process.env.NFE_CERT_PFX_PASS;

      if (!bucket || !object || !pass) {
         return res.status(400).json({ ok: false, erro: 'Env faltando (NFE_CERT_BUCKET/NFE_CERT_OBJECT/NFE_CERT_PFX_PASS)' });
      }

      const file = storage.bucket(bucket).file(object);
      const [exists] = await file.exists();
      if (!exists) {
         return res.status(404).json({ ok: false, erro: `Objeto não encontrado no GCS: gs://${bucket}/${object}` });
      }

      const [pfxBuffer] = await file.download();
      const agent = new https.Agent({
         pfx: pfxBuffer,
         passphrase: pass,
         rejectUnauthorized: false,
      });

      return res.json({ ok: true, bucket, object, tamanho: pfxBuffer.length, agentOk: !!agent });
   } catch (err) {
      error("CERT_TEST_ERROR", { err: { message: err.message, stack: err.stack } });
      return res.status(500).json({ ok: false, erro: err.message });
   }
});

/* ╔══════════════════════════════════════════════════════════╗
   ║ Handlers 404 & erros                                     ║
   ╚══════════════════════════════════════════════════════════╝ */
app.use((req, res) => {
   res.status(404).json({
      ok: false,
      error: "Not Found",
      path: req.originalUrl || req.url,
      requestId: getCtx().requestId || req.id
   });
});

app.use((err, req, res, _next) => {
   const status = Number(err?.status || err?.statusCode || 500);

   error("HTTP_ERROR", {
      status,
      err: {
         message: err?.message,
         code: err?.code,
         detail: err?.detail,
         schema: err?.schema,
         table: err?.table,
         column: err?.column,
         position: err?.position,
         where: err?.where,
         sql: err?.sql,
         values: err?.values,
         at: err?.at,
         stack: err?.stack
      }
   });

   if (res.headersSent) return;

   res.status(status).json({
      ok: false,
      erro: err?.publicMessage || err?.message || "Erro interno",
      status,
      requestId: getCtx().requestId || req.id,
      ...(process.env.NFE_DEBUG === "1"
         ? { hint: "Veja logs estruturados (PG_ERROR/HTTP_ERROR) no Cloud Run" }
         : {}),
   });
});

// ╔══════════════════════════════════════════════════════════╗
// ║ 🚀 BOOTSTRAP FINAL — CLOUD RUN SAFE                      ║
// ╚══════════════════════════════════════════════════════════╝
let server = null;
let isShuttingDown = false;
let dfeSchedulerStarted = false;

async function runStartupJobs() {
   console.log("[boot] Inicializando módulos assíncronos...");

   const jobs = [
      { name: "initNfeInboxController", fn: () => initNfeInboxController() },
      { name: "initEcommerceOrdersController", fn: () => ecommerceOrdersController.initEcommerceOrdersController() },
      { name: "initOrdersBillingController", fn: () => initOrdersBillingController() },
   ];

   for (const job of jobs) {
      try {
         await job.fn();
         info("BOOT_JOB_OK", { job: job.name });
      } catch (err) {
         error("BOOT_JOB_ERROR", {
            job: job.name,
            err: { message: err?.message, stack: err?.stack }
         });
      }
   }

   // 🔴 FIX: só inicia se permitido
   if (!dfeSchedulerStarted && process.env.ENABLE_DFE_SCHEDULER === "true") {
      try {
         startDfeScheduler({ intervalMs: 60 * 1000 });
         dfeSchedulerStarted = true;
         info("DFE_SCHEDULER_STARTED", { intervalMs: 60000 });
      } catch (err) {
         error("DFE_SCHEDULER_INIT_ERROR", {
            err: { message: err?.message, stack: err?.stack }
         });
      }
   }

   if (process.env.ENABLE_EMAIL_INBOUND === "true") {
      try {
         emailInboundsBootstrap().catch(err => {
            error("EMAIL_BOOTSTRAP_ERROR", {
               err: { message: err?.message, stack: err?.stack }
            });
         });
      } catch (err) {
         error("EMAIL_BOOTSTRAP_SYNC_ERROR", {
            err: { message: err?.message, stack: err?.stack }
         });
      }
   }
}

// 🔧 FORA da função (isso resolve o erro)
async function startServer() {
   console.log("[boot] NODE_OPTIONS=", process.env.NODE_OPTIONS || "(unset)");
   console.log("[boot] heap_limit_MiB=", Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024));
   console.log("[boot] PORT=", PORT);
   console.log("[boot] NODE_ENV=", process.env.NODE_ENV || "(unset)");
   console.log("[boot] DB_HOST=", process.env.DB_HOST || "(DATABASE_URL ou unset)");
   console.log("[boot] DB_NAME=", process.env.DB_NAME || "(DATABASE_URL ou unset)");

   server = app.listen(PORT, () => {
      console.log(`✅ Web & API rodando na porta ${PORT}`);
   });

   server.on("error", async (err) => {
      await error("SERVER_LISTEN_ERROR", {
         err: { message: err?.message, code: err?.code, stack: err?.stack }
      });
      process.exit(1);
   });

   runStartupJobs().catch(err => {
      error("BOOT_ASYNC_ERROR", {
         err: { message: err?.message, stack: err?.stack }
      });
   });
}

async function shutdown(sig) {
   if (isShuttingDown) return;
   isShuttingDown = true;

   console.log(`\n↘️ Recebido ${sig}. Encerrando com graça...`);

   const forceExit = setTimeout(() => {
      console.error("⏱️ Shutdown excedeu 10s. Forçando saída.");
      process.exit(1);
   }, 10000);
   forceExit.unref();

   try {
      if (server) {
         await new Promise((resolve) => server.close(resolve));
      }
   } catch (err) {
      error("SERVER_CLOSE_ERROR", {
         err: { message: err?.message, stack: err?.stack }
      });
   }

   try {
      await pool.end();
      console.log("✅ Pool PostgreSQL encerrado.");
   } catch (err) {
      error("PG_POOL_END_ERROR", {
         err: { message: err?.message, stack: err?.stack }
      });
   }

   console.log("🔚 Servidor fechado.");
   process.exit(0);
}

// Signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Start
startServer().catch(err => {
   console.error("❌ ERRO FATAL NO START:", err);
   sendErrorEmail("FATAL_START_ERROR", {
      err: { message: err?.message, code: err?.code, stack: err?.stack }
   }).finally(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
   const err = reason instanceof Error ? reason : new Error(String(reason));
   error("UNHANDLED_REJECTION", {
      err: { message: err.message, code: err.code, stack: err.stack }
   });
});

process.on("uncaughtException", async (err) => {
   console.error("❌ UNCAUGHT EXCEPTION:", err);
   await sendErrorEmail("UNCAUGHT_EXCEPTION", {
      err: { message: err?.message, code: err?.code, stack: err?.stack }
   });
   process.exit(1);
});
