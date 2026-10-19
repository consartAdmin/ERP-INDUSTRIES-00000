// ╔══════════════════════════════════════════════════════════════════════╗
// ║ uploadBucketsEnterprise.js — Upload de logos de empresas (GCS)     ║
// ║ CONSART ERP | Service | ESM                                        ║
// ║ Path: backend/uploadBuckets/uploadBucketsEnterprise.js             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Storage } from '@google-cloud/storage';

const GCS_BUCKET_ENTERPRISE_LOGOS =
    process.env.GCS_BUCKET_ENTERPRISE_LOGOS ||
    process.env.GCS_BUCKET ||
    'erp-infinity-00000';

const GCS_PREFIX_ENTERPRISE_LOGOS =
    process.env.GCS_PREFIX_ENTERPRISE_LOGOS ||
    'logoEnterprise';

const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET_ENTERPRISE_LOGOS);

const MIME_EXTENSION = Object.freeze({
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
});

function normalizeEnterpriseId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        const error = new Error('ID da empresa inválido.');
        error.code = 'INVALID_ENTERPRISE_ID';
        throw error;
    }
    return id;
}

function sanitizeBaseName(value) {
    return (
        String(value || 'logo')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80)
            .toLowerCase() || 'logo'
    );
}

function encodeGcsObjectPath(objectPath) {
    return String(objectPath)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

function buildPublicUrl(objectPath) {
    return `https://storage.googleapis.com/${GCS_BUCKET_ENTERPRISE_LOGOS}/${encodeGcsObjectPath(objectPath)}`;
}

function buildObjectPath({ enterpriseId, originalName, mimeType }) {
    const id = normalizeEnterpriseId(enterpriseId);
    const extension = MIME_EXTENSION[mimeType];

    if (!extension) {
        const error = new Error('Formato inválido. Use PNG, JPG/JPEG ou WebP.');
        error.code = 'INVALID_ENTERPRISE_LOGO_TYPE';
        throw error;
    }

    const originalBase = String(originalName || 'logo').replace(/\.[^.]+$/, '');
    const safeBase = sanitizeBaseName(originalBase);

    return `${GCS_PREFIX_ENTERPRISE_LOGOS}/${id}/${Date.now()}-${safeBase}.${extension}`;
}

export function getEnterpriseLogoObjectPathFromUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(String(url));
        if (parsed.hostname !== 'storage.googleapis.com') return null;

        const bucketPrefix = `/${GCS_BUCKET_ENTERPRISE_LOGOS}/`;
        if (!parsed.pathname.startsWith(bucketPrefix)) return null;

        const encodedObjectPath = parsed.pathname.slice(bucketPrefix.length);
        const objectPath = decodeURIComponent(encodedObjectPath);

        if (!objectPath.startsWith(`${GCS_PREFIX_ENTERPRISE_LOGOS}/`)) {
            return null;
        }

        return objectPath;
    } catch {
        return null;
    }
}

export function isSupportedEnterpriseLogoMimeType(mimeType) {
    return Boolean(MIME_EXTENSION[String(mimeType || '').toLowerCase()]);
}

export function getEnterpriseLogoBucketInfo() {
    return Object.freeze({
        bucket: GCS_BUCKET_ENTERPRISE_LOGOS,
        prefix: GCS_PREFIX_ENTERPRISE_LOGOS,
    });
}

export async function uploadEnterpriseLogoToBucket({
    enterpriseId,
    buffer,
    originalName,
    mimeType,
} = {}) {
    const id = normalizeEnterpriseId(enterpriseId);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const error = new Error('Arquivo da logo não informado.');
        error.code = 'ENTERPRISE_LOGO_FILE_REQUIRED';
        throw error;
    }

    const normalizedMimeType = String(mimeType || '').toLowerCase();
    const objectPath = buildObjectPath({
        enterpriseId: id,
        originalName,
        mimeType: normalizedMimeType,
    });

    const object = bucket.file(objectPath);

    await object.save(buffer, {
        resumable: false,
        contentType: normalizedMimeType,
        metadata: {
            cacheControl: 'public, max-age=31536000, immutable',
        },
    });

    return {
        bucket: GCS_BUCKET_ENTERPRISE_LOGOS,
        prefix: GCS_PREFIX_ENTERPRISE_LOGOS,
        objectPath,
        publicUrl: buildPublicUrl(objectPath),
    };
}


export async function downloadEnterpriseLogoObject(objectPath, options = {}) {
    const normalizedPath = String(objectPath || '').trim();
    if (!normalizedPath) return null;

    if (!normalizedPath.startsWith(`${GCS_PREFIX_ENTERPRISE_LOGOS}/`)) {
        return null;
    }

    try {
        const [buffer] = await bucket.file(normalizedPath).download();
        return Buffer.isBuffer(buffer) && buffer.length > 0 ? buffer : null;
    } catch (error) {
        if (options.silent) {
            console.warn('[uploadBucketsEnterprise] Falha ao baixar logo do GCS:', {
                objectPath: normalizedPath,
                message: error?.message || String(error),
            });
            return null;
        }
        throw error;
    }
}

export async function downloadEnterpriseLogoByUrl(url, options = {}) {
    const objectPath = getEnterpriseLogoObjectPathFromUrl(url);
    if (!objectPath) return null;
    return downloadEnterpriseLogoObject(objectPath, options);
}

export async function deleteEnterpriseLogoObject(objectPath, options = {}) {
    const normalizedPath = String(objectPath || '').trim();
    if (!normalizedPath) return false;

    if (!normalizedPath.startsWith(`${GCS_PREFIX_ENTERPRISE_LOGOS}/`)) {
        return false;
    }

    await bucket.file(normalizedPath).delete({
        ignoreNotFound: options.ignoreNotFound !== false,
    });

    return true;
}

export async function deleteEnterpriseLogoByUrl(url, options = {}) {
    const objectPath = getEnterpriseLogoObjectPathFromUrl(url);
    if (!objectPath) return false;

    try {
        return await deleteEnterpriseLogoObject(objectPath, options);
    } catch (error) {
        if (options.silent) {
            console.warn('[uploadBucketsEnterprise] Falha ao excluir logo do GCS:', {
                objectPath,
                message: error?.message || String(error),
            });
            return false;
        }
        throw error;
    }
}

export default {
    uploadEnterpriseLogoToBucket,
    downloadEnterpriseLogoObject,
    downloadEnterpriseLogoByUrl,
    getEnterpriseLogoObjectPathFromUrl,
    deleteEnterpriseLogoObject,
    deleteEnterpriseLogoByUrl,
    isSupportedEnterpriseLogoMimeType,
    getEnterpriseLogoBucketInfo,
};
