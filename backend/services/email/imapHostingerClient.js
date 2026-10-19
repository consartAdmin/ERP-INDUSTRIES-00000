// ╔══════════════════════════════════════════════════════════════════╗
// ║ imapHostingerClient.js — IMAP Listener (Hostinger FIX)            ║
// ║ CONSART ERP                                                      ║
// ║                                                                  ║
// ║ ✅ Poll híbrido (SEARCH ALL + UID filter)                         ║
// ║ ✅ Checkpoint persistente (startUid)                              ║
// ║ ✅ Compatível com Hostinger (IMAP BUG WORKAROUND)                 ║
// ║ ✅ Nunca perde e-mails / nunca duplica                            ║
// ║ ✅ NOVO: salva anexos em /public/email_attachments + URL download ║
// ╚══════════════════════════════════════════════════════════════════╝

import pkg from 'imap';
import { simpleParser } from 'mailparser';

// ✅ NOVO: salvar anexos localmente (teste rápido)
import fs from 'fs/promises';
import path from 'path';

const Imap = pkg;

/* -------------------------------------------------------------- */
/* Attachments: salvar em /public e gerar URL                      */
/* -------------------------------------------------------------- */

function safeFilename(name = 'attachment') {
  return String(name)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'attachment';
}

async function saveInboundAttachmentsToPublic({ account_id, uid, attachments }) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return [];

  // backend/public/email_attachments/inbounds/<account>/<uid>/
  const baseDir = path.join(
    process.cwd(),
    'public',
    'email_attachments',
    'inbounds',
    String(account_id || 0),
    String(uid || 0)
  );

  await fs.mkdir(baseDir, { recursive: true });

  const meta = [];

  for (let i = 0; i < list.length; i++) {
    const a = list[i] || {};
    const filename = safeFilename(a?.filename || a?.name || `attachment_${i + 1}`);
    const fullpath = path.join(baseDir, filename);

    const buf = a?.content; // mailparser -> Buffer
    if (!buf || !(buf instanceof Buffer) || buf.length === 0) {
      meta.push({
        filename,
        contentType: a?.contentType || '',
        size: Number(a?.size || 0) || 0,
        url: '',
      });
      continue;
    }

    await fs.writeFile(fullpath, buf);

    // URL pública (seu server precisa servir /public)
    const url =
      `/public/email_attachments/inbounds/${encodeURIComponent(String(account_id || 0))}` +
      `/${encodeURIComponent(String(uid || 0))}` +
      `/${encodeURIComponent(filename)}`;

    meta.push({
      filename,
      contentType: a?.contentType || '',
      size: Number(a?.size || buf.length || 0) || 0,
      url,
    });
  }

  return meta;
}

/* -------------------------------------------------------------- */
/* Main Listener                                                   */
/* -------------------------------------------------------------- */

export function listenInboxHostinger(config, onEmailReceived) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.host || 'imap.hostinger.com',
      port: Number(config.port || 993),
      tls: config.secure !== false,
      tlsOptions: { rejectUnauthorized: false },

      authTimeout: 15000,
      connTimeout: 15000,

      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
    });

    let lastUid = Number(config.startUid || 0);
    let polling = false;
    const POLL_MS = 30000;

    /* -------------------------------------------------------------- */
    /* Helpers                                                        */
    /* -------------------------------------------------------------- */

    function openInbox() {
      return new Promise((res, rej) => {
        imap.openBox('INBOX', false, (err) => {
          if (err) return rej(err);
          console.log('[IMAP] INBOX aberta');
          res();
        });
      });
    }

    async function fetchNewMessages() {
      return new Promise((resolveFetch) => {
        // 🔥 HOSTINGER FIX: SEARCH ALL
        imap.search(['ALL'], (err, results) => {
          if (err) {
            console.error('[IMAP] search error:', err);
            return resolveFetch(lastUid);
          }

          if (!results?.length) {
            return resolveFetch(lastUid);
          }

          const uids = results
            .map(Number)
            .filter((uid) => Number.isFinite(uid) && uid > lastUid)
            .sort((a, b) => a - b);

          if (!uids.length) {
            return resolveFetch(lastUid);
          }

          let maxSeenUid = lastUid;

          const fetcher = imap.fetch(uids, {
            bodies: '',
            uid: true,
          });

          fetcher.on('message', (msg) => {
            // ✅ capturar raw MIME como Buffer
            let uid = null;
            const chunks = [];

            msg.on('attributes', (attrs) => {
              uid = Number(attrs?.uid || 0);
              if (Number.isFinite(uid) && uid > maxSeenUid) {
                maxSeenUid = uid;
              }
            });

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              });
            });

            msg.once('end', async () => {
              try {
                const raw = Buffer.concat(chunks);

                // ✅ parse raw MIME (habilita attachments)
                const parsed = await simpleParser(raw);

                const account_id = Number(config.account_id || 0);

                // ✅ NOVO: salvar anexos em /public e gerar URLs
                const attachments_meta = await saveInboundAttachmentsToPublic({
                  account_id,
                  uid,
                  attachments: parsed.attachments || [],
                });

                const payload = {
                  uid,
                  from: parsed.from?.text || '',
                  to: parsed.to?.text || '',
                  subject: parsed.subject || '',
                  text: parsed.text || '',
                  html: parsed.html || '',
                  date: parsed.date || new Date(),

                  // mantém attachments (debug), meta é o que salva no DB
                  attachments: parsed.attachments || [],
                  attachments_meta,
                };

                // ✅ callback nunca pode derrubar o fetch
                try {
                  await onEmailReceived(payload, { lastUid: maxSeenUid });
                } catch (cbErr) {
                  console.error('[IMAP] onEmailReceived error (non-blocking):', cbErr);
                }
              } catch (e) {
                console.error('[IMAP] parse error:', e);
              }
            });
          });

          fetcher.once('end', () => resolveFetch(maxSeenUid));
          fetcher.once('error', (e) => {
            console.error('[IMAP] fetch error:', e);
            resolveFetch(maxSeenUid);
          });
        });
      });
    }

    async function poll() {
      if (polling) return;
      polling = true;

      try {
        const newMax = await fetchNewMessages();

        if (newMax > lastUid) {
          lastUid = newMax;
          console.log('[IMAP] checkpoint atualizado:', lastUid);
        }
      } catch (e) {
        console.error('[IMAP] poll error:', e);
      } finally {
        polling = false;
      }
    }

    /* -------------------------------------------------------------- */
    /* Lifecycle                                                      */
    /* -------------------------------------------------------------- */

    imap.once('ready', async () => {
      try {
        await openInbox();

        // primeiro poll rápido
        setTimeout(poll, 2000);

        // depois polling normal
        setInterval(poll, POLL_MS);

        resolve();
      } catch (e) {
        reject(e);
      }
    });

    imap.once('error', (err) => {
      console.error('[IMAP] connection error:', err);
      reject(err);
    });

    imap.once('end', () => {
      console.warn('[IMAP] conexão encerrada');
    });

    imap.connect();
  });
}

/* ------------------------------------------------------------------ */
/* Import Sent — STUB (compatibilidade com Outbounds)                  */
/* ------------------------------------------------------------------ */

export async function importSentFromHostinger() {
  console.warn('[IMAP Sent] importSentFromHostinger chamado, mas está desativado.');

  return {
    importedCount: 0,
    status: 'disabled',
  };
}
