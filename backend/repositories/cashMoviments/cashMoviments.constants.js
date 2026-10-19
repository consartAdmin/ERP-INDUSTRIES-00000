// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.constants.js — Bucket GCS / prefixo do Caixa         ║
// ║ Valores lidos de variáveis de ambiente                             ║
// ╚════════════════════════════════════════════════════════════════════╝

export const BUCKET_NAME = process.env.GCS_BUCKET || 'erp-infinity-00000';
export const CAIXA_PREFIX = (process.env.CAIXA_PREFIX || 'cashMoviments').replace(/^\/+|\/+$/g, '');
export const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
