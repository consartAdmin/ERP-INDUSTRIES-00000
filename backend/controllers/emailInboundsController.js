// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailInboundsController.js — Processamento de E-mails (IMAP)        ║
// ║ CONSART ERP — Listener INBOX baseado em public."emailAccounts"      ║
// ║                                                                    ║
// ║ ✅ UID persistido em emailAccounts.last_imap_uid                   ║
// ║ ✅ Deduplicação real por (account_id + imap_uid)                   ║
// ║ ✅ Seguro para restart / crash                                     ║
// ║ ✅ Multi-account ready                                             ║
// ║ ✅ Lock por account_id (evita 2 listeners)                         ║
// ║ ✅ NOVO: Upload anexos para GCS + Signed URL em attachments_meta   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { listenInboxHostinger } from '../services/email/imapHostingerClient.js';
import emailInboundsApi from '../repositories/emailInbounds/emailInbounds.index.js';
import emailAccountsApi from '../repositories/emailAccounts/emailAccounts.index.js';
import pool from '../config/db.js';

// 🔐 Lock por account (evita 2 listeners no mesmo processo)
import {
  acquireListenerLock,
  releaseListenerLock,
} from '../services/email/emailListenerRegistry.js';

// ✅ NOVO: GCS para anexos
import { Storage } from '@google-cloud/storage';

/* ------------------------------------------------------------------ */
/* GCS CONFIG (Anexos Inbounds)                                        */
/* ------------------------------------------------------------------ */

const GCS_BUCKET = (process.env.GCS_BUCKET || '').trim();
const GCS_PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
const EMAIL_INBOUNDS_PREFIX = (process.env.EMAIL_INBOUNDS_PREFIX || 'email/inbounds')
  .replace(/^\/+|\/+$/g, '');

const storage = GCS_BUCKET
  ? new Storage(GCS_PROJECT_ID ? { projectId: GCS_PROJECT_ID } : undefined)
  : null;

function safeName(name = 'attachment') {
  // evita path traversal + caracteres esquisitos em object-name
  return String(name)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[\\\/]+/g, '_')
    .replace(/[^\w.\-() ]+/g, '_')
    .trim()
    .slice(0, 180) || 'attachment';
}

async function uploadBufferToGcs({ accountId, imapUid, filename, contentType, buffer }) {
  if (!storage || !GCS_BUCKET) return { gcs_path: '', url: '' };

  const bucket = storage.bucket(GCS_BUCKET);

  const dt = new Date();
  const yyyy = String(dt.getUTCFullYear());
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');

  const safeFilename = safeName(filename);
  const uidPart = Number.isFinite(Number(imapUid)) && Number(imapUid) > 0 ? `uid_${imapUid}` : 'uid_no_uid';

  const gcs_path =
    `${EMAIL_INBOUNDS_PREFIX}/account_${accountId}/${uidPart}/${yyyy}/${mm}/${dd}/${Date.now()}_${safeFilename}`;

  const file = bucket.file(gcs_path);

  await file.save(buffer, {
    resumable: false,
    contentType: contentType || 'application/octet-stream',
    metadata: {
      cacheControl: 'private, max-age=0, no-transform',
    },
  });

  // signed url (read)
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 min
  });

  return { gcs_path, url: url || '' };
}

