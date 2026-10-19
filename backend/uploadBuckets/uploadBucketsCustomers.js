// ╔══════════════════════════════════════════════════════════════════════╗
// ║ uploadBucketsCustomers.js — Anexos de clientes (GCS)                 ║
// ║ CONSART ERP | Service | ESM                                          ║
// ║ Path: backend/uploadBuckets/uploadBucketsCustomers.js                ║
// ║ Objetos: customers/{customer_id}/{uuid}.{ext}                        ║
// ║ ⚠ Documentos privados: NÃO expor URL pública — servir pelo backend. ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import crypto from 'node:crypto';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET_CUSTOMERS =
    process.env.GCS_BUCKET_CUSTOMERS ||
    process.env.GCS_BUCKET ||
    'erp-infinity-00000';

const GCS_PREFIX_CUSTOMERS =
    process.env.GCS_PREFIX_CUSTOMERS ||
    'customers';

const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET_CUSTOMERS);

export const CUSTOMER_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const CUSTOMER_ATTACHMENT_MAX_FILES = 10;

// Extensão → MIME servido no download.
// O MIME vem da extensão (não do navegador) para evitar tipos forjados.
const EXTENSION_MIME = Object.freeze({
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    csv: 'text/csv',
    txt: 'text/plain',
    xml: 'application/xml',
    zip: 'application/zip',
    rar: 'application/vnd.rar',
});

// Tipos que o navegador pode abrir em nova aba (visualizar)
const INLINE_MIME = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
]);

function makeError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeCustomerId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw makeError('ID do cliente inválido.', 'INVALID_CUSTOMER_ID');
    }
    return id;
}

function getExtension(fileName) {
    const match = /\.([a-z0-9]{1,10})$/i.exec(String(fileName || '').trim());
    return match ? match[1].toLowerCase() : '';
}

function isCustomerObjectPath(objectPath) {
    const path = String(objectPath || '').trim();
    return path.startsWith(`${GCS_PREFIX_CUSTOMERS}/`) && !path.includes('..');
}

/**
 * multer decodifica o nome original como latin1 — corrige acentos
 * ("contrato_ServiÃ§o.pdf" → "contrato_Serviço.pdf").
 */
export function fixUploadedFileName(name) {
    const raw = String(name || '').trim();
    if (!raw) return 'arquivo';

    try {
        const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
        return utf8.includes('�') ? raw : utf8;
    } catch {
        return raw;
    }
}

export function getCustomerAttachmentMimeType(fileName) {
    return EXTENSION_MIME[getExtension(fileName)] || null;
}

export function isSupportedCustomerAttachment(fileName) {
    return Boolean(getCustomerAttachmentMimeType(fileName));
}

export function isInlineCustomerAttachment(mimeType) {
    return INLINE_MIME.has(String(mimeType || '').toLowerCase());
}

export function getSupportedCustomerAttachmentExtensions() {
    return Object.keys(EXTENSION_MIME);
}

export function getCustomerAttachmentBucketInfo() {
    return Object.freeze({
        bucket: GCS_BUCKET_CUSTOMERS,
        prefix: GCS_PREFIX_CUSTOMERS,
    });
}

/**
 * Envia um anexo para customers/{customerId}/{uuid}.{ext}.
 * O nome original fica no banco (e no metadata), nunca no path.
 */
export async function uploadCustomerAttachmentToBucket({
    customerId,
    buffer,
    originalName,
} = {}) {
    const id = normalizeCustomerId(customerId);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw makeError('Arquivo não informado ou vazio.', 'CUSTOMER_ATTACHMENT_FILE_REQUIRED');
    }

    if (buffer.length > CUSTOMER_ATTACHMENT_MAX_BYTES) {
        throw makeError('Arquivo maior que 20 MB.', 'CUSTOMER_ATTACHMENT_TOO_LARGE');
    }

    const extension = getExtension(originalName);
    const mimeType = EXTENSION_MIME[extension];

    if (!mimeType) {
        throw makeError(
            `Formato não permitido. Use: ${getSupportedCustomerAttachmentExtensions().join(', ')}.`,
            'INVALID_CUSTOMER_ATTACHMENT_TYPE'
        );
    }

    const objectPath = `${GCS_PREFIX_CUSTOMERS}/${id}/${crypto.randomUUID()}.${extension}`;

    await bucket.file(objectPath).save(buffer, {
        resumable: false,
        contentType: mimeType,
        metadata: {
            cacheControl: 'private, no-store',
            metadata: {
                customer_id: String(id),
                original_name: encodeURIComponent(String(originalName || '')),
            },
        },
    });

    return {
        bucket: GCS_BUCKET_CUSTOMERS,
        prefix: GCS_PREFIX_CUSTOMERS,
        objectPath,
        mimeType,
        sizeBytes: buffer.length,
    };
}

/**
 * Stream de leitura (para enviar direto na resposta HTTP).
 */
export function createCustomerAttachmentReadStream(objectPath) {
    if (!isCustomerObjectPath(objectPath)) {
        throw makeError('Caminho de anexo inválido.', 'INVALID_CUSTOMER_ATTACHMENT_PATH');
    }

    return bucket.file(String(objectPath).trim()).createReadStream();
}

export async function downloadCustomerAttachmentObject(objectPath, options = {}) {
    if (!isCustomerObjectPath(objectPath)) return null;

    try {
        const [buffer] = await bucket.file(String(objectPath).trim()).download();
        return Buffer.isBuffer(buffer) && buffer.length > 0 ? buffer : null;
    } catch (error) {
        if (options.silent) {
            console.warn('[uploadBucketsCustomers] Falha ao baixar anexo do GCS:', {
                objectPath,
                message: error?.message || String(error),
            });
            return null;
        }
        throw error;
    }
}

export async function deleteCustomerAttachmentObject(objectPath, options = {}) {
    if (!isCustomerObjectPath(objectPath)) return false;

    try {
        await bucket.file(String(objectPath).trim()).delete({
            ignoreNotFound: options.ignoreNotFound !== false,
        });
        return true;
    } catch (error) {
        if (options.silent) {
            console.warn('[uploadBucketsCustomers] Falha ao excluir anexo do GCS:', {
                objectPath,
                message: error?.message || String(error),
            });
            return false;
        }
        throw error;
    }
}

export default {
    uploadCustomerAttachmentToBucket,
    createCustomerAttachmentReadStream,
    downloadCustomerAttachmentObject,
    deleteCustomerAttachmentObject,
    fixUploadedFileName,
    getCustomerAttachmentMimeType,
    isSupportedCustomerAttachment,
    isInlineCustomerAttachment,
    getSupportedCustomerAttachmentExtensions,
    getCustomerAttachmentBucketInfo,
    CUSTOMER_ATTACHMENT_MAX_BYTES,
    CUSTOMER_ATTACHMENT_MAX_FILES,
};
