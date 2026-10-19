// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInbox.constants.js — Tabela, limites e ordenação padrão           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const TB = 'public."nfeInbox"';

// Tamanho mínimo para considerar que xml_completo tem conteúdo real
// (um resumo/stub da DF-e é bem menor que isso). Usado no SELECT e no UPSERT.
export const MIN_XML_LEN = 200;

export const DEFAULT_SORT_COLUMN = 'data_autorizacao';
export const DEFAULT_SORT_DIRECTION = 'desc';
