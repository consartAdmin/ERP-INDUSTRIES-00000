// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInbounds.constants.js — Tabela e flag de debug                ║
// ╚════════════════════════════════════════════════════════════════════╝

export const EMAIL_INBOUNDS_TABLE = 'public."emailInbounds"';

export const DEBUG_EMAIL_INBOUNDS =
  process.env.DEBUG_EMAIL_INBOUNDS === '1' ||
  process.env.EMAIL_DEBUG === '1' ||
  process.env.NODE_ENV !== 'production';
