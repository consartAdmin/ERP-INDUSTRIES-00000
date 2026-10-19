// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersAttachmentsRoutes.js — Anexos do cliente (aba "Anexos")    ║
// ║ CONSART ERP | Routes | ESM                                          ║
// ║ Montar em server.js:                                                ║
// ║   app.use('/api/customers', customersAttachmentsRoutes);            ║
// ║                                                                      ║
// ║ GET    /api/customers/:customerId/attachments                        ║
// ║ POST   /api/customers/:customerId/attachments        (multipart)     ║
// ║ GET    /api/customers/:customerId/attachments/:attachmentId/download ║
// ║ DELETE /api/customers/:customerId/attachments/:attachmentId          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import multer from 'multer';

import {
    customerExists,
    insertAttachment,
    listByCustomer,
    findActiveAttachment,
    softDeleteAttachment,
} from '../repositories/customers/customersAttachments.repository.js';

import {
    uploadCustomerAttachmentToBucket,
    createCustomerAttachmentReadStream,
    deleteCustomerAttachmentObject,
    fixUploadedFileName,
    isSupportedCustomerAttachment,
    isInlineCustomerAttachment,
    getSupportedCustomerAttachmentExtensions,
    CUSTOMER_ATTACHMENT_MAX_BYTES,
    CUSTOMER_ATTACHMENT_MAX_FILES,
} from '../uploadBuckets/uploadBucketsCustomers.js';

const router = Router();

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const toId = (v) => {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// ⚠ Ajuste para o seu middleware de autenticação (de onde vem o usuário logado)
const getUserId = (req) =>
    toId(req.user?.id ?? req.user?.user_id ?? req.session?.user?.id ?? null);

function contentDisposition(type, fileName) {
    const ascii = String(fileName).replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
    return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// multer em memória — o buffer vai direto pro GCS
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: CUSTOMER_ATTACHMENT_MAX_BYTES,
        files: CUSTOMER_ATTACHMENT_MAX_FILES,
    },
    fileFilter(req, file, cb) {
        const name = fixUploadedFileName(file.originalname);

        if (!isSupportedCustomerAttachment(name)) {
            const err = new Error(
                `Formato não permitido: ${name}. Use: ${getSupportedCustomerAttachmentExtensions().join(', ')}.`
            );
            err.code = 'INVALID_CUSTOMER_ATTACHMENT_TYPE';
            return cb(err);
        }

        cb(null, true);
    },
});

function receiveFiles(req, res, next) {
    upload.array('files', CUSTOMER_ATTACHMENT_MAX_FILES)(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ ok: false, error: 'Arquivo maior que 20 MB.' });
        }

        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                ok: false,
                error: `Envie no máximo ${CUSTOMER_ATTACHMENT_MAX_FILES} arquivos por vez.`,
            });
        }

        return res.status(400).json({ ok: false, error: err.message || 'Falha no upload.' });
    });
}

// ---------------------------------------------------------------------
// GET — lista
// ---------------------------------------------------------------------
router.get('/:customerId/attachments', async (req, res) => {
    const customerId = toId(req.params.customerId);
    if (!customerId) return res.status(400).json({ ok: false, error: 'ID do cliente inválido.' });

    try {
        const rows = await listByCustomer(customerId);
        return res.json({ ok: true, rows });
    } catch (err) {
        console.error('[customersAttachments] list:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao listar anexos.' });
    }
});

