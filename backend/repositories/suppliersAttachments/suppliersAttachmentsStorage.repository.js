// ╔════════════════════════════════════════════════════════════════════╗
// ║ suppliersAttachmentsStorage.repository.js — Cliente GCS + URL      ║
// ║ assinada (instanciado ao importar, como no original)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Storage } from '@google-cloud/storage';
import { BUCKET_NAME } from './suppliersAttachments.constants.js';

export const storage = new Storage();
export const bucket = storage.bucket(BUCKET_NAME);

export async function getSignedUrl(filePath) {
  if (!filePath) return null;

  const [url] = await bucket.file(filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 24 * 60 * 60 * 1000
  });

  return url;
}
