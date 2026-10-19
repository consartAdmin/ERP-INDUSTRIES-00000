// ╔═════════════════════════════════════════════════════════════════════╗
// ║ customerTrainingsController.js — Treinamentos de Clientes          ║
// ║ CRUD + conclusão (histórico do cliente) + PDF + envio de e-mail     ║
// ╚═════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import trainingsApi from '../repositories/customerTrainings/customerTrainings.index.js';
import {
  buildTrainingEmail,
  defaultEmailKind,
  EMAIL_KINDS,
} from '../repositories/customerTrainings/customerTrainings.email.js';
import {
  createCustomerActivityIfMissing,
  registerCustomerFollowup,
} from '../repositories/customerActivity/customerActivity.index.js';
import generateCustomerTrainingPdf from '../generationPdf/generationCustomerTrainingPdf.js';
import { sendMailByAccount } from '../services/email/sendMailByAccount.js';

const NOT_FOUND = 'Treinamento não encontrado.';

function sendError(res, error) {
  console.error('[customerTrainingsController]', error);

  return res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Erro interno no servidor.',
  });
}

const userIdOf = (req) => req.user?.user_id ?? req.user?.id ?? null;

function pdfFileName(training) {
  const slug = String(training.customer_trade_name || training.customer_legal_name || 'cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `treinamento-${training.training_id}-${slug || 'cliente'}.pdf`;
}

// Registra o treinamento no acompanhamento do cliente (não bloqueia a conclusão)
async function registerCustomerHistory(training) {
  try {
    await createCustomerActivityIfMissing(training.customer_id);
    await registerCustomerFollowup(training.customer_id, {
      followup_type: 'training',
      source_module: 'customerTrainings',
      source_reference_id: training.training_id,
    });
  } catch (error) {
    console.warn('[customerTrainingsController] Falha ao registrar histórico do cliente:', error.message);
  }
}

export async function ensure(req, res) {
  try {
    await trainingsApi.ensureTable();
    return res.json({ ok: true });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function list(req, res) {
  try {
    const result = await trainingsApi.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getById(req, res) {
  try {
    const row = await trainingsApi.getById(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: NOT_FOUND });
    return res.json({ ok: true, row });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function create(req, res) {
  try {
    const row = await trainingsApi.create(req.body, userIdOf(req));
    return res.status(201).json({ ok: true, row });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function update(req, res) {
  try {
    const row = await trainingsApi.update(req.params.id, req.body, userIdOf(req));
    return res.json({ ok: true, row });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function complete(req, res) {
  try {
    const before = await trainingsApi.getById(req.params.id);
    const row = await trainingsApi.complete(req.params.id, req.body, userIdOf(req));

    // Só conta no histórico na primeira conclusão (editar notas depois não soma follow-up)
    if (before?.status !== 'done') await registerCustomerHistory(row);

    return res.json({ ok: true, row });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function remove(req, res) {
  try {
    const row = await trainingsApi.remove(req.params.id, userIdOf(req));
    if (!row) return res.status(404).json({ ok: false, error: NOT_FOUND });
    return res.json({ ok: true, row });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function pdf(req, res) {
  try {
    const training = await trainingsApi.getById(req.params.id);
    if (!training) return res.status(404).json({ ok: false, error: NOT_FOUND });

    const buffer = await generateCustomerTrainingPdf(training);
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${pdfFileName(training)}"`);
    return res.send(buffer);
  } catch (error) {
    return sendError(res, error);
  }
}

// body: { kind?, to?: string | string[], message?, attach_pdf?, account_id? }
export async function sendEmail(req, res) {
  try {
    const training = await trainingsApi.getById(req.params.id);
    if (!training) return res.status(404).json({ ok: false, error: NOT_FOUND });

    const kind = EMAIL_KINDS.includes(req.body?.kind) ? req.body.kind : defaultEmailKind(training.status);

    const requested = Array.isArray(req.body?.to)
      ? req.body.to
      : String(req.body?.to || '').split(/[;,]/);
    const fallback = training.attendees.map((a) => a.email);
    const to = [...new Set((requested.some((e) => String(e).trim()) ? requested : fallback)
      .map((e) => String(e || '').trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];

    if (!to.length) {
      return res.status(400).json({
        ok: false,
        error: 'Nenhum e-mail válido. Informe os destinatários ou cadastre o e-mail dos participantes.',
      });
    }

    const { subject, html, text } = buildTrainingEmail(training, { kind, message: req.body?.message });

    const attachPdf = req.body?.attach_pdf ?? kind === 'report';
    const attachments = attachPdf
      ? [{
        filename: pdfFileName(training),
        content: await generateCustomerTrainingPdf(training),
        contentType: 'application/pdf',
      }]
      : [];

    const accountId = Number(req.body?.account_id || process.env.DEFAULT_EMAIL_ACCOUNT_ID || 1);

    const info = await sendMailByAccount(
      { account_id: accountId, to: to.join(', '), subject, text, html, attachments },
      { pgPool: pool }
    );

    await trainingsApi.markEmailSent(training.training_id);

    return res.json({ ok: true, to, kind, messageId: info?.messageId || null });
  } catch (error) {
    return sendError(res, error);
  }
}

export default {
  ensure,
  list,
  getById,
  create,
  update,
  complete,
  remove,
  pdf,
  sendEmail,
};
