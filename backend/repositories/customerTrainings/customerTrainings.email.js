// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerTrainings.email.js — Monta assunto/corpo dos e-mails       ║
// ║ kind: invite (agendado/reagendado) | cancel | report (realizado)   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { formatDuration, formatScheduledAt } from '../../generationPdf/generationCustomerTrainingPdf.js';
import { FORMAT_LABELS } from './customerTrainings.constants.js';

export const EMAIL_KINDS = Object.freeze(['invite', 'cancel', 'report']);

export function defaultEmailKind(status) {
  if (status === 'done') return 'report';
  if (status === 'cancelled') return 'cancel';
  return 'invite';
}

const escapeHtml = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nl2br = (v) => escapeHtml(v).replace(/\r?\n/g, '<br>');

function detailsRows(t) {
  return [
    ['Treinamento', t.title],
    ['Data e horário', formatScheduledAt(t.scheduled_at)],
    ['Duração', formatDuration(t.duration_minutes)],
    ['Formato', FORMAT_LABELS[t.format] || t.format],
    ['Local / link', t.location_or_link],
    ['Instrutor', t.trainer_name],
  ].filter(([, v]) => v);
}

export function buildTrainingEmail(t, { kind, message = '' } = {}) {
  const customer = t.customer_trade_name || t.customer_legal_name || '';
  const when = formatScheduledAt(t.scheduled_at);

  const intro = {
    invite: t.status === 'rescheduled'
      ? 'O treinamento abaixo foi <strong>reagendado</strong>. Confira a nova data e horário:'
      : 'Confirmamos o agendamento do treinamento abaixo:',
    cancel: 'Informamos que o treinamento abaixo foi <strong>cancelado</strong>. Em breve entraremos em contato para uma nova data.',
    report: 'Obrigado pela participação! Segue em anexo o relatório do treinamento realizado.',
  }[kind];

  const subject = {
    invite: `${t.status === 'rescheduled' ? 'Treinamento reagendado' : 'Agendamento de treinamento'}: ${t.title} — ${when}`,
    cancel: `Treinamento cancelado: ${t.title} — ${when}`,
    report: `Relatório do treinamento: ${t.title}`,
  }[kind];

  const rows = detailsRows(t)
    .map(([label, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
        <td style="padding:6px 0;color:#0f172a;font-weight:600">${nl2br(value)}</td>
      </tr>`)
    .join('');

  const topics = kind !== 'cancel' && t.topics
    ? `<p style="margin:18px 0 6px;font-weight:700">Conteúdo programático</p><p style="margin:0">${nl2br(t.topics)}</p>`
    : '';

  const pending = kind === 'report' && t.pending_items
    ? `<p style="margin:18px 0 6px;font-weight:700">Pendências</p><p style="margin:0">${nl2br(t.pending_items)}</p>`
    : '';

  const extra = String(message || '').trim()
    ? `<p style="margin:18px 0 0">${nl2br(message)}</p>`
    : '';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
      <p style="margin:0 0 12px">Olá${customer ? `, equipe ${escapeHtml(customer)}` : ''}!</p>
      <p style="margin:0 0 12px">${intro}</p>
      <table style="border-collapse:collapse;margin:8px 0">${rows}</table>
      ${topics}
      ${pending}
      ${extra}
      <p style="margin:24px 0 0">Atenciosamente,<br>Equipe CONSART</p>
    </div>
  `;

  const text = [
    `Olá${customer ? `, equipe ${customer}` : ''}!`,
    '',
    intro.replace(/<[^>]+>/g, ''),
    '',
    ...detailsRows(t).map(([label, value]) => `${label}: ${value}`),
    t.topics && kind !== 'cancel' ? `\nConteúdo programático:\n${t.topics}` : null,
    kind === 'report' && t.pending_items ? `\nPendências:\n${t.pending_items}` : null,
    String(message || '').trim() ? `\n${message}` : null,
    '',
    'Atenciosamente,',
    'Equipe CONSART',
  ].filter((line) => line !== null).join('\n');

  return { subject, html, text };
}