// ---------------------------------------------------------------------
// POST — upload (campo "files", + "category" e "description" opcionais)
// ---------------------------------------------------------------------
router.post('/:customerId/attachments', receiveFiles, async (req, res) => {
    const customerId = toId(req.params.customerId);
    if (!customerId) return res.status(400).json({ ok: false, error: 'ID do cliente inválido.' });

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado.' });

    try {
        if (!(await customerExists(customerId))) {
            return res.status(404).json({ ok: false, error: 'Cliente não encontrado.' });
        }
    } catch (err) {
        console.error('[customersAttachments] customerExists:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao validar cliente.' });
    }

    const userId = getUserId(req);
    const uploaded = [];
    const failed = [];

    for (const file of files) {
        const originalName = fixUploadedFileName(file.originalname);
        let stored = null;

        try {
            stored = await uploadCustomerAttachmentToBucket({
                customerId,
                buffer: file.buffer,
                originalName,
            });

            const row = await insertAttachment({
                customer_id: customerId,
                original_name: originalName,
                storage_bucket: stored.bucket,
                storage_path: stored.objectPath,
                mime_type: stored.mimeType,
                size_bytes: stored.sizeBytes,
                category: req.body?.category,
                description: req.body?.description,
                uploaded_by: userId,
            });

            uploaded.push(row);
        } catch (err) {
            console.error('[customersAttachments] upload:', originalName, err);

            // Compensação: subiu pro GCS mas falhou no banco → remove o objeto órfão
            if (stored?.objectPath) {
                await deleteCustomerAttachmentObject(stored.objectPath, { silent: true });
            }

            failed.push({
                name: originalName,
                error: err.code?.startsWith?.('INVALID_') || err.code?.startsWith?.('CUSTOMER_')
                    ? err.message
                    : 'Erro ao salvar o arquivo.',
            });
        }
    }

    const status = uploaded.length ? 201 : 500;
    return res.status(status).json({ ok: uploaded.length > 0, uploaded, failed });
});

// ---------------------------------------------------------------------
// GET — download / visualizar (?inline=1 abre no navegador)
// ---------------------------------------------------------------------
router.get('/:customerId/attachments/:attachmentId/download', async (req, res) => {
    const customerId = toId(req.params.customerId);
    const attachmentId = toId(req.params.attachmentId);
    if (!customerId || !attachmentId) {
        return res.status(400).json({ ok: false, error: 'Parâmetros inválidos.' });
    }

    try {
        const att = await findActiveAttachment(customerId, attachmentId);
        if (!att) return res.status(404).json({ ok: false, error: 'Anexo não encontrado.' });

        const mimeType = att.mime_type || 'application/octet-stream';
        const inline = req.query.inline === '1' && isInlineCustomerAttachment(mimeType);

        const stream = createCustomerAttachmentReadStream(att.storage_path);

        stream.on('error', (err) => {
            console.error('[customersAttachments] stream:', err);
            if (!res.headersSent) {
                const notFound = err?.code === 404;
                res.status(notFound ? 404 : 500).json({
                    ok: false,
                    error: notFound ? 'Arquivo não encontrado no storage.' : 'Erro ao baixar anexo.',
                });
            } else {
                res.destroy(err);
            }
        });

        stream.once('response', () => {
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', att.original_name));
            res.setHeader('Cache-Control', 'private, no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (att.size_bytes) res.setHeader('Content-Length', String(att.size_bytes));
        });

        stream.pipe(res);
    } catch (err) {
        console.error('[customersAttachments] download:', err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'Erro ao baixar anexo.' });
    }
});

// ---------------------------------------------------------------------
// DELETE — exclusão lógica no banco + remove objeto do bucket
// (o bucket tem "exclusão reversível", então dá para recuperar pelo console)
// ---------------------------------------------------------------------
router.delete('/:customerId/attachments/:attachmentId', async (req, res) => {
    const customerId = toId(req.params.customerId);
    const attachmentId = toId(req.params.attachmentId);
    if (!customerId || !attachmentId) {
        return res.status(400).json({ ok: false, error: 'Parâmetros inválidos.' });
    }

    try {
        const removed = await softDeleteAttachment(customerId, attachmentId, {
            deleted_by: getUserId(req),
        });

        if (!removed) return res.status(404).json({ ok: false, error: 'Anexo não encontrado.' });

        await deleteCustomerAttachmentObject(removed.storage_path, { silent: true });

        return res.json({ ok: true, attachment_id: attachmentId });
    } catch (err) {
        console.error('[customersAttachments] delete:', err);
        return res.status(500).json({ ok: false, error: 'Erro ao excluir anexo.' });
    }
});

export default router;
