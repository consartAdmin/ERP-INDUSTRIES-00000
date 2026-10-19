// ╔══════════════════════════════════════════════════════════════════════╗
// ║ errorEmailReporter.js — Monitor de Erros por E-mail                 ║
// ║ CONSART ERP | Node.js ESM | Nodemailer                              ║
// ║ ✅ Envio automático de erros para contato@consart.com.br            ║
// ║ ✅ Proteção contra mensagens duplicadas                             ║
// ║ ✅ Ocultação automática de senhas, tokens e dados sensíveis         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import nodemailer from "nodemailer";

const DEFAULT_RECIPIENT = "contato@consart.com.br";
const recentErrors = new Map();

let transporter = null;
let configurationWarningShown = false;

/* ──────────────────────────────────────────────────────────────
 * Variáveis de ambiente
 * ────────────────────────────────────────────────────────────── */

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function enabled() {
  return env("ERROR_EMAIL_ENABLED", "false").toLowerCase() === "true";
}

/* ──────────────────────────────────────────────────────────────
 * Configuração do Nodemailer
 * ────────────────────────────────────────────────────────────── */

function getTransporter() {
  if (transporter) return transporter;

  const host = env("ERROR_EMAIL_SMTP_HOST");
  const port = Number(env("ERROR_EMAIL_SMTP_PORT", "587"));
  const user = env("ERROR_EMAIL_SMTP_USER");
  const pass = env("ERROR_EMAIL_SMTP_PASS");

  if (!host || !user || !pass || !Number.isFinite(port)) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure:
      env(
        "ERROR_EMAIL_SMTP_SECURE",
        port === 465 ? "true" : "false",
      ).toLowerCase() === "true",

    auth: {
      user,
      pass,
    },

    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return transporter;
}

/* ──────────────────────────────────────────────────────────────
 * Proteção e serialização dos dados
 * ────────────────────────────────────────────────────────────── */

function safeJson(value) {
  try {
    return JSON.stringify(
      value,
      (key, item) => {
        const sensitiveField =
          /password|passwd|secret|token|authorization|cookie|smtp_pass/i.test(
            key,
          );

        if (sensitiveField) {
          return "[REDACTED]";
        }

        if (typeof item === "bigint") {
          return item.toString();
        }

        if (typeof item === "string" && item.length > 12_000) {
          return `${item.slice(0, 12_000)}…`;
        }

        return item;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ──────────────────────────────────────────────────────────────
 * Controle de mensagens duplicadas
 * ────────────────────────────────────────────────────────────── */

function cleanupDedup(now) {
  for (const [key, expiresAt] of recentErrors) {
    if (expiresAt <= now) {
      recentErrors.delete(key);
    }
  }
}

function shouldSend(eventName, details) {
  const status = Number(details?.status || 0);
  const minStatus = Number(env("ERROR_EMAIL_MIN_STATUS", "500"));

  if (status > 0 && status < minStatus) {
    return false;
  }

  const now = Date.now();

  const dedupSeconds = Number(
    env("ERROR_EMAIL_DEDUP_SECONDS", "300"),
  );

  const windowMs = Math.max(0, dedupSeconds * 1000);

  cleanupDedup(now);

  const message =
    details?.err?.message ||
    details?.message ||
    eventName ||
    "unknown";

  const code =
    details?.err?.code ||
    details?.code ||
    "";

  const key = `${code}|${message}`;

  if (recentErrors.get(key) > now) {
    return false;
  }

  recentErrors.set(key, now + windowMs);

  return true;
}

/* ──────────────────────────────────────────────────────────────
 * Envio do alerta de erro
 * ────────────────────────────────────────────────────────────── */

export async function sendErrorEmail(eventName, details = {}) {
  if (!enabled() || !shouldSend(eventName, details)) {
    return {
      sent: false,
    };
  }

  const mailer = getTransporter();

  if (!mailer) {
    if (!configurationWarningShown) {
      configurationWarningShown = true;

      console.warn(
        "[ERROR_EMAIL] Desativado: configure " +
          "ERROR_EMAIL_SMTP_HOST, ERROR_EMAIL_SMTP_USER " +
          "e ERROR_EMAIL_SMTP_PASS.",
      );
    }

    return {
      sent: false,
    };
  }

  const appName = env(
    "ERROR_EMAIL_APP_NAME",
    "CONSART ERP",
  );

  const environment = env(
    "NODE_ENV",
    "development",
  );

  const recipient = env(
    "ERROR_EMAIL_TO",
    DEFAULT_RECIPIENT,
  );

  const sender = env(
    "ERROR_EMAIL_FROM",
    env("ERROR_EMAIL_SMTP_USER"),
  );

  const timestamp = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const message =
    details?.err?.message ||
    details?.message ||
    eventName;

  const payload = safeJson(details);

  const subject =
    `[${appName}] ${eventName}: ` +
    String(message).slice(0, 100);

  try {
    await mailer.sendMail({
      from: sender,
      to: recipient,
      subject,

      text:
        `${appName}\n` +
        `Ambiente: ${environment}\n` +
        `Data: ${timestamp}\n` +
        `Evento: ${eventName}\n\n` +
        payload,

      html: `
        <h2>${escapeHtml(appName)} — erro detectado</h2>

        <p>
          <strong>Ambiente:</strong>
          ${escapeHtml(environment)}
        </p>

        <p>
          <strong>Data:</strong>
          ${escapeHtml(timestamp)}
        </p>

        <p>
          <strong>Evento:</strong>
          ${escapeHtml(eventName)}
        </p>

        <p>
          <strong>Mensagem:</strong>
          ${escapeHtml(message)}
        </p>

        <pre
          style="
            white-space: pre-wrap;
            background: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
          "
        >${escapeHtml(payload)}</pre>
      `,
    });

    return {
      sent: true,
    };
  } catch (err) {
    console.error(
      "[ERROR_EMAIL] Falha ao enviar alerta:",
      err?.message || err,
    );

    return {
      sent: false,
      error: err,
    };
  }
}

/* ──────────────────────────────────────────────────────────────
 * Envio assíncrono sem bloquear a operação principal
 * ────────────────────────────────────────────────────────────── */

export function queueErrorEmail(eventName, details = {}) {
  return sendErrorEmail(eventName, details);
}