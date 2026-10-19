// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ labelsClient.repository.js — Product Labels Endpoints (/api/labels/...) ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { labelsBase, toParams, request } from './labels.utils.js';

/* ──────────────────────────────────────────────────────────────────────────
   Product Labels Endpoints
────────────────────────────────────────────────────────────────────────── */

/**
 * Generate labels for products.
 *
 * Expected payload:
 * {
 *   items: [
 *     { product_code: "ABC123", quantity: 6 },
 *     { product_code: "XYZ001", quantity: 12 }
 *   ],
 *   templateId: "default-product-label",
 *   format: "pdf"
 * }
 */
export async function generateProductLabels(payload = {}) {
  const body = {
    format: 'pdf',
    ...payload,
  };

  return request(`${labelsBase()}/products`, {
    method: 'POST',
    body,
  });
}

/**
 * List label generation jobs (optional feature).
 * @param {Object} qp { page=1, limit=20 }
 */
export async function listLabelJobs(qp = {}) {
  const qs = toParams(qp);
  const url = `${labelsBase()}/jobs${qs ? `?${qs}` : ''}`;
  return request(url);
}

/**
 * Get details of a label job (optional).
 * @param {string|number} jobId
 */
export async function getLabelJob(jobId) {
  const id = encodeURIComponent(jobId);
  return request(`${labelsBase()}/jobs/${id}`);
}
