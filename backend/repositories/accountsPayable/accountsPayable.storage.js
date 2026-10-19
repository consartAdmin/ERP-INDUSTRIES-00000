// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.storage.js — Google Cloud Storage (instância,      ║
// ║ bucket, prefixo, TTL e caminhos de objetos dos anexos)             ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Storage } from '@google-cloud/storage';
import { joinPath } from './accountsPayable.utils.js';
import { toStrOrNull, safeFileName, safeSlug } from './accountsPayable.sanitizers.js';

export const storage = new Storage();

export function ensureAccountsPayableBucket() {
  const bucketName =
    toStrOrNull(process.env.ACCOUNTS_PAYABLE_GCS_BUCKET) ||
    toStrOrNull(process.env.GCS_ACCOUNTS_PAYABLE_BUCKET);

  if (!bucketName) {
    const error = new Error('ACCOUNTS_PAYABLE_GCS_BUCKET is required');
    error.code = 'VALIDATION';
    throw error;
  }

  return bucketName;
}

export function getAccountsPayablePrefix() {
  return (
    toStrOrNull(process.env.ACCOUNTS_PAYABLE_GCS_PREFIX) ||
    'accountsPayable'
  ).replace(/^\/+|\/+$/g, '');
}

export function getSignedUrlTtl() {
  const value = Number(process.env.ACCOUNTS_PAYABLE_GCS_SIGNED_URL_TTL || 900);
  return Number.isFinite(value) && value > 0 ? value : 900;
}

export function assertAccountsPayableObjectPath(value) {
  const prefix = getAccountsPayablePrefix();
  const objectPath = String(value || '').replace(/^\/+/, '');

  if (!objectPath.startsWith(`${prefix}/`)) {
    const error = new Error(`gcs_path inválido: deve começar com "${prefix}/"`);
    error.code = 'VALIDATION';
    throw error;
  }

  if (objectPath.includes('..')) {
    const error = new Error('gcs_path inválido');
    error.code = 'VALIDATION';
    throw error;
  }

  return objectPath;
}

export function buildAccountsPayableObjectPath({ account_payable_id, file_type, file_name }) {
  const accountId = Number(account_payable_id);

  if (!Number.isInteger(accountId) || accountId <= 0) {
    const error = new Error('account_payable_id is required');
    error.code = 'VALIDATION';
    throw error;
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[:.]/g, '-');

  return joinPath(
    getAccountsPayablePrefix(),
    `account-${accountId}`,
    year,
    month,
    safeSlug(file_type),
    `${timestamp}_${safeFileName(file_name)}`
  );
}