async function buildAttachmentsMetaAndUpload(email, accountId) {
  // email.attachments (mailparser) => [{ filename, contentType, size, content: Buffer, ... }]
  const atts = Array.isArray(email?.attachments) ? email.attachments : [];

  // se já veio com meta pronto, respeita
  const preMeta =
    Array.isArray(email?.attachments_meta) ? email.attachments_meta :
    Array.isArray(email?.attachmentsMeta) ? email.attachmentsMeta :
    null;

  if (preMeta && Array.isArray(preMeta)) {
    // garante formato mínimo
    return preMeta.map((a) => ({
      filename: a?.filename || a?.name || 'attachment',
      contentType: a?.contentType || a?.mimeType || a?.mime || '',
      size: Number(a?.size || 0) || 0,
      url: a?.url || '',
      gcs_path: a?.gcs_path || a?.path || '',
    }));
  }

  if (!atts.length) return [];

  const meta = [];

  for (let i = 0; i < atts.length; i++) {
    const a = atts[i] || {};
    const filename = a?.filename || a?.name || `attachment_${i + 1}`;
    const contentType = a?.contentType || a?.mimeType || a?.mime || '';
    const size = Number(a?.size || a?.length || a?.content?.length || 0) || 0;

    // mailparser normalmente entrega Buffer em a.content
    const buf = a?.content;

    // sem buffer => grava meta, sem URL
    if (!buf || !(buf instanceof Buffer) || buf.length === 0) {
      meta.push({
        filename,
        contentType,
        size,
        url: '',
        gcs_path: '',
      });
      continue;
    }

    // se GCS não está configurado, não quebra: apenas meta sem URL
    if (!storage || !GCS_BUCKET) {
      meta.push({
        filename,
        contentType,
        size,
        url: '',
        gcs_path: '',
      });
      continue;
    }

    try {
      const { gcs_path, url } = await uploadBufferToGcs({
        accountId,
        imapUid: email?.uid,
        filename,
        contentType,
        buffer: buf,
      });

      meta.push({
        filename,
        contentType,
        size,
        url,
        gcs_path,
      });
    } catch (err) {
      console.error('[EmailInbounds] falha ao subir anexo no GCS:', {
        accountId,
        uid: email?.uid,
        filename,
        error: err?.message || err,
      });

      // não derruba o listener: salva sem URL
      meta.push({
        filename,
        contentType,
        size,
        url: '',
        gcs_path: '',
      });
    }
  }

  return meta;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildImapConfigFromAccount(account) {
  return {
    account_id: account.id,

    user:
      account.imap_user ||
      account.smtp_user ||
      account.email_address,

    password:
      account.imap_pass ||
      account.smtp_pass ||
      '',

    host: account.imap_host || 'imap.hostinger.com',
    port: Number(account.imap_port || 993),

    secure:
      typeof account.imap_secure === 'boolean'
        ? account.imap_secure
        : true,

    // 🔐 checkpoint REAL vindo do banco
    startUid: Number(account.last_imap_uid || 0),
  };
}

function validateImapConfig(cfg) {
  const missing = [];
  if (!cfg.user) missing.push('imap_user');
  if (!cfg.password) missing.push('imap_pass');
  if (!cfg.host) missing.push('imap_host');
  if (!cfg.port || !Number.isFinite(cfg.port)) missing.push('imap_port');

  if (missing.length) {
    throw new Error(
      `[EmailInbounds] IMAP incompleto: ${missing.join(', ')}`
    );
  }
}

/* ------------------------------------------------------------------ */
/* Persistência                                                       */
/* ------------------------------------------------------------------ */

async function salvarEmailNoBanco(email, accountId) {
  try {
    const saved = await emailInboundsApi.saveInboundEmail(
      pool,
      accountId,
      email
    );

    console.log(
      `[EmailInbounds] account=${accountId} salvo id=${saved.id} uid=${email.uid}`
    );

    return saved;
  } catch (err) {
    console.error('[EmailInbounds] erro ao salvar e-mail:', err);
    return null;
  }
}

async function atualizarLastUid(accountId, uid) {
  const n = Number(uid);
  if (!Number.isFinite(n) || n <= 0) return;

  await pool.query(
    `
    UPDATE public."emailAccounts"
       SET last_imap_uid = GREATEST(COALESCE(last_imap_uid, 0), $2)
     WHERE id = $1
    `,
    [accountId, n]
  );
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                          */
/* ------------------------------------------------------------------ */

export async function startEmailInboundsListener({ account_id } = {}) {
  let account;

  // 🔐 REGRA DE OURO:
  // listAccounts() NUNCA traz secrets
  // getAccountById(..., includeSecrets:true) SEMPRE

  if (account_id) {
    account = await emailAccountsApi.getAccountById(
      pool,
      account_id,
      { includeSecrets: true }
    );
  } else {
    const list = await emailAccountsApi.listAccounts(
      pool,
      { onlyActive: true, limit: 1 }
    );

    if (!list?.length) {
      throw new Error(
        '[EmailInbounds] Nenhuma conta de e-mail ativa encontrada.'
      );
    }

    account = await emailAccountsApi.getAccountById(
      pool,
      list[0].id,
      { includeSecrets: true }
    );
  }

  if (!account) {
    throw new Error(
      '[EmailInbounds] Falha ao carregar conta de e-mail.'
    );
  }

  // 🔐 Lock por conta (ANTI-DUP)
  const locked = acquireListenerLock(account.id);
  if (!locked) {
    console.warn(
      `[EmailInbounds] Listener já ativo para account_id=${account.id}. Ignorando bootstrap.`
    );
    return;
  }

  const IMAP_CONFIG = buildImapConfigFromAccount(account);

  try {
    validateImapConfig(IMAP_CONFIG);

    console.log(
      `[EmailInbounds] Listener IMAP iniciado — account=${account.id} startUid=${IMAP_CONFIG.startUid}`
    );

    if (!GCS_BUCKET) {
      console.warn('[EmailInbounds] GCS_BUCKET não definido — anexos aparecerão, mas não terão download URL.');
    }

    await listenInboxHostinger(
      IMAP_CONFIG,
      async (email, meta = {}) => {
        // ✅ NOVO: cria meta + sobe anexos (se possível) antes de salvar
        try {
          const attsMeta = await buildAttachmentsMetaAndUpload(email, account.id);
          email.attachments_meta = attsMeta; // ✅ isso vai para o DB
        } catch (e) {
          console.error('[EmailInbounds] erro ao processar anexos (non-blocking):', e?.message || e);
          // não derruba o listener
        }

        // salva no banco (dedup: account_id + imap_uid)
        await salvarEmailNoBanco(email, account.id);

        // 🔐 checkpoint definitivo no banco:
        // usa o MAIOR UID visto no poll (meta.lastUid)
        const checkpoint = Number(meta.lastUid || email?.uid || 0);
        if (Number.isFinite(checkpoint) && checkpoint > 0) {
          await atualizarLastUid(account.id, checkpoint);
        }
      }
    );

    console.log(
      `[EmailInbounds] Listener ativo — account=${account.id}`
    );
  } catch (err) {
    // libera lock se falhar ao iniciar
    releaseListenerLock(account.id);
    console.error('[EmailInbounds] Erro ao iniciar listener:', err);
    throw err;
  }
}
  