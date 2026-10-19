// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ 🔐 certificadoController.js – Upload & Validação de Certificado Digital   ║
// ║   • ESM puro                                                               ║
// ║   • Valida PFX em memória (node-forge)                                     ║
/*  ║   • Salva no GCS se houver bucket; caso contrário, salva local em /tmp
     ║   • Mapeia variáveis: NFE_CERT_BUCKET | GCS_BUCKET | UPLOAD_BUCKET
     ║   • Caminho padrão no bucket: certificadoDigital/<timestamp>-<arquivo>.pfx
     ║   • Diretório local configurável via CERTS_DIR (default: /tmp/certs)
     ║   • Mensagens de erro claras (senha inválida, permissão, SDK ausente)   */
// ╚════════════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import forge from 'node-forge';

// SDKs do GCP são opcionais (não quebram local/envs sem SDK)
let Storage = null;
try {
  ({ Storage } = await import('@google-cloud/storage').catch(() => ({})));
} catch { /* noop */ }

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Lê/valida PFX a partir de Buffer e retorna { emitente, validade } */
function parsePfxFromBuffer(buf, senha) {
  try {
    const der = buf.toString('binary');
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = bags[forge.pki.oids.certBag]?.[0]?.cert;
    if (!cert) throw new Error('CERT_NOT_FOUND');

    const emitente = cert.subject.getField('CN')?.value || '(CN indisponível)';
    const validade = cert.validity.notAfter.toISOString().split('T')[0];

    return { emitente, validade };
  } catch (e) {
    // Erros comuns do forge para senha/mac inválidos
    const msg = String(e?.message || e);
    if (
      msg.includes('Invalid MAC') ||
      msg.includes('pkcs12') ||
      msg.includes('ASN.1') ||
      msg.includes('pbe') ||
      msg.includes('password')
    ) {
      const err = new Error('SENHA_INVALIDA');
      err.code = 'SENHA_INVALIDA';
      throw err;
    }
    throw e;
  }
}

/** Resolve configuração ativa (bucket, object default, dest local) */
function getActiveConfig(originalName = 'certificado.pfx') {
  const bucketEnv =
    process.env.NFE_CERT_BUCKET ||
    process.env.GCS_BUCKET ||
    process.env.UPLOAD_BUCKET ||
    '';

  const objectDefault =
    process.env.NFE_CERT_OBJECT ||
    `certificadoDigital/${Date.now()}-${String(originalName).replace(/\s+/g, '_')}`;

  const certsDir = process.env.CERTS_DIR || '/tmp/certs'; // Cloud Run só permite escrita em /tmp

  return {
    bucket: bucketEnv.trim(),
    object: objectDefault,
    certsDir,
    canUseGCS: !!(bucketEnv && Storage), // só usa GCS se houver bucket e SDK
  };
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/** Salva em GCS e retorna { gcsUri } */
async function saveToGCS({ bucket, object }, buffer, metadata) {
  if (!Storage) throw new Error('GCS_SDK_ABSENT');
  const storage = new Storage();
  const bkt = storage.bucket(bucket);
  const file = bkt.file(object);

  await file.save(buffer, {
    resumable: false,
    contentType: 'application/x-pkcs12',
    metadata: { metadata },
  });
  await file.setMetadata({ cacheControl: 'no-store' });

  return { gcsUri: `gs://${bucket}/${object}` };
}

/** Salva localmente (fallback) e retorna { filePath } */
async function saveToLocal(dir, object, buffer) {
  await ensureDir(dir);
  const filePath = path.join(dir, path.basename(object));
  await fsp.writeFile(filePath, buffer);
  return { filePath };
}

// ──────────────────────────────────────────────────────────────────────────────
// Controllers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/certificado
 * Necessita de multer.memoryStorage() no route:
 *   upload.single('certificado')  +  body.senha
 */
export const uploadCertificado = async (req, res) => {
  try {
    const senha = req.body?.senha;
    const file = req.file;

    if (!file || !senha) {
      return res
        .status(400)
        .json({ erro: 'Arquivo .pfx e senha são obrigatórios.' });
    }
    if (!file.originalname?.toLowerCase().endsWith('.pfx')) {
      return res.status(400).json({ erro: 'Envie um arquivo .pfx válido.' });
    }

    // 1) Validar PFX em memória (sem tocar disco)
    let emitente, validade;
    try {
      ({ emitente, validade } = parsePfxFromBuffer(file.buffer, senha));
    } catch (e) {
      if (e?.code === 'SENHA_INVALIDA') {
        return res.status(400).json({ erro: 'Senha do certificado inválida.' });
      }
      console.error('[PFX_PARSE_ERR]', e?.message || e);
      return res
        .status(500)
        .json({ erro: 'Falha ao ler o certificado. Verifique o arquivo.' });
    }

    // 2) Destino (GCS se disponível, senão local /tmp)
    const cfg = getActiveConfig(file.originalname);

    let saved = {};
    try {
      if (cfg.canUseGCS) {
        saved = await saveToGCS(
          { bucket: cfg.bucket, object: cfg.object },
          file.buffer,
          { tipo: 'certificadoA1', validade, emitente }
        );
      } else {
        saved = await saveToLocal(cfg.certsDir, cfg.object, file.buffer);
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('EACCES') || msg.includes('permission')) {
        return res.status(500).json({
          erro:
            'Sem permissão para gravar no destino. Se estiver em Cloud Run, use CERTS_DIR=/tmp/certs.',
          detalhe: msg,
        });
      }
      if (msg === 'GCS_SDK_ABSENT') {
        return res.status(500).json({
          erro:
            'SDK do Google Cloud Storage não disponível. Instale @google-cloud/storage ou defina CERTS_DIR para usar armazenamento local.',
        });
      }
      console.error('[SAVE_ERR]', msg);
      return res.status(500).json({ erro: 'Falha ao salvar o certificado.' });
    }

    // 3) Resposta
    return res.json({
      ok: true,
      emitente,
      validade,
      // destinos
      bucket: cfg.canUseGCS ? cfg.bucket : null,
      object: cfg.object,
      gcsUri: saved.gcsUri || null,
      filePath: saved.filePath || null,
      // dica operacional
      hint:
        cfg.canUseGCS
          ? 'Arquivo gravado no GCS com sucesso.'
          : `Arquivo gravado localmente em ${cfg.certsDir}. Em produção, prefira GCS definindo NFE_CERT_BUCKET.`,
    });
  } catch (err) {
    console.error('❌ [uploadCertificado] ERRO:', err?.message || err);
    return res
      .status(500)
      .json({ erro: 'Erro inesperado ao processar o certificado.' });
  }
};

/** GET /api/certificado/env – expõe como o backend está configurado */
export const getEnv = async (_req, res) => {
  const cfg = getActiveConfig('certificado.pfx');
  res.json({
    mode: cfg.canUseGCS ? 'gcs' : 'local',
    NFE_CERT_BUCKET:
      process.env.NFE_CERT_BUCKET ||
      process.env.GCS_BUCKET ||
      process.env.UPLOAD_BUCKET ||
      '',
    NFE_CERT_OBJECT: process.env.NFE_CERT_OBJECT || 'certificadoDigital/<arquivo.pfx>',
    CERTS_DIR: cfg.certsDir,
    hasGcsSdk: !!Storage,
  });
};
